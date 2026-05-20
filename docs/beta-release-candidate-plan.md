# Public Beta Release Candidate Plan

Status date: 2026-05-20.

This document is now a historical release-candidate record plus the current
post-publish state. It should not be read as a pending publish plan.

## Current State

- Approved version: `0.0.0-beta.0`.
- Approved npm dist-tag: `beta`.
- Approved Git tag: `v0.0.0-beta.0`.
- npm publish state: published.
- Registry smoke: passed from public npm packages.
- Git tag state: no local or pushed beta tag exists.
- Production language asset state: blocked / host-provided only.

The observed publish was a manual npm tarball publish, not GitHub Actions OIDC
trusted publishing. The trusted-publishing workflow exists for future release
operations but was not used for this beta.

## Published Package Set

Public beta packages:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`

Private workspace packages, provider examples, consumer examples, and testkit
packages remain unpublished.

## Approved Publish Order

1. `@typai/ui`
2. `@typai/core`
3. `@typai/completion-remote`
4. `@typai/contenteditable`
5. `@typai/textarea`
6. `@typai/react`
7. `@typai/codemirror`

The package order matters because support and dependency packages should exist
before dependent adapters are published.

## Dist-Tag State

- `beta` points to `0.0.0-beta.0`.
- `latest` also points to `0.0.0-beta.0`.

The `latest` tag points at the beta because these were first publishes. Do not
move or remove dist-tags without an explicit release decision and a registry
verification pass.

## Package Stability

| Package | Beta Status |
| --- | --- |
| `@typai/core` | beta for local deterministic correction, storage, rules, suggestions, and host-provided dictionary loading |
| `@typai/contenteditable` | beta for `contenteditable` correction and optional completion-controller integration |
| `@typai/textarea` | beta for textarea correction, overlay marks, and optional ghost completion |
| `@typai/react` | beta wrappers, hooks, provider, and debug/settings surfaces |
| `@typai/codemirror` | beta CodeMirror 6 extension |
| `@typai/completion-remote` | beta optional completion helpers; separate from core |
| `@typai/ui` | required support package; unstable as an independent design-system API |

## Asset Inclusion Status

Production language assets remain blocked:

- no production dictionary binary is bundled
- no production frequency table is bundled
- no raw ESDB/SCOWL, Hunspell, or Google Books Ngram source files are bundled
- `dictionary.mode: "production"` is unavailable while manifest review is
  blocked
- host-provided Typai Dictionary Blob v1 bytes remain the supported external
  asset path

## Known Limitations

- Spell coverage is not production dictionary coverage.
- Delete-index candidates remain suggestions unless explicitly promoted into
  the common typo table.
- Valid-word and real-word/context autocorrection are not implemented.
- Real provider completion is manual and server-side only.
- No real Codex adapter, grammar/style layer, local inference, next-edit
  logging, browser extension, ProseMirror adapter, or Monaco adapter is included.

## Release Evidence

Use these docs for current proof:

- [Beta publish result](./beta-publish-result.md)
- [Beta registry smoke](./beta-registry-smoke.md)
- [Beta publish complete](./beta-publish-complete.md)
- [Beta tarball audit](./beta-tarball-audit.md)
- [Production asset gate recap](./production-asset-gate-recap.md)

## Future Release Rules

For a beta patch or next release:

1. Keep public history intact.
2. Bump to a new prerelease version such as `0.0.0-beta.1`.
3. Re-run package contents, secret, size, install-smoke, public-beta-smoke, and
   registry-smoke checks.
4. Move `beta` only after replacement registry smoke passes.
5. Move or remove `latest` only through an explicit release gate.
6. Do not bundle production language assets until every asset approval gate
   passes.
