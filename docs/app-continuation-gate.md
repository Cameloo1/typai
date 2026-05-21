# App Continuation Gate

Status date: 2026-05-21.

This gate defines when typai app or surface work can continue after the release
and production-asset reconciliation lane. It does not approve publishing, npm
dist-tag mutation, Git tag creation, or production asset generation.

## Continuation Rule

App work can continue only when all conditions are true:

| Condition | Required state |
| --- | --- |
| Release state documented | `docs/current-release-and-asset-state.md` records local versions, npm registry state, dist-tags, Git tag state, and publish provenance. |
| Production asset state documented | `docs/current-release-and-asset-state.md` records manifest status, blockers, package inclusion status, and host-provided fallback. |
| No false current docs claim | Current docs must not claim publish is pending as the active state or that a production asset is bundled while blocked. Historical approval docs may remain as historical records. |
| Local package install/smoke works | `pnpm smoke:install` passes. |
| Public beta smoke works | `pnpm smoke:public-beta` passes or a current registry blocker is documented. |
| `@typai/core` remains no-remote | Source audit and package smoke confirm `@typai/core` has no dependency on `@typai/completion-remote`. |
| Production asset complete or parked | Current state is either approved and validated, or explicitly blocked/host-provided only. |
| Tests/build/lint/docs pass | `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm lint`, and `pnpm docs:check` pass, or blockers are documented. |
| Package policy passes | `pnpm pack:dry`, `pnpm package:size-report`, `pnpm scan:package-secrets`, `pnpm dictionary:check-production`, and `pnpm release:check` pass, or blockers are documented. |
| No hidden dirty files | `git status --short` is clean before handing off to app work. |

## Current Decision

Current selected route: **B. Release hygiene closure + asset parked**.

App work can continue after the Prompt 141 release hygiene parked commit. The
validation commands in `docs/current-release-and-asset-state.md` passed, the
registry/tag blockers are documented in `docs/release-hygiene-parked.md`, and
the production asset is explicitly parked as blocked / host-provided only.

## Parked Production Asset Rules

While the production asset is parked:

- Do not generate production dictionary or frequency assets.
- Do not pack production language binaries.
- Do not commit raw ESDB/SCOWL/Hunspell or Google Books Ngram files.
- Keep `dictionary.mode: "production"` unavailable with a clear error.
- Keep host-provided Typai Dictionary Blob v1 loading available only at
  initialization.
- Keep scaled mock and fixture assets labeled as mock/test assets only.

## Release Hygiene Follow-Up

Release hygiene can be handled later without blocking app work:

- Decide whether to leave `latest` pointing at `0.0.0-beta.0` or move it through
  an explicit registry operation.
- Do not create `v0.0.0-beta.0` unless exact tarball provenance is proven.
- Prefer a future `0.0.0-beta.1` Trusted Publishing/OIDC path if a corrected
  beta checkpoint is needed.
- Keep public docs honest that the first beta publish was manual.
- Use `docs/dist-tag-remediation.md` before any future npm dist-tag mutation.
- Do not create `v0.0.0-beta.0`; publish a provenance-clean beta patch if a
  release tag is required.

## Non-Goals

- No npm publish.
- No npm dist-tag mutation.
- No Git tag creation or push.
- No package version change.
- No production asset generation.
- No app/Codex feature work inside this gate.
