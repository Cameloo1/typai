# Public Beta Release Candidate Plan

Status date: 2026-05-19.

This plan records the current public beta release candidate path for Typai. It
does not publish packages, create registry tags, or claim that production
language assets are bundled.

## Target Version And Tag Plan

- Current workspace package version: `0.0.0-dev`.
- Default dry-run target version: `0.0.0-beta.0`.
- Proposed npm dist-tag after manual approval: `beta`.
- Proposed Git tag after manual approval: `v0.0.0-beta.0`.
- Versioning rule: all release packages move together from `0.0.0-dev` to the
  approved beta version during the real release step.

The current release scripts are dry-run only for this checkpoint:

- `pnpm release:version:dry` prints the package version changes it would make.
- `pnpm release:pack` creates local release tarballs only.
- `pnpm release:publish:dry` prints publish order and does not execute
  `npm publish`.

## Package List

Public beta package candidates:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`, packed because React and CodeMirror packages depend on it. It is
  support-grade, not a stable public design-system promise.

Private workspace packages and examples remain unpublished unless a later
release prompt changes the boundary.

## Package Stability Status

- `@typai/core`: beta candidate for local deterministic correction, memory
  APIs, host-provided dictionary loading, and Typai Dictionary Blob v1 loading.
- `@typai/contenteditable`: beta candidate for contenteditable correction and
  optional structural completion controller integration.
- `@typai/textarea`: beta candidate for textarea correction, overlay marks, and
  optional ghost completion integration.
- `@typai/react`: beta candidate wrappers for textarea and contenteditable
  surfaces.
- `@typai/codemirror`: beta candidate CodeMirror 6 extension with correction
  and optional completion controller support.
- `@typai/completion-remote`: beta candidate optional completion scheduler and
  providers. It remains separate from `@typai/core`.
- `@typai/ui`: support package required by public packages; unstable as an
  independent consumer API.

## Asset Inclusion Status

Production language asset status: **blocked and host-provided only**.

- No production dictionary binary is committed or packed.
- No production frequency table is committed or packed.
- No raw ESDB/SCOWL, Hunspell, or Google Books Ngram source files are committed
  or packed.
- `dictionary.mode: "production"` is reserved and unavailable while the
  manifest review status is blocked.
- Host-provided Typai Dictionary Blob v1 bytes may be loaded during
  `createTypaiCore()` initialization.
- The scaled mock asset is a generated loader/performance fixture only.

Production asset inclusion may be revisited only after manifest, license,
attribution, source hash, transform, generated output hash, size, quality, and
review gates pass.

## Known Limitations

- The production dictionary/frequency asset is not bundled.
- Spell coverage is safer than earlier foundations but is not product-grade
  dictionary coverage.
- Delete-index candidates remain suggestions unless a token is explicitly in
  the approved common typo table.
- Valid-word and real-word/context autocorrection are out of scope.
- Grammar, style, tone, clarity, local model inference, next-edit logging,
  browser extension work, and real Codex adapter work are out of scope.
- Real provider completion remains manual and server-side through an
  embedder-owned proxy path.

## Release Checklist

Before any actual beta publish:

1. Confirm `git status --short` is clean.
2. Review `docs/production-language-asset-rc-complete.md`.
3. Review `docs/dictionary-production-approval.md` and
   `docs/dictionary-asset-blockers.md`.
4. Run the full validation stack from `docs/release-checklist.md`.
5. Confirm packed tarballs contain expected files only.
6. Confirm no blocked production assets, raw source files, `.env` files, or
   secret-like payloads appear in package output.
7. Confirm real-provider smoke remains manual and opt-in.
8. Choose the final beta version and npm dist-tag.
9. Record explicit manual approval for npm publish.

## Manual Approval Requirements

Manual approval is required before:

- changing package versions in source control
- creating a public Git tag
- publishing to npm
- switching from dry-run package artifacts to registry artifacts
- adding bundled production language assets

The release operator must explicitly approve the package version, dist-tag,
publish order, package contents, source/license state, and rollback plan.

## Rollback Plan

If beta packaging or a post-publish smoke fails after manual approval:

- Deprecate or unpublish only when npm policy and elapsed time allow it.
- Publish a corrected beta patch such as `0.0.0-beta.1` when deprecation is not
  enough.
- Keep previous Git tag and commit evidence intact; do not rewrite public
  release history.
- Re-run package smoke, public beta smoke, package secret scan, package size
  report, and release dry-runs before the replacement publish.
- If an asset inclusion issue is found, remove the asset path and return to
  host-provided-only behavior before the next beta.

## Changelog Summary

The beta candidate contains:

- MVP local deterministic correction foundations.
- Public alpha package and demo readiness.
- Textarea adapter and overlay.
- Rich editor adapters for React and CodeMirror.
- Optional remote completion in a separate package.
- V4.2 provider proxy and public beta readiness rails.
- Intelligence Quality Foundation spell-quality gates.
- Production Language Asset RC gates with production assets still blocked.

## Docs Links

- `README.md`
- `CHANGELOG.md`
- `docs/release-checklist.md`
- `docs/package-readiness.md`
- `docs/production-language-asset-rc.md`
- `docs/production-language-asset-rc-complete.md`
- `docs/dictionary-production-approval.md`
- `docs/dictionary-asset-blockers.md`
- `docs/spell-quality-report.md`
