# Release Process

This document describes the intended deployment guardrails for Guidewise. Andrew has confirmed `main` is the dev branch and `prod` is the real production branch.

## Environments

- **Dev:** receives merged development work from `main` or preview deployments from PR branches.
- **Staging:** optional validation environment for release candidates.
- **Production:** receives approved releases from `prod`.

## Current Recommendation

- Vercel previews run for pull requests (Preview uses the Supabase dev branch).
- Vercel production deploys track `prod`.
- GitHub production environments should require Andrew as an approving reviewer before production jobs continue.

## Release Flow

1. Merge feature and fix PRs into `main` after CI passes.
2. Let dev deploy automatically from `main`.
3. Smoke test dev for core flows:
   - homepage renders
   - signup/login pages render
   - dashboard loads for an authenticated user
   - guidebook create/edit flow starts
   - `/api/health` responds and a public guidebook page loads
4. Create a release PR from `main` into `prod`.
5. Include release notes, risk notes, migrations, and secret/env changes in the PR body.
6. Andrew reviews and approves production deployment.
7. After deployment, run a production smoke check and record the result on the PR.

## Required Secrets and Settings

Store secrets only in managed secret stores:

- GitHub Actions secrets for CI/deployment automation.
- Vercel project environment variables for runtime values (site, API routes, PDFs, webhook).
- Local secure env files only for machine-local CLI work.

Never put production secrets in issues, PR bodies, docs, or chat.

## GitHub Settings To Apply

When repo admin access is available, configure:

- Require pull requests before merging into `main`.
- Require the `CI / Frontend` check before merging.
- Require pull requests and Andrew review before merging into `prod`.
- Create GitHub environments: `dev`, `staging`, and `production`.
- Require Andrew approval for the `production` environment.
