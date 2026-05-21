# Changelog

This changelog records public Typai package history and the verified beta state.

## 0.0.0-beta.0 - 2026-05-20

First public npm beta for the Typai package set.

Registry state:

- Published on npm at `0.0.0-beta.0`.
- Intended install tag: `beta`.
- `latest` currently also points at `0.0.0-beta.0` because these were first
  publishes.
- Registry smoke passed from public npm packages.
- No public Git tag exists yet.
- The observed publish was manual npm tarball publish, not GitHub Actions OIDC
  trusted publishing.

Release package set:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`
- `@typai/ui`

Highlights:

- Ships `@typai/core` for local deterministic correction, suggestions, protected
  token handling, personal dictionary entries, correction rules, storage APIs,
  and host-provided Typai Dictionary Blob v1 loading.
- Ships contenteditable, textarea, React, and CodeMirror adapters for browser
  editor surfaces.
- Ships optional `@typai/completion-remote` for mock, noop, endpoint, scheduler,
  metrics, and mocked streaming completion paths.
- Keeps completion separate from `@typai/core`.
- Includes mock-first provider proxy examples for Express-style, Next-style, and
  Worker-style server endpoints.
- Includes the Intelligence Quality Foundation: conservative typo table,
  delete-index suggestions, valid-word safety, protected-token safety,
  spell-quality corpus checks, and latency gates.
- Includes release hardening: package dry-run, tarball audit, package secret
  scan, size report, install smoke, public beta smoke, and registry smoke.

Production language asset status:

- Production language asset remains **blocked / host-provided only**.
- No production dictionary binary is bundled.
- No production frequency table is bundled.
- No raw ESDB/SCOWL, Hunspell, or Google Books Ngram source files are bundled.
- `dictionary.mode: "production"` remains unavailable while manifest review is
  blocked.

Known limitations:

- Spell coverage is not production dictionary coverage.
- Valid-word and real-word/context autocorrection are not implemented.
- Grammar, style, tone, clarity, local model inference, next-edit logging,
  browser extension, ProseMirror, Monaco, and real Codex adapter work are not
  included.
- Real provider completion is manual and opt-in through an embedder-owned server
  endpoint.
- `@typai/ui` is a required support package and remains unstable as an
  independent design-system API.

## Public Beta Build-Up

### MVP Foundations

- Added `@typai/core` as the local deterministic correction engine package.
- Added Rust/Wasm and C++ deterministic token checks behind a narrow C ABI.
- Added protected-token handling, tokenization helpers, storage interfaces,
  personal dictionary entries, always-correct rules, and never-correct rules.
- Added contenteditable correction with red unresolved marks and blue applied
  correction marks.
- Added the first browser demo, golden corpus tests, unit tests, Playwright E2E,
  and latency benchmark smoke.

### Public Alpha

- Added public-facing docs structure.
- Added package dry-run checks, smoke install, and basic release-readiness docs.
- Preserved the local-first correction boundary with no server requirement for
  deterministic correction.

### Textarea Adapter

- Added `@typai/textarea` with textarea correction, overlay mark rendering, and
  stale-write protection.
- Added textarea-specific tests and E2E coverage.
- Documented textarea overlay limitations and mark behavior.

### Rich Editor Adapters

- Added React wrappers in `@typai/react`.
- Added CodeMirror 6 support in `@typai/codemirror`.
- Added shared adapter conformance coverage through `@typai/adapter-testkit`.
- Added CodeMirror code/Markdown protection behavior and exact correction
  revert support.

### Remote Completion

- Added optional `@typai/completion-remote`.
- Added mock, noop, endpoint, and mocked streaming provider paths.
- Added completion scheduling, bounded context collection, metrics, and
  cancellation behavior.
- Added contenteditable, textarea, React textarea, and CodeMirror ghost
  completion surfaces.
- Kept completion out of `@typai/core`.

### Provider/Public Beta Readiness

- Added provider proxy examples for Express, Next-style routes, and Cloudflare
  Worker-style handlers.
- Added provider proxy testkit coverage and safe server-side error contracts.
- Added real-provider smoke as an explicit manual opt-in path.
- Added package secret scanning, release dry-runs, public beta smoke, and
  public beta readiness CI.
- Kept automated tests, demos, E2E, smoke, and CI on mock provider paths.

### Intelligence Quality Foundation

- Expanded common typo coverage while keeping autocorrection table-driven.
- Added delete-index suggestions without enabling arbitrary delete-index
  autocorrection.
- Added spell-quality corpus and benchmark gates for autocorrect precision,
  suggestion recall, valid-word safety, protected-token safety, and direct core
  latency.
- Added source/asset policy docs and false-positive review docs.

### Production Language Asset RC

- Added production language asset RC scope and package policy docs.
- Pinned the preferred ESDB/SCOWL dictionary source path and Google Books Ngram
  frequency source path.
- Kept production asset ingestion blocked until unresolved manifest, hash,
  generated output, size, quality, and review gates pass.
- Added deterministic production transform pipeline in gated fixture mode.
- Added host-provided dictionary loading policy and reserved production mode.
- Expanded cross-surface spell-quality E2E.
- Added language asset performance, memory, package-size, package secret, and
  release dry-run gates.
