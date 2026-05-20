# Beta Publish Checkpoint

Status date: 2026-05-20T15:52:50.4588811-05:00.

## Publish State

Publish state: **published beta complete with registry smoke passed**.

Evidence:

- `docs/beta-publish-result.md` records `published: true`.
- All seven approved packages resolve from npm through `@beta`.
- `docs/beta-registry-smoke.md` records registry-only consumer smoke passed.
- Release package versions are `0.0.0-beta.0`.
- Root/private workspace package versions remain `0.0.0-dev`.
- No local or pushed `v0.0.0-beta.0` Git tag exists.
- Production language assets remain blocked / host-provided only.

The actual observed publish was a manual npm tarball publish outside the GitHub
Actions trusted-publishing workflow. The trusted-publishing workflow remains in
the repo, but it was not dispatched for this publish. Do not claim OIDC or npm
Trusted Publishing was used for the published artifacts.

## Version, Dist-Tag, And Git Tag

- Approved version: `0.0.0-beta.0`.
- Current release package version: `0.0.0-beta.0`.
- Current root/private package version: `0.0.0-dev`.
- Approved dist-tag: `beta`.
- npm `beta` status: all seven packages resolve to `0.0.0-beta.0`.
- npm `latest` status: all seven packages also resolve to `0.0.0-beta.0`.
- Approved Git tag: `v0.0.0-beta.0`.
- Git tag status: none.

The `latest` tag points at the beta because these were first publishes. No
dist-tag mutation was attempted in this checkpoint. Any decision to move or
remove `latest` requires a separate explicit release gate.

## Package List

Published public beta package set:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`, published because public packages depend on it. It remains
  support-grade and unstable as an independent design-system API.

Private packages, provider examples, consumer examples, and testkit packages
remain excluded from the publish set.

## Registry Smoke Summary

Registry smoke passed from public npm packages.

Temp consumer source:

- public npm registry
- `@beta` dist-tag packages
- no workspace symlinks
- no local tarballs

Scenarios passed:

- core import and initialization
- `teh` autocorrects to `the`
- valid word `form` does not autocorrect
- contenteditable adapter import
- textarea adapter import
- React provider and component imports
- CodeMirror extension import
- completion mock provider and controller creation
- endpoint provider object creation without a real provider call
- vanilla Vite build
- React Vite build
- CodeMirror Vite build

## Package Contents Audit Summary

The latest tarball and size audits covered seven release artifacts at
`0.0.0-beta.0`.

- `@typai/core` includes `dist/`, TypeScript declarations, package metadata,
  README, and generated Wasm package output.
- Adapter, completion, and support packages include `dist/`, TypeScript
  declarations, package metadata, and README.
- Package size report found no production or raw asset files in any release
  tarball.
- Package secret scan passed for all seven release packages.
- Release check passed with six public packages and one support package.

## Boundary Audit Summary

Preserved boundaries:

- `@typai/core` remains local deterministic correction only.
- `@typai/core` does not import or depend on `@typai/completion-remote`.
- `@typai/core` does not import React, CodeMirror, UI, provider packages, or
  server proxy examples.
- Browser package code has no provider credential path.
- Tests, demos, E2E, benchmarks, and registry smoke use mock provider behavior
  unless a later manual real-provider gate explicitly opens a local script.
- Valid-word autocorrect remains forbidden.
- Protected-token writes remain zero.
- Next-edit logging remains absent.
- Local inference remains absent.
- Real Codex adapter implementation remains absent.

## Production Asset Status

Production language asset status: **blocked / host-provided only**.

- No production dictionary binary is bundled.
- No production frequency table is bundled.
- No raw ESDB/SCOWL, Hunspell, or Google Books Ngram source files are bundled.
- `dictionary.mode: "production"` remains unavailable while review status is
  blocked.
- Host-provided Typai Dictionary Blob v1 bytes may be loaded at
  `createTypaiCore()` initialization.

## Validation Summary

Pre-dispatch and post-publish local validation passed:

- `pnpm trusted-publish:check`
- `pnpm beta:approval:check`
- `pnpm release:check`
- `pnpm release:publish:dry`
- `pnpm scan:package-secrets`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm docs:check`
- `pnpm dictionary:check-production`

Registry smoke passed from public npm packages. Full post-doc validation is
recorded in the final prompt response.

## Docs Update Status

Public docs now include npm beta install guidance and still document:

- beta version `0.0.0-beta.0`
- dist-tag `beta`
- production language asset limitations
- provider proxy model as server-owned
- no browser API-key path
- no real Codex adapter
- no grammar/style features
- no local inference
- no next-edit logging
- `@typai/ui` support-grade/unstable status

Rollback guidance: `docs/beta-rollback-guidance.md`.

## Known Limitations

- The production dictionary/frequency asset is not bundled.
- Spell coverage is not production dictionary coverage.
- `@typai/ui` is a required support package, not a stable independent design
  system API.
- Real provider completion remains manual and server-side only.
- There is no real Codex adapter.
- There are no grammar, style, tone, or clarity features.
- There is no local inference.
- There is no next-edit logging.
- The `latest` dist-tag currently points at the beta because these were first
  publishes.
- No beta Git tag has been created or pushed.

## Next-Phase Options

- beta patch/remediation if publish or smoke issues appear
- Production Asset Unblock if spell coverage remains priority
- Real Codex Adapter if dogfooding or flagship integration is priority
- Apple-style personalization if user-specific correction behavior is priority
- Grammar/style async editor if writing assistant breadth is priority
- Path B local completion research if local completion intelligence is priority
- ProseMirror/Monaco implementation if editor ecosystem coverage is priority
- Browser extension if install-anywhere web coverage is priority

## Recommended Decision Rule

- If beta publish succeeded and no urgent user-facing defect appears, choose Real
  Codex Adapter or Production Asset Unblock.
- If beta publish or smoke issues appear, fix beta patch/remediation first.
- If spell quality complaints persist, prioritize Production Asset Unblock.
- If dogfooding is the goal, prioritize Real Codex Adapter.

Current immediate decision: explicitly select the next phase. No feature phase
should start without that selection.
