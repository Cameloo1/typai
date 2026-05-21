# npm Trusted Publishing Setup

Status date: 2026-05-21.

This document is the release-hygiene record for the future npm Trusted
Publishing path. It does not publish packages and it does not retroactively
change the provenance of `0.0.0-beta.0`.

The already-published `0.0.0-beta.0` package set was a manual npm tarball
publish. Do not describe it as OIDC or Trusted Publishing. Use the workflow
below for a future beta patch or later approved registry action.

## Workflow

Workflow filename:

- `.github/workflows/npm-trusted-publish.yml`

Workflow name:

- `npm trusted publish`

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

Node setup includes:

- Node `24`
- `registry-url: https://registry.npmjs.org`
- latest npm installed at runtime, then checked for trusted-publishing minimum
  `11.5.1`

The workflow intentionally has no npm auth token path. Publishing must happen
through npm Trusted Publishing/OIDC.

## Operator Inputs

Required workflow inputs:

- `version`: the exact version already committed in all seven release package
  manifests, such as `0.0.0-beta.1`
- `distTag`: currently must equal `beta`
- `confirmPublish`: must exactly equal `PUBLISH_BETA`

The workflow fails before publish unless `confirmPublish` matches the strict
phrase and `distTag` is `beta`. It does not publish `latest` by default.

## Publish Order

Approved publish order:

1. `@typai/ui`
2. `@typai/core`
3. `@typai/completion-remote`
4. `@typai/contenteditable`
5. `@typai/textarea`
6. `@typai/react`
7. `@typai/codemirror`

The support package `@typai/ui` publishes first because React and CodeMirror
packages depend on it.

## Gates Before Publish

The workflow runs:

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm pack:dry`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm scan:package-secrets`
- `pnpm package:size-report`
- `pnpm dictionary:check-production`
- `pnpm release:check`
- `pnpm release:publish:dry`
- `pnpm docs:check`

It also checks that every package manifest already matches the requested
version and that the exact package version is not already present on npm.

## npm Trusted Publisher Checklist

Configure a trusted publisher on npmjs.com for each package before running the
workflow:

- `@typai/ui`
- `@typai/core`
- `@typai/completion-remote`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`

Trusted publisher fields:

- publisher: GitHub Actions
- organization/user: `Cameloo1`
- repository: `typai`
- workflow filename: `npm-trusted-publish.yml`
- environment: `npm-beta`
- package access: public package publish

Setup checklist:

- npm package ownership verified for all seven packages.
- npm package scope access verified for the release operator.
- GitHub environment `npm-beta` exists.
- Environment approval rules are configured if desired.
- Workflow file is present on the branch used for `workflow_dispatch`.
- Requested package version is new and not present on npm.
- Production language asset state is still documented correctly.
- No long-lived npm auth token is configured or required.

## Dry-Run And Canary Plan

The workflow itself is a publish workflow: `confirmPublish=PUBLISH_BETA` is
required. Dry-run and canary evidence should be gathered before dispatching it:

```sh
pnpm release:publish:dry
pnpm release:pack
pnpm smoke:registry-beta
```

For the next real publish, prefer a beta patch such as `0.0.0-beta.1` after the
package versions, changelog, and release approval record are updated.

## Current Blockers

Trusted Publishing is ready as a repo workflow, but not yet proven end to end:

- npm trusted publisher setup has not been verified for all seven package
  records.
- no future beta patch version has been approved in this prompt.
- `0.0.0-beta.0` already exists and the new workflow must not be rerun for that
  version.
- the current public beta provenance remains manual tarball publish.
