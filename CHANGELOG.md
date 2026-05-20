# Changelog

Typai has not been published to npm yet. This changelog is a release-candidate
draft for the first public beta package line.

## Public Beta RC Draft

### MVP Foundations

- Added `@typai/core` as the local deterministic correction engine package.
- Added Rust/Wasm and C++ deterministic token checks behind a narrow C ABI.
- Added protected-token handling, tokenization helpers, storage interfaces,
  personal dictionary entries, always-correct rules, and never-correct rules.
- Added contenteditable correction with red unresolved marks and blue applied
  correction marks.
- Added the first simple browser demo, golden corpus tests, unit tests,
  Playwright E2E, and latency benchmark smoke.

### Public Alpha

- Added public-facing README and docs structure.
- Added package dry-run checks, smoke install, and basic release-readiness docs.
- Kept registry publishing out of scope.
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

### V4.2 Provider/Public Beta Readiness

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
- Completed the public beta RC hardening audit.

## Known Limitations

- No production dictionary/frequency asset is bundled.
- No npm package has been published.
- No valid-word or real-word/context autocorrection exists.
- No grammar, style, tone, clarity, local model inference, next-edit logging,
  browser extension, ProseMirror, Monaco, or real Codex adapter is included.
- Real provider completion is manual and opt-in through an embedder-controlled
  server boundary.
