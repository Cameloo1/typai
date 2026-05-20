# Beta Publish Checkpoint

Status date: 2026-05-20.

## Publish State

Publish state: **Publish approval pending; no registry publish occurred.**

Evidence:

- `docs/beta-publish-result.md` is absent.
- `docs/beta-registry-smoke.md` is absent.
- `release/beta-approval.json` has `manualApproval.approvalStatus: "pending"`.
- Release package versions remain `0.0.0-dev`.
- No local `v0.0.0-beta.0` Git tag exists.
- Public docs remain in local workspace/tarball mode.

No npm package was published during this checkpoint.

## Version, Dist-Tag, And Git Tag

- Approved version: not approved.
- Current package version: `0.0.0-dev`.
- Target version from approval record: `0.0.0-beta.0`.
- Approved dist-tag: not approved.
- Target dist-tag from approval record: `beta`.
- Approved Git tag: not approved.
- Target Git tag from approval record: `v0.0.0-beta.0`.
- Git tag status: no local or pushed beta tag.

Because publish approval is pending, no registry dist-tag audit was run.

## Package List

Public beta package candidates:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`, packed because public packages depend on it. It remains
  support-grade and unstable as an independent design-system API.

Private packages, provider examples, consumer examples, and testkit packages
remain excluded from the publish set unless a later approval explicitly changes
that boundary.

## Registry Smoke Summary

Registry smoke was **not run** because no publish occurred. This is intentional:
registry smoke must not be simulated from local tarballs or workspace symlinks.

Latest local package smoke results:

- `pnpm smoke:install`: passed from local tarballs.
- `pnpm smoke:public-beta`: passed from local tarballs.
- Provider mode: mock-only; no real provider calls were made.

## Package Contents Audit Summary

The latest tarball and size audits covered seven release artifacts at
`0.0.0-dev`.

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
- `@typai/core` does not import `@typai/completion-remote`.
- `@typai/core` does not import React, CodeMirror, UI, provider packages, or
  server proxy examples.
- Browser package code has no provider credential path.
- Tests, demos, E2E, benchmarks, and CI use mock provider behavior unless a
  later manual real-provider gate explicitly opens a local script.
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

Prompt 121 validation passed:

- `pnpm test`
- `pnpm test:e2e`
- `pnpm --filter @typai/core bench`
- `pnpm bench:browser`
- `pnpm pack:dry`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm scan:package-secrets`
- `pnpm package:size-report`
- `pnpm release:check`
- `pnpm docs:check`
- `pnpm dictionary:check-production`
- `pnpm build`
- `pnpm lint`

Some Playwright and pack-style commands required rerun outside the restricted
sandbox because Vite, npm, and wasm-pack needed local filesystem temp/cache
access. The reruns passed.

## Docs Update Status

Public docs reflect the current prepublish state:

- no public registry install instructions
- local workspace and local tarball smoke instructions only
- production language asset limitations documented
- provider proxy model documented as server-owned
- beta known issues documented in `docs/beta-known-issues.md`
- rollback guidance documented in `docs/beta-rollback-guidance.md`

Rollback guidance: `docs/beta-rollback-guidance.md`.

## Known Limitations

- Manual beta approval is pending.
- No npm publish has occurred.
- No registry smoke has run.
- No Git tag has been created.
- Package versions remain `0.0.0-dev`.
- The production dictionary/frequency asset is not bundled.
- Spell coverage is not production dictionary coverage.
- `@typai/ui` is a required support package, not a stable independent design
  system API.
- Real provider completion remains manual and server-side only.
- There is no real Codex adapter.
- There are no grammar, style, tone, or clarity features.
- There is no local inference.
- There is no next-edit logging.

## Next-Phase Options

- npm beta patch follow-up if publish issues exist.
- Production Asset Unblock if spell coverage remains priority.
- Real Codex Adapter if dogfooding or flagship integration is priority.
- Apple-style personalization if user-specific correction behavior is priority.
- Grammar/style async editor if writing assistant breadth is priority.
- Path B local completion research if local completion intelligence is priority.
- ProseMirror/Monaco implementation if editor ecosystem coverage is priority.
- Browser extension if install-anywhere web coverage is priority.

## Recommended Decision Rule

- If beta publish succeeds and no urgent user-facing defect appears, choose Real
  Codex Adapter or Production Asset Unblock.
- If beta publish fails, fix beta patch or remediation first.
- If spell quality complaints persist, prioritize Production Asset Unblock.
- If dogfooding is the goal, prioritize Real Codex Adapter.

Current immediate decision: either complete manual beta approval and guarded
publish, or explicitly choose a non-publish next phase. No feature phase should
start without that selection.
