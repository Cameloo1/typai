# npm Trusted Publishing Setup

Status date: 2026-05-20.

This document describes the prepared Typai npm beta publish path through npm
Trusted Publishing and GitHub Actions OIDC. It does not publish packages by
itself.

The `0.0.0-beta.0` package set has since been observed on the public npm
registry through a manual tarball publish path. Do not claim that publish used
OIDC or Trusted Publishing. Keep this workflow for future beta patch releases
or later registry actions after explicit approval.

## Why Trusted Publishing

The local npm publish path is blocked by interactive passkey authentication.
Trusted Publishing moves the publish identity into a manually dispatched GitHub
Actions workflow that npm can verify with OpenID Connect.

Benefits for this release:

- no long-lived `NPM_TOKEN`
- no npm auth token secret in GitHub
- no local passkey or OTP prompt during CI publish
- short-lived OIDC workflow identity
- npm provenance support through Trusted Publishing
- publish action still remains gated by workflow inputs and GitHub environment
  controls

## Workflow

Workflow filename:

- `.github/workflows/npm-beta-publish.yml`

Workflow name:

- `npm beta publish`

GitHub repository:

- owner/user: `Cameloo1`
- repository: `typai`

GitHub environment:

- `npm-beta`

The workflow uses `workflow_dispatch` only. It does not run on `push` or
`pull_request`.

Required workflow permissions:

- `contents: read`
- `id-token: write`

Runtime requirements:

- GitHub-hosted runner: `ubuntu-latest`
- Node: `24`
- npm: latest npm installed at runtime, then checked for `11.5.1+`
- pnpm: `10.20.0`

The workflow intentionally does not reference `NPM_TOKEN` or `NODE_AUTH_TOKEN`.

## npm Trusted Publisher Setup

Configure a trusted publisher on npmjs.com for each package before running the
workflow with `publish=true`.

Packages:

- `@typai/ui`
- `@typai/core`
- `@typai/completion-remote`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`

Trusted publisher fields for each package:

- publisher: GitHub Actions
- organization/user: `Cameloo1`
- repository: `typai`
- workflow filename: `npm-beta-publish.yml`
- environment: `npm-beta`
- allowed action: npm publish

Each package can only have one trusted publisher configured at a time.

Trusted publisher setup may require a one-time npm passkey approval in the npm
web UI.

Self-hosted runners are not supported for this Trusted Publishing path.

`npm whoami` is not proof that OIDC publishing is configured. OIDC is exchanged
during `npm publish` inside the trusted workflow.

## First-Publish Caveat

The `0.0.0-beta.0` versions are now published. For future first-publish scopes
or packages, if npm does not allow trusted publisher setup for an unpublished
package through the npm web UI, stop and document the observed npm UI blocker.
Do not fall back to token publishing or local passkey publishing without a
separate explicit approval.

## Provenance Choice

The workflow relies on npm Trusted Publishing's automatic provenance support. It
does not pass `--provenance` today.

If npm behavior later requires an explicit provenance flag, add `--provenance`
in a separate reviewed change and rerun the local workflow checker before any
publish attempt.

## Manual Workflow Inputs

Run `workflow_dispatch` with:

- `confirm_version`: `0.0.0-beta.0`
- `confirm_dist_tag`: `beta`
- `publish`: `true`
- `push_git_tag`: `false`

Use `publish=false` for validation and dry-run behavior only.

`push_git_tag=true` is intentionally rejected by the current workflow because
the workflow uses `contents: read`. Pushing a Git tag requires a separate
approval and a separate permissions change.

## Workflow Gates

The workflow fails before publishing if:

- `confirm_version` is not `0.0.0-beta.0`
- `confirm_dist_tag` is not `beta`
- `push_git_tag` is `true`
- any validation command fails
- any exact package version already exists on npm
- any approved tarball is missing

Validation commands:

- `pnpm beta:approval:check`
- `pnpm release:check`
- `pnpm release:publish:dry`
- `pnpm scan:package-secrets`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm docs:check`
- `pnpm dictionary:check-production`
- `pnpm test`
- `pnpm build`
- `pnpm lint`
- `pnpm release:pack`

Publish commands, in approved order:

1. `npm publish .pack/typai-ui-0.0.0-beta.0.tgz --tag beta --access public`
2. `npm publish .pack/typai-core-0.0.0-beta.0.tgz --tag beta --access public`
3. `npm publish .pack/typai-completion-remote-0.0.0-beta.0.tgz --tag beta --access public`
4. `npm publish .pack/typai-contenteditable-0.0.0-beta.0.tgz --tag beta --access public`
5. `npm publish .pack/typai-textarea-0.0.0-beta.0.tgz --tag beta --access public`
6. `npm publish .pack/typai-react-0.0.0-beta.0.tgz --tag beta --access public`
7. `npm publish .pack/typai-codemirror-0.0.0-beta.0.tgz --tag beta --access public`

No command uses the `latest` dist-tag.

## Pre-Run Checklist

- Trusted publisher configured for all seven packages.
- GitHub environment `npm-beta` exists.
- GitHub environment approval rules configured if desired.
- Workflow file committed to the intended release branch.
- Workflow file present on the branch used for `workflow_dispatch`.
- Exact package versions are not already present on npm.
- Production language asset limitation is acknowledged as blocked /
  host-provided only.
- Release operator runs `workflow_dispatch` with the exact approved inputs.

## Post-Run Checklist

If publish succeeds:

- Confirm each package resolves through the `beta` dist-tag.
- Confirm no package was intentionally published with `latest`.
- Download the `trusted-npm-beta-publish-result` artifact.
- Record the result in `docs/beta-publish-result.md`.
- Run the Prompt 127 registry smoke and public docs update.

If publish fails:

- Do not unpublish automatically.
- Stop further publish attempts.
- Preserve the workflow logs and result artifact.
- Record the failed package, error, and remediation recommendation.
- Prefer beta patch remediation or npm deprecation over rewriting public
  release history.
