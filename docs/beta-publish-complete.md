# Beta Publish Checkpoint

Status date: 2026-05-20.

## Publish State

Publish state: **Approved beta version prepared; no registry publish
occurred.**

Evidence:

- `docs/beta-publish-result.md` exists and records `published: false`.
- The latest guarded publish attempt failed before the first package was
  published.
- The failed package was `@typai/ui`.
- npm returned `EOTP` because the publish operation requires a one-time
  password/browser authentication flow.
- `docs/beta-registry-smoke.md` is absent.
- `release/beta-approval.json` has `manualApproval.approvalStatus:
  "approved"`.
- Release package versions are prepared at `0.0.0-beta.0`.
- Root/private workspace package versions remain `0.0.0-dev`.
- No local `v0.0.0-beta.0` Git tag exists.
- Public docs remain in local workspace/tarball mode.

No npm package was published during this checkpoint. The latest guarded publish
attempt ran with `TYPAI_ALLOW_NPM_BETA_PUBLISH=1`, npm authentication succeeded
as `camelo1`, and exact package/version availability checks confirmed that all
seven `0.0.0-beta.0` package versions were unpublished. The actual npm publish
command failed on `@typai/ui` with `EOTP` before any package was published. The
next publish attempt must complete npm's publish-time one-time-password/browser
authentication flow or use an npm release authentication path that can satisfy
the account's publish-time 2FA policy, such as a granular npm access token that
is permitted to publish the `@typai` packages with the required 2FA bypass
policy.

The prepared next publish path is npm Trusted Publishing through GitHub Actions
OIDC. The workflow is `.github/workflows/npm-beta-publish.yml`, and the external
npm setup checklist is recorded in `docs/trusted-publishing-setup.md`.

## Version, Dist-Tag, And Git Tag

- Approved version: `0.0.0-beta.0`.
- Current release package version: `0.0.0-beta.0`.
- Current root/private package version: `0.0.0-dev`.
- Target version from approval record: `0.0.0-beta.0`.
- Approved dist-tag: `beta`.
- Target dist-tag from approval record: `beta`.
- Approved Git tag: `v0.0.0-beta.0`.
- Target Git tag from approval record: `v0.0.0-beta.0`.
- Git tag status: no local or pushed beta tag.

Because no npm publish occurred, no registry smoke or beta dist-tag audit was
run. Post-failure exact package/version checks confirmed that all seven
`0.0.0-beta.0` package versions remained unpublished. No beta or latest
dist-tags were created or modified.

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

Prompt 127 no-publish validation passed:

- `pnpm docs:check`
- `pnpm test`
- `pnpm build`
- `pnpm lint`

The full publish validation stack passed before the latest publish attempt, but
registry smoke was intentionally skipped because `docs/beta-publish-result.md`
records `published: false`.

## Docs Update Status

Public docs reflect the current prepublish state:

- no public registry install instructions
- local workspace and local tarball smoke instructions only
- production language asset limitations documented
- provider proxy model documented as server-owned
- beta known issues documented in `docs/beta-known-issues.md`
- rollback guidance documented in `docs/beta-rollback-guidance.md`
- trusted-publishing setup documented in `docs/trusted-publishing-setup.md`

Rollback guidance: `docs/beta-rollback-guidance.md`.

## Trusted Publishing Readiness

Prepared repo-side items:

- `.github/workflows/npm-beta-publish.yml` exists.
- Workflow trigger is `workflow_dispatch` only.
- Workflow permissions include `contents: read` and `id-token: write`.
- Workflow uses Node 24 and verifies npm `11.5.1+`.
- Workflow does not reference `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
- Workflow requires `confirm_version=0.0.0-beta.0`.
- Workflow requires `confirm_dist_tag=beta`.
- Workflow publishes only when `publish=true`.
- Workflow rejects `push_git_tag=true` because the current permissions are
  intentionally read-only.
- Workflow checks exact package/version availability before publish.
- Workflow publishes approved tarballs in approved order with `--tag beta` and
  `--access public`.

External setup still required before running with `publish=true`:

- Configure npm Trusted Publisher for all seven packages.
- Configure GitHub environment `npm-beta` and approval rules if desired.
- Ensure the workflow file exists on the branch used for `workflow_dispatch`.
- If npm does not allow trusted-publisher setup before first package creation,
  stop and document the npm UI blocker rather than falling back to token publish.

## Known Limitations

- Manual beta approval is approved, but npm publish has not completed.
- The latest npm publish attempt failed on `@typai/ui` with `EOTP` before any
  package was published.
- No registry smoke has run.
- No Git tag has been created.
- Release package versions are prepared at `0.0.0-beta.0`.
- Root/private workspace package versions remain `0.0.0-dev`.
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

Current immediate decision: configure npm Trusted Publisher entries for all
seven packages and run the manual `npm beta publish` GitHub Actions workflow, or
explicitly choose a non-publish next phase. No feature phase should start without
that selection.
