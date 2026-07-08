# Release Process

This document describes the intended deployment guardrails for Guidewise. Andrew has confirmed `prod` is the real production branch. The exact dev branch mapping for Vercel and Render should still be confirmed before enabling automation.

## Environments

- **Dev:** receives merged development work from `main` or preview deployments from PR branches.
- **Staging:** optional validation environment for release candidates.
- **Production:** receives approved releases from `prod`.

## Current Recommendation

- Vercel frontend previews should run for pull requests.
- Vercel frontend dev deploys should track `main`.
- Render backend dev deploys should track `main` or a dedicated dev service.
- Production frontend/backend deploys track `prod`.
- GitHub production environments should require Andrew as an approving reviewer before production jobs continue.

## Release Flow

1. Merge feature and fix PRs into `main` after CI passes.
2. Let dev deploy automatically from `main`.
3. Smoke test dev for core flows:
   - homepage renders
   - signup/login pages render
   - dashboard loads for an authenticated user
   - guidebook create/edit flow starts
   - backend health or low-risk endpoint responds
4. Create a release PR from `main` into `prod`.
5. Include release notes, risk notes, migrations, and secret/env changes in the PR body.
6. Andrew reviews and approves production deployment.
7. After deployment, run a production smoke check and record the result on the PR.

## Required Secrets and Settings

Store secrets only in managed secret stores:

- GitHub Actions secrets for CI/deployment automation.
- Vercel project environment variables for frontend runtime values.
- Render environment variables for backend runtime values.
- Local secure env files only for machine-local CLI work.

Never put production secrets in issues, PR bodies, docs, or chat.

## GitHub Settings To Apply

When repo admin access is available, configure:

- Require pull requests before merging into `main`.
- Require the `CI / Frontend` and `CI / Backend` checks before merging.
- Require pull requests and Andrew review before merging into `prod`.
- Create GitHub environments: `dev`, `staging`, and `production`.
- Require Andrew approval for the `production` environment.
