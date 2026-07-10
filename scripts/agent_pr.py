#!/usr/bin/env python3
"""Create or update a Guidewise worker pull request."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_REPO = "hukahuka77/Guidewise"
IN_PROGRESS_LABEL = "agent:in-progress"
REVIEW_LABEL = "agent:review-needed"


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


def issue_json(repo: str, issue_number: int) -> dict[str, Any]:
    result = run(
        [
            "gh",
            "issue",
            "view",
            str(issue_number),
            "--repo",
            repo,
            "--json",
            "number,title,body,labels,state,url",
        ]
    )
    return json.loads(result.stdout)


def git_output(checkout_path: Path, *args: str) -> str:
    return run(["git", *args], cwd=checkout_path).stdout.strip()


def ensure_checkout_ready(checkout_path: Path, issue_number: int) -> str:
    if not (checkout_path / ".git").exists() and not (checkout_path / ".git").is_file():
        raise RuntimeError(f"checkout path is not a git checkout: {checkout_path}")

    status = git_output(checkout_path, "status", "--porcelain")
    if status:
        raise RuntimeError("worker checkout is not clean; commit or stash changes before creating a PR")

    branch = git_output(checkout_path, "branch", "--show-current")
    if not branch.startswith(f"agent/{issue_number}-"):
        raise RuntimeError(f"checkout branch `{branch}` does not match issue #{issue_number}")
    return branch


def default_title(checkout_path: Path, issue: dict[str, Any], base: str) -> str:
    result = run(["git", "log", "--format=%s", f"origin/{base}..HEAD", "-1"], cwd=checkout_path, check=False)
    subject = result.stdout.strip()
    return subject or f"chore: complete issue #{issue['number']} - {issue['title']}"


def markdown_list(items: list[str]) -> str:
    if not items:
        return "- Not provided"
    return "\n".join(f"- `{item}`" for item in items)


def plain_list(items: list[str]) -> str:
    if not items:
        return "- Not provided"
    return "\n".join(f"- {item}" for item in items)


def build_body(issue: dict[str, Any], summaries: list[str], tests: list[str], risks: list[str], close_issue: bool) -> str:
    close_line = f"\nCloses #{issue['number']}\n" if close_issue else ""
    return f"""## Summary
{plain_list(summaries)}
{close_line}
## Verification
{markdown_list(tests)}

## Risk Notes
{plain_list(risks)}

## Issue
{issue['url']}
"""


def existing_pr(repo: str, branch: str) -> dict[str, Any] | None:
    result = run(
        ["gh", "pr", "view", branch, "--repo", repo, "--json", "number,url,title"],
        check=False,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def update_pr(repo: str, pr_number: int, title: str, body: str) -> str:
    result = run(
        [
            "gh",
            "api",
            f"repos/{repo}/pulls/{pr_number}",
            "-X",
            "PATCH",
            "-f",
            f"title={title}",
            "-f",
            f"body={body}",
            "--jq",
            ".html_url",
        ]
    )
    return result.stdout.strip()


def create_pr(repo: str, branch: str, base: str, title: str, body: str, draft: bool) -> str:
    command = [
        "gh",
        "pr",
        "create",
        "--repo",
        repo,
        "--base",
        base,
        "--head",
        branch,
        "--title",
        title,
        "--body",
        body,
    ]
    if draft:
        command.append("--draft")
    result = run(command)
    return result.stdout.strip()


def move_issue_to_review(repo: str, issue_number: int, pr_url: str) -> None:
    run_passthrough(
        [
            "gh",
            "issue",
            "edit",
            str(issue_number),
            "--repo",
            repo,
            "--remove-label",
            IN_PROGRESS_LABEL,
            "--add-label",
            REVIEW_LABEL,
        ]
    )
    run_passthrough(
        [
            "gh",
            "issue",
            "comment",
            str(issue_number),
            "--repo",
            repo,
            "--body",
            f"Worker PR ready for review: {pr_url}",
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update a Guidewise worker PR.")
    parser.add_argument("--issue", required=True, type=int, help="GitHub issue number.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub repo in owner/name form.")
    parser.add_argument("--checkout", required=True, type=Path, help="Worker checkout path.")
    parser.add_argument("--base", default="main", help="PR base branch.")
    parser.add_argument("--title", help="PR title. Defaults to latest commit subject.")
    parser.add_argument("--summary", action="append", default=[], help="Summary bullet. Repeat for multiple bullets.")
    parser.add_argument("--test", action="append", default=[], help="Verification command/result. Repeat for multiple bullets.")
    parser.add_argument("--risk", action="append", default=[], help="Risk note. Repeat for multiple bullets.")
    parser.add_argument("--draft", action="store_true", help="Create a draft PR when no PR exists.")
    parser.add_argument("--no-close", action="store_true", help="Do not include a Closes line for the issue.")
    parser.add_argument("--no-label-update", action="store_true", help="Do not move the issue to agent:review-needed.")
    parser.add_argument("--apply", action="store_true", help="Push branch and create/update PR. Default is dry run.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    checkout_path = args.checkout.resolve()

    try:
        issue = issue_json(args.repo, args.issue)
        branch = ensure_checkout_ready(checkout_path, args.issue)
        title = args.title or default_title(checkout_path, issue, args.base)
        risks = args.risk or ["Low-risk scoped agent task."]
        body = build_body(issue, args.summary, args.test, risks, not args.no_close)
        pr = existing_pr(args.repo, branch)

        print(f"Branch: {branch}")
        print(f"Base: {args.base}")
        print(f"Title: {title}")
        if pr:
            print(f"Existing PR: {pr['url']}")
        else:
            print("Existing PR: none")
        print("\n--- PR Body ---")
        print(body)

        if not args.apply:
            print("Dry run only. Add --apply to push and create/update the PR.")
            return 0

        run_passthrough(["git", "push", "-u", "origin", branch], cwd=checkout_path)
        pr_url = update_pr(args.repo, pr["number"], title, body) if pr else create_pr(args.repo, branch, args.base, title, body, args.draft)
        print(f"PR: {pr_url}")

        if not args.no_label_update:
            move_issue_to_review(args.repo, args.issue, pr_url)
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
