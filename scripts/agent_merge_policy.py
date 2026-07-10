#!/usr/bin/env python3
"""Evaluate whether a Guidewise PR may be auto-merged into dev."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from typing import Any


DEFAULT_REPO = "hukahuka77/Guidewise"
AUTO_MERGE_LABEL = "agent:auto-merge"
BLOCKING_LABELS = {
    "agent:blocked",
    "env:production",
    "priority:high",
    "release:candidate",
    "type:architecture",
    "type:bug",
}
ALLOWED_PATH_PREFIXES = (
    "docs/",
    ".github/ISSUE_TEMPLATE/",
)
ALLOWED_ROOT_FILES = {
    "README.md",
}
BLOCKED_PATH_PREFIXES = (
    ".github/workflows/",
    "backend/",
    "frontend/",
    "supabase/",
    "infra/",
    "render",
    "vercel",
)
BLOCKED_FILENAME_PARTS = (
    ".env",
    "secret",
    "token",
    "credential",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "requirements.txt",
    "pyproject.toml",
)
MAX_CHANGED_FILES = 5
MAX_TOTAL_LINES = 250


@dataclass
class Decision:
    eligible: bool
    reasons: list[str]
    blockers: list[str]


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def run_passthrough(command: list[str]) -> None:
    subprocess.run(command, check=True)


def pr_json(repo: str, pr_number: int) -> dict[str, Any]:
    result = run(
        [
            "gh",
            "pr",
            "view",
            str(pr_number),
            "--repo",
            repo,
            "--json",
            (
                "number,title,url,state,isDraft,headRefName,baseRefName,mergeable,"
                "reviewDecision,statusCheckRollup,files,additions,deletions,changedFiles,labels"
            ),
        ]
    )
    return json.loads(result.stdout)


def label_names(pr: dict[str, Any]) -> set[str]:
    return {label["name"] for label in pr.get("labels", [])}


def check_state(check: dict[str, Any]) -> str:
    return str(check.get("conclusion") or check.get("status") or check.get("state") or "").upper()


def check_name(check: dict[str, Any]) -> str:
    return str(check.get("name") or check.get("context") or "(unnamed check)")


def successful_checks(pr: dict[str, Any]) -> tuple[list[str], list[str]]:
    passed: list[str] = []
    blocked: list[str] = []
    for check in pr.get("statusCheckRollup") or []:
        state = check_state(check)
        name = check_name(check)
        if state in {"SUCCESS", "SKIPPED", "NEUTRAL"}:
            passed.append(f"{name}: {state}")
        else:
            blocked.append(f"{name}: {state or 'UNKNOWN'}")
    return passed, blocked


def file_paths(pr: dict[str, Any]) -> list[str]:
    return [file_info.get("path", "") for file_info in pr.get("files") or []]


def is_allowed_low_risk_path(path: str) -> bool:
    if path in ALLOWED_ROOT_FILES:
        return True
    return any(path.startswith(prefix) for prefix in ALLOWED_PATH_PREFIXES)


def is_blocked_path(path: str) -> bool:
    lowered = path.lower()
    if any(lowered.startswith(prefix) for prefix in BLOCKED_PATH_PREFIXES):
        return True
    return any(part in lowered for part in BLOCKED_FILENAME_PARTS)


def evaluate(pr: dict[str, Any], *, require_approval: bool) -> Decision:
    reasons: list[str] = []
    blockers: list[str] = []
    labels = label_names(pr)
    paths = file_paths(pr)
    changed_files = int(pr.get("changedFiles") or len(paths))
    total_lines = int(pr.get("additions") or 0) + int(pr.get("deletions") or 0)

    if pr.get("state") != "OPEN":
        blockers.append(f"PR state is {pr.get('state')}, not OPEN")
    else:
        reasons.append("PR is open")

    if pr.get("isDraft"):
        blockers.append("PR is a draft")
    else:
        reasons.append("PR is not draft")

    if pr.get("baseRefName") != "main":
        blockers.append(f"base branch is `{pr.get('baseRefName')}`, not `main`")
    else:
        reasons.append("base branch is main")

    head_ref = str(pr.get("headRefName") or "")
    if not head_ref.startswith("agent/"):
        blockers.append(f"head branch `{head_ref}` is not an agent branch")
    else:
        reasons.append("head branch is agent-scoped")

    if pr.get("mergeable") != "MERGEABLE":
        blockers.append(f"mergeable state is {pr.get('mergeable') or 'unknown'}")
    else:
        reasons.append("GitHub reports PR is mergeable")

    if AUTO_MERGE_LABEL not in labels:
        blockers.append(f"missing explicit `{AUTO_MERGE_LABEL}` label")
    else:
        reasons.append(f"has `{AUTO_MERGE_LABEL}` label")

    present_blocking_labels = sorted(labels & BLOCKING_LABELS)
    if present_blocking_labels:
        blockers.append(f"blocking labels present: {', '.join(present_blocking_labels)}")
    else:
        reasons.append("no blocking labels present")

    if require_approval and pr.get("reviewDecision") != "APPROVED":
        blockers.append(f"review decision is {pr.get('reviewDecision') or 'not approved'}")
    elif require_approval:
        reasons.append("GitHub review decision is approved")
    else:
        reasons.append("GitHub approval not required by this run")

    _passed, failed_checks = successful_checks(pr)
    if failed_checks:
        blockers.append(f"non-passing checks: {', '.join(failed_checks)}")
    else:
        reasons.append("all reported checks are success/skipped/neutral")

    if changed_files > MAX_CHANGED_FILES:
        blockers.append(f"too many changed files: {changed_files} > {MAX_CHANGED_FILES}")
    else:
        reasons.append(f"changed file count within limit: {changed_files}/{MAX_CHANGED_FILES}")

    if total_lines > MAX_TOTAL_LINES:
        blockers.append(f"too many changed lines: {total_lines} > {MAX_TOTAL_LINES}")
    else:
        reasons.append(f"line change count within limit: {total_lines}/{MAX_TOTAL_LINES}")

    for path in paths:
        if is_blocked_path(path):
            blockers.append(f"blocked path touched: `{path}`")
        elif not is_allowed_low_risk_path(path):
            blockers.append(f"path is not low-risk auto-merge allowlisted: `{path}`")

    if paths and not any("path" in blocker for blocker in blockers):
        reasons.append("changed paths are low-risk allowlisted")

    return Decision(eligible=not blockers, reasons=reasons, blockers=blockers)


def print_decision(pr: dict[str, Any], decision: Decision) -> None:
    status = "ELIGIBLE" if decision.eligible else "NOT ELIGIBLE"
    print(f"PR #{pr['number']}: {pr['title']}")
    print(f"URL: {pr['url']}")
    print(f"Decision: {status}")
    print()
    print("Reasons:")
    for reason in decision.reasons:
        print(f"- {reason}")
    if decision.blockers:
        print()
        print("Blockers:")
        for blocker in decision.blockers:
            print(f"- {blocker}")


def merge_pr(repo: str, pr_number: int) -> None:
    run_passthrough(
        [
            "gh",
            "pr",
            "merge",
            str(pr_number),
            "--repo",
            repo,
            "--squash",
            "--delete-branch",
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate Guidewise dev auto-merge policy for a PR.")
    parser.add_argument("--pr", required=True, type=int, help="GitHub pull request number.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub repo in owner/name form.")
    parser.add_argument(
        "--no-require-approval",
        action="store_true",
        help="Do not require GitHub reviewDecision=APPROVED. Intended only for manual policy testing.",
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable decision JSON.")
    parser.add_argument("--apply", action="store_true", help="Merge the PR if eligible. Default is dry run.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        pr = pr_json(args.repo, args.pr)
        decision = evaluate(pr, require_approval=not args.no_require_approval)

        if args.json:
            print(json.dumps({"eligible": decision.eligible, "reasons": decision.reasons, "blockers": decision.blockers}, indent=2))
        else:
            print_decision(pr, decision)

        if not args.apply:
            print()
            print("Dry run only. Add --apply to merge an eligible PR.")
            return 0 if decision.eligible else 2

        if not decision.eligible:
            raise RuntimeError("refusing to merge because PR is not eligible")

        merge_pr(args.repo, args.pr)
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
