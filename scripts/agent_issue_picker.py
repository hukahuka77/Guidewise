#!/usr/bin/env python3
"""Pick and optionally claim Guidewise issues for agent work."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


READY_LABEL = "agent:ready"
IN_PROGRESS_LABEL = "agent:in-progress"
BLOCKED_LABEL = "agent:blocked"

PRIORITY_ORDER = {
    "priority:high": 0,
    "priority:medium": 1,
    "priority:low": 2,
}


def run(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def run_passthrough(command: list[str], *, cwd: Path | None = None) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def label_names(issue: dict[str, Any]) -> set[str]:
    return {label["name"] for label in issue.get("labels", [])}


def priority_rank(issue: dict[str, Any]) -> int:
    labels = label_names(issue)
    return min((PRIORITY_ORDER[label] for label in labels if label in PRIORITY_ORDER), default=9)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)[:48] or "task"


def load_ready_issues(repo: str, limit: int) -> list[dict[str, Any]]:
    result = run(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            repo,
            "--state",
            "open",
            "--label",
            READY_LABEL,
            "--limit",
            str(limit),
            "--json",
            "number,title,labels,url,updatedAt",
        ]
    )
    issues = json.loads(result.stdout)
    return [
        issue
        for issue in issues
        if READY_LABEL in label_names(issue)
        and IN_PROGRESS_LABEL not in label_names(issue)
        and BLOCKED_LABEL not in label_names(issue)
    ]


def sort_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(issues, key=lambda issue: (priority_rank(issue), issue["number"]))


def branch_name(issue: dict[str, Any]) -> str:
    return f"agent/{issue['number']}-{slugify(issue['title'])}"


def ensure_clean_tree(repo_path: Path) -> None:
    status = run(["git", "status", "--porcelain"], cwd=repo_path).stdout.strip()
    if status:
        raise RuntimeError("working tree is not clean; commit or stash changes before claiming an issue")


def branch_exists(repo_path: Path, branch: str) -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", branch],
        cwd=repo_path,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def create_branch_or_worktree(repo_path: Path, issue: dict[str, Any], base: str, worktree_root: Path | None) -> Path:
    branch = branch_name(issue)
    run_passthrough(["git", "fetch", "origin"], cwd=repo_path)

    if worktree_root:
        worktree_root.mkdir(parents=True, exist_ok=True)
        worktree_path = worktree_root / branch.replace("/", "-")
        if worktree_path.exists():
            raise RuntimeError(f"worktree path already exists: {worktree_path}")
        command = ["git", "worktree", "add", "-b", branch, str(worktree_path), f"origin/{base}"]
        run_passthrough(command, cwd=repo_path)
        return worktree_path

    ensure_clean_tree(repo_path)
    if branch_exists(repo_path, branch):
        raise RuntimeError(f"branch already exists: {branch}")
    run_passthrough(["git", "switch", "-c", branch, f"origin/{base}"], cwd=repo_path)
    return repo_path


def claim_issue(repo: str, repo_path: Path, issue: dict[str, Any], base: str, worktree_root: Path | None) -> None:
    checkout_path = create_branch_or_worktree(repo_path, issue, base, worktree_root)
    branch = branch_name(issue)
    run_passthrough(
        [
            "gh",
            "issue",
            "edit",
            str(issue["number"]),
            "--repo",
            repo,
            "--remove-label",
            READY_LABEL,
            "--add-label",
            IN_PROGRESS_LABEL,
        ]
    )
    run_passthrough(
        [
            "gh",
            "issue",
            "comment",
            str(issue["number"]),
            "--repo",
            repo,
            "--body",
            f"Claimed for agent work on `{branch}`.\n\nCheckout path: `{checkout_path}`",
        ]
    )
    print(f"Claimed #{issue['number']}: {issue['title']}")
    print(f"Branch: {branch}")
    print(f"Checkout: {checkout_path}")


def print_issue(issue: dict[str, Any]) -> None:
    labels = ", ".join(sorted(label_names(issue)))
    print(f"#{issue['number']} {issue['title']}")
    print(f"  {issue['url']}")
    print(f"  labels: {labels}")
    print(f"  branch: {branch_name(issue)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="List or claim Guidewise agent-ready issues.")
    parser.add_argument("--repo", default="hukahuka77/Guidewise", help="GitHub repo in owner/name form.")
    parser.add_argument("--repo-path", default=".", type=Path, help="Local repo path.")
    parser.add_argument("--base", default="main", help="Base branch for agent branches.")
    parser.add_argument("--limit", default=10, type=int, help="Maximum issues to inspect.")
    parser.add_argument("--json", action="store_true", help="Print selected issues as JSON.")
    parser.add_argument(
        "--claim",
        nargs="?",
        const=0,
        type=int,
        help="Claim the given issue number, or the highest-priority selected issue if no number is supplied.",
    )
    parser.add_argument(
        "--worktree-root",
        type=Path,
        help="Create an isolated git worktree under this directory instead of switching the current checkout.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_path = args.repo_path.resolve()

    try:
        issues = sort_issues(load_ready_issues(args.repo, args.limit))
        if args.json:
            print(json.dumps(issues, indent=2))
        else:
            if not issues:
                print("No ready issues found.")
            for issue in issues:
                print_issue(issue)

        if args.claim is not None:
            if not issues:
                raise RuntimeError("cannot claim: no ready issues found")
            issue = issues[0] if args.claim == 0 else next(
                (candidate for candidate in issues if candidate["number"] == args.claim),
                None,
            )
            if issue is None:
                raise RuntimeError(f"cannot claim: issue #{args.claim} is not ready or was not in the selected batch")
            claim_issue(args.repo, repo_path, issue, args.base, args.worktree_root.resolve() if args.worktree_root else None)
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
