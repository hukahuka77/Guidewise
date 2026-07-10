# Agent Development Workflow

Guidewise uses GitHub as the shared operating system for AI-assisted development. Issues define the work, branches isolate implementation, pull requests hold review, and CI is the gate before code moves toward a deployment branch.

## Roles

- **Lead agent:** plans work, breaks goals into issues, reviews high-risk changes, and prepares release notes.
- **Builder agents:** implement scoped issues on isolated `agent/*` branches.
- **Reviewer agents:** inspect diffs, check tests, and flag regressions, security risks, or missing verification.
- **QA agents:** reproduce bugs, run smoke checks, and add regression coverage where practical.
- **Release agent:** prepares release PRs and deployment notes. Production still requires Andrew's approval.

## Branches

- `main`: confirmed development branch. PRs should pass CI before merge.
- `prod`: confirmed production release branch. PRs or merges into this branch require Andrew approval.
- `agent/<issue-or-task>`: temporary worker branches for AI-agent changes.

Vercel and Render automation should follow the confirmed branch mapping in `docs/release-process.md`.

## Issue Flow

1. Product goals become GitHub issues using the story, bug, architecture, or agent task templates.
2. Work ready for agents gets the `agent:ready` label.
3. A worker claims the issue, creates an `agent/*` branch, and marks the issue `agent:in-progress`.
4. The worker opens a PR into `main` and links the issue.
5. CI, reviewer agents, and the lead agent review the PR.
6. Passing, approved PRs can merge to `main` for dev deployment.
7. Production release PRs target `prod` and wait for Andrew approval.

## Local Verification

Before opening or updating a PR, agents should run the local check contract from the repo root:

```bash
scripts/check.sh
```

When dependencies are already installed and the agent only needs to rerun checks:

```bash
scripts/check.sh --skip-install
```

The script mirrors CI by running frontend install, lint, typecheck, production build with local default public URLs, and backend Python compilation. It exits nonzero on the first failing step.

## Nightly Loop

The overnight automation should run in this order:

1. Read open issues, existing PRs, and failing CI.
2. Select a bounded batch of `agent:ready` work.
3. Spawn worker agents in isolated branches or worktrees.
4. Run implementation, tests, and self-checks.
5. Open or update PRs.
6. Run reviewer and QA passes.
7. Merge only low-risk, passing dev changes when policy allows.
8. Prepare a morning report with merged work, open PRs, blockers, and production candidates.

## Guardrails

- Agents may deploy to dev only through branch and CI rules.
- Agents may prepare production release PRs but may not approve production deployment.
- Secrets must live in GitHub, Vercel, Render, or local secure environment stores. Do not paste secrets into chat.
- If an issue is ambiguous, blocked, or security-sensitive, mark it `agent:blocked` and escalate.
