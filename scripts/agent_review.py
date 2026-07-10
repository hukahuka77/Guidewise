#!/usr/bin/env python3
"""Prepare and optionally run a Guidewise PR review or repair handoff."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_REPO = "hukahuka77/Guidewise"
DEFAULT_PROMPT_DIR = Path.home() / "Coding" / "Guidewise-agent-prompts"
DEFAULT_MAX_DIFF_CHARS = 60000


def run(command: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def run_passthrough(command: list[str], *, cwd: Path | None = None) -> None:
    subprocess.run(command, cwd=cwd, check=True)


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
                "number,title,body,url,headRefName,baseRefName,author,mergeable,"
                "statusCheckRollup,files,additions,deletions,changedFiles,reviewDecision"
            ),
        ]
    )
    return json.loads(result.stdout)


def pr_diff(repo: str, pr_number: int) -> str:
    return run(["gh", "pr", "diff", str(pr_number), "--repo", repo]).stdout


def truncate_diff(diff: str, max_chars: int) -> str:
    if len(diff) <= max_chars:
        return diff

    omitted = len(diff) - max_chars
    return f"{diff[:max_chars]}\n\n[diff truncated: {omitted} characters omitted]\n"


def checkout_branch(checkout_path: Path) -> str:
    return run(["git", "branch", "--show-current"], cwd=checkout_path).stdout.strip()


def ensure_repair_checkout(checkout_path: Path, head_ref: str) -> None:
    if not (checkout_path / ".git").exists() and not (checkout_path / ".git").is_file():
        raise RuntimeError(f"repair checkout path is not a git checkout: {checkout_path}")

    status = run(["git", "status", "--porcelain"], cwd=checkout_path).stdout.strip()
    if status:
        raise RuntimeError("repair checkout is not clean; commit or stash changes before repair")

    branch = checkout_branch(checkout_path)
    if branch != head_ref:
        raise RuntimeError(f"repair checkout branch `{branch}` does not match PR head `{head_ref}`")


def author_login(pr: dict[str, Any]) -> str:
    author = pr.get("author") or {}
    if isinstance(author, dict):
        return str(author.get("login") or "(unknown)")
    return str(author)


def files_summary(pr: dict[str, Any]) -> str:
    files = pr.get("files") or []
    if not files:
        return "- (no changed files reported)"

    lines = []
    for file_info in files:
        path = file_info.get("path", "(unknown)")
        additions = file_info.get("additions", 0)
        deletions = file_info.get("deletions", 0)
        lines.append(f"- `{path}` (+{additions}/-{deletions})")
    return "\n".join(lines)


def checks_summary(pr: dict[str, Any]) -> str:
    checks = pr.get("statusCheckRollup") or []
    if not checks:
        return "- (no check results reported)"

    lines = []
    for check in checks:
        name = check.get("name") or check.get("context") or "(unnamed check)"
        state = check.get("conclusion") or check.get("status") or check.get("state") or "(unknown)"
        lines.append(f"- {name}: {state}")
    return "\n".join(lines)


def build_review_prompt(repo: str, pr: dict[str, Any], diff: str) -> str:
    body = pr.get("body") or "(no PR body)"
    return f"""You are the elevated Guidewise reviewer agent. Review this pull request as if a lower-tier builder may have produced it.

Repo: `{repo}`
PR: #{pr["number"]} - {pr["title"]}
PR URL: {pr["url"]}
Author: {author_login(pr)}
Base: `{pr["baseRefName"]}`
Head: `{pr["headRefName"]}`
Mergeable: {pr.get("mergeable") or "(unknown)"}
Review decision: {pr.get("reviewDecision") or "(none)"}
Changed files: {pr.get("changedFiles", 0)}
Additions/deletions: +{pr.get("additions", 0)} / -{pr.get("deletions", 0)}

## PR Body

{body}

## Checks

{checks_summary(pr)}

## Files

{files_summary(pr)}

## Review Rules

- Use a code-review stance: findings first, ordered by severity.
- Ground findings in specific file and line references when possible.
- Prioritize bugs, regressions, security/data risks, bad automation behavior, and missing verification.
- Verify that the PR body and test claims match the diff and check results.
- Do not merge the PR.
- If there are no blocking findings, say so clearly and list residual risks or test gaps.
- Keep the final review concise enough to paste into GitHub.

## Diff

```diff
{diff}
```
"""


def build_repair_prompt(repo: str, pr: dict[str, Any], diff: str, checkout_path: Path) -> str:
    body = pr.get("body") or "(no PR body)"
    return f"""You are the elevated Guidewise repair agent. Inspect this pull request and repair only clear, low-risk problems.

Repo: `{repo}`
Checkout path: `{checkout_path}`
PR: #{pr["number"]} - {pr["title"]}
PR URL: {pr["url"]}
Base: `{pr["baseRefName"]}`
Head: `{pr["headRefName"]}`

## PR Body

{body}

## Checks

{checks_summary(pr)}

## Files

{files_summary(pr)}

## Repair Rules

- Work only inside the checkout path above.
- Confirm the checkout branch is `{pr["headRefName"]}` before editing.
- Make only scoped repairs for this PR. Do not expand the feature.
- Prefer fixing failing checks, obvious review findings, broken docs, missing tests, or mismatched PR metadata.
- Run `scripts/check.sh --skip-install` if available; otherwise run the closest relevant checks.
- Commit repairs on the same PR branch and push.
- Update the PR body or comment with what changed and what verification ran.
- If repair is ambiguous, risky, or requires product judgment, stop and report the blocker instead of guessing.

## Diff

```diff
{diff}
```
"""


def write_prompt(prompt: str, prompt_dir: Path, pr_number: int, mode: str) -> Path:
    prompt_dir.mkdir(parents=True, exist_ok=True)
    prompt_path = prompt_dir / f"guidewise-pr-{pr_number}-{mode}.md"
    prompt_path.write_text(prompt, encoding="utf-8")
    return prompt_path


def run_agent(agent: str, prompt_path: Path, pr_number: int, mode: str, timeout: int) -> None:
    run_passthrough(
        [
            "openclaw",
            "agent",
            "--agent",
            agent,
            "--session-key",
            f"guidewise-{mode}-pr-{pr_number}",
            "--message-file",
            str(prompt_path),
            "--timeout",
            str(timeout),
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare or run a Guidewise PR review/repair handoff.")
    parser.add_argument("--pr", required=True, type=int, help="GitHub pull request number.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub repo in owner/name form.")
    parser.add_argument("--mode", choices=["review", "repair"], default="review", help="Handoff mode.")
    parser.add_argument("--checkout", type=Path, help="PR branch checkout path. Required for repair mode.")
    parser.add_argument("--prompt-dir", default=DEFAULT_PROMPT_DIR, type=Path, help="Directory for generated prompts.")
    parser.add_argument("--agent", default="main", help="OpenClaw agent id to run when --run is set.")
    parser.add_argument("--timeout", default=1800, type=int, help="OpenClaw agent timeout in seconds.")
    parser.add_argument("--max-diff-chars", default=DEFAULT_MAX_DIFF_CHARS, type=int, help="Maximum diff chars in prompt.")
    parser.add_argument("--run", action="store_true", help="Run OpenClaw agent with the generated prompt.")
    parser.add_argument("--print", action="store_true", help="Print the generated prompt.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        pr = pr_json(args.repo, args.pr)
        diff = truncate_diff(pr_diff(args.repo, args.pr), args.max_diff_chars)

        if args.mode == "repair":
            if not args.checkout:
                raise RuntimeError("--checkout is required for repair mode")
            checkout_path = args.checkout.resolve()
            ensure_repair_checkout(checkout_path, pr["headRefName"])
            prompt = build_repair_prompt(args.repo, pr, diff, checkout_path)
        else:
            prompt = build_review_prompt(args.repo, pr, diff)

        prompt_path = write_prompt(prompt, args.prompt_dir.resolve(), args.pr, args.mode)

        if args.print:
            print(prompt)
        print(f"{args.mode.title()} prompt: {prompt_path}")

        if args.run:
            run_agent(args.agent, prompt_path, args.pr, args.mode, args.timeout)
        else:
            print("Dry run only. Add --run to invoke OpenClaw.")
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
