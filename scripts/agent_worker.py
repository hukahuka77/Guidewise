#!/usr/bin/env python3
"""Prepare and optionally run a Guidewise worker-agent handoff."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
import sys
from typing import Any


DEFAULT_REPO = "hukahuka77/Guidewise"
DEFAULT_PROMPT_DIR = Path.home() / "Coding" / "Guidewise-agent-prompts"
DEFAULT_TEST_COMMANDS = [
    "cd frontend && npm ci",
    "cd frontend && npm run typecheck",
    "cd frontend && npm run lint",
    "cd frontend && NEXT_PUBLIC_API_BASE_URL=http://localhost:5001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build",
    "cd backend && python3 -m compileall .",
]


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


def label_names(issue: dict[str, Any]) -> list[str]:
    return sorted(label["name"] for label in issue.get("labels", []))


def ensure_checkout_ready(checkout_path: Path, issue_number: int) -> None:
    if not (checkout_path / ".git").exists():
        # Worktrees store .git as a file, not a directory.
        if not (checkout_path / ".git").is_file():
            raise RuntimeError(f"checkout path is not a git checkout: {checkout_path}")

    status = git_output(checkout_path, "status", "--porcelain")
    if status:
        raise RuntimeError("worker checkout is not clean; commit or stash changes before spawning a worker")

    branch = git_output(checkout_path, "branch", "--show-current")
    if not branch.startswith(f"agent/{issue_number}-"):
        raise RuntimeError(f"checkout branch `{branch}` does not match issue #{issue_number}")


def markdown_list(items: list[str]) -> str:
    return "\n".join(f"- `{item}`" for item in items)


def build_prompt(repo: str, issue: dict[str, Any], checkout_path: Path, test_commands: list[str]) -> str:
    branch = git_output(checkout_path, "branch", "--show-current")
    labels = ", ".join(label_names(issue)) or "(none)"
    body = issue.get("body") or "(no issue body)"

    return f"""You are a Guidewise worker agent. Complete exactly one scoped GitHub issue in the provided checkout.

Repo: `{repo}`
Checkout path: `{checkout_path}`
Branch: `{branch}`
Issue: #{issue["number"]} - {issue["title"]}
Issue URL: {issue["url"]}
Labels: {labels}

## Issue Body

{body}

## Work Rules

- Work only inside the checkout path above.
- Keep the change scoped to this issue.
- Do not touch secrets or commit env files.
- Do not merge to `main` or `prod`.
- Commit your changes on the current `agent/*` branch.
- Push the branch and open or update a PR into `main`.
- Link the issue in the PR body with `Closes #{issue["number"]}` when the PR should close it.
- Include a concise summary, tests run, risks, and any warnings in the PR body.
- If blocked, comment on the issue and apply `agent:blocked`.
- After opening a PR, move the issue from `agent:in-progress` to `agent:review-needed`.

## Verification Commands

Run the relevant commands below before opening the PR. If a command is not applicable, explain why in the PR.

{markdown_list(test_commands)}

## Expected Output

- A pushed `agent/*` branch.
- A pull request targeting `main`.
- Passing local verification or a clear explanation of any skipped/failed check.
- GitHub issue labels updated for review.
"""


def write_prompt(prompt: str, prompt_dir: Path, issue_number: int) -> Path:
    prompt_dir.mkdir(parents=True, exist_ok=True)
    prompt_path = prompt_dir / f"guidewise-issue-{issue_number}-worker.md"
    prompt_path.write_text(prompt, encoding="utf-8")
    return prompt_path


def run_worker(agent: str, prompt_path: Path, issue_number: int, timeout: int) -> None:
    run_passthrough(
        [
            "openclaw",
            "agent",
            "--agent",
            agent,
            "--session-key",
            f"guidewise-worker-issue-{issue_number}",
            "--message-file",
            str(prompt_path),
            "--timeout",
            str(timeout),
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare or run a Guidewise worker-agent handoff.")
    parser.add_argument("--issue", required=True, type=int, help="GitHub issue number to work.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub repo in owner/name form.")
    parser.add_argument("--checkout", required=True, type=Path, help="Claimed branch/worktree checkout path.")
    parser.add_argument("--prompt-dir", default=DEFAULT_PROMPT_DIR, type=Path, help="Directory for generated prompts.")
    parser.add_argument("--agent", default="main", help="OpenClaw agent id to run when --run is set.")
    parser.add_argument("--timeout", default=1800, type=int, help="OpenClaw worker timeout in seconds.")
    parser.add_argument("--run", action="store_true", help="Run OpenClaw agent with the generated prompt.")
    parser.add_argument("--print", action="store_true", help="Print the generated prompt.")
    parser.add_argument(
        "--test-command",
        action="append",
        dest="test_commands",
        help="Override/add verification command. Repeat for multiple commands.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    checkout_path = args.checkout.resolve()
    test_commands = args.test_commands or DEFAULT_TEST_COMMANDS

    try:
        issue = issue_json(args.repo, args.issue)
        ensure_checkout_ready(checkout_path, args.issue)
        prompt = build_prompt(args.repo, issue, checkout_path, test_commands)
        prompt_path = write_prompt(prompt, args.prompt_dir.resolve(), args.issue)

        if args.print:
            print(prompt)
        print(f"Worker prompt: {prompt_path}")

        if args.run:
            run_worker(args.agent, prompt_path, args.issue, args.timeout)
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
