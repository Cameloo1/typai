# Production Asset Unblock Final Audit

Status date: 2026-05-21.

Final asset state: **production asset still blocked / host-provided only**.

This is the final hardening audit checkpoint for the Production Asset Unblock
phase. The source, manifest, transform, runtime loading, package policy,
quality, E2E, performance, and remediation gates are now in place and verified
for the blocked-host-provided branch. The production dictionary/frequency asset
itself is not approved for generation or package inclusion.

No npm publish occurred in this audit.

## Final Asset State

- Manifest review status: `blocked`.
- Dictionary source: English Speller Database / SCOWL v2 generated Hunspell
  `en_US`, release `2026.02.25`, source archive SHA-256 pinned.
- Frequency source: Google Books Ngram Viewer American English 2019 1-grams,
  `googlebooks-eng-us-20200217`; only `totalcounts-1` has a pinned SHA-256.
- License/attribution status: source direction is documented, but package-ready
  final notices remain incomplete while generation is blocked.
- Source hash status: dictionary source hash pinned; Google Ngram gzip
  partition hashes are missing.
- Generated output hash status: none, because no production asset was
  generated.
- Package inclusion status: `blocked`; selected delivery is host-provided only.
- Raw source policy: external only; raw ESDB/SCOWL, Hunspell, and Google Ngram
  source files are not committed or packed.
- Package size result: passed; `@typai/core` packed size is 49.11 KiB with no
  production binary or raw source files.
- Quality result: passed against the host-provided quality fixture; production
  quality remains unclaimed until an approved generated asset exists.

## What Was Added

Prompts 128, 131, 132, 133, 134, 135, 136, 137, and 138 added the production
asset gate stack without bundling a production asset:

- source selection and approval records
- production manifest and license/attribution placeholder structure
- manifest and asset-gate checks
- deterministic fixture-first transform pipeline
- blocked-host-provided fallback execution
- hardened Typai Dictionary Blob v1 runtime loading through TypeScript,
  Rust/Wasm, and C++
- FFI audit command
- package delivery policy and package size report
- structured spell-quality corpus and report generation
- cross-surface production spell parity E2E
- language asset, core, browser, package, smoke, and release gates
- remediation record for the final revision loop

## Source And License Audit

The blocked branch is truthful:

- No generated production dictionary or frequency asset exists.
- No production output path is recorded in the manifest.
- No raw source files are present in package tarballs.
- Blockers are documented in `docs/dictionary-asset-blockers.md` and
  `docs/production-asset-unblock-remediation.md`.
- Host-provided Typai Dictionary Blob v1 bytes are documented as the supported
  production-scale fallback.

The asset may not move to generation or package inclusion until every source
hash, license, attribution, generated-output, quality, size, package, and review
gate passes.

## Transform Pipeline Summary

The transform pipeline is ready for a future approved source set:

- Fixture transform is deterministic.
- Final fixture hash:
  `34e58d10f5f96fb6a591c1a82dc971ad2638a9ed88accb9fb10887f2d41da5ac`.
- Fixture output: 8 words, 185 bytes, 62.5% frequency coverage.
- Production transform fails closed while `review.status` is blocked.
- Source hash validation is required before production processing.
- Network fetch is disabled by default.
- Output metadata includes manifest/source hashes, generated output hash,
  excluded counts, coverage, and package inclusion state.
- Protected-looking tokens are filtered.
- Duplicate word and frequency handling are deterministic.

## Runtime Loading Summary

Allowed assets load only during `createTypaiCore()` initialization. The hot path
remains synchronous after initialization.

Verified runtime behavior:

- host-provided Blob v1 bytes load through TypeScript -> Rust/Wasm -> C++
- fixture and scaled-mock assets load through the same boundary
- blocked production mode fails with a clear unavailable error
- malformed, truncated, wrong-magic, wrong-version, unsupported-language, and
  duplicate assets fail safely
- failed loads do not replace the current loaded dictionary or delete index
- delete-index structures rebuild only after successful dictionary load
- stats expose loaded word count, byte size, delete-index entries, and memory
  estimate

## Engine And FFI Audit

`pnpm ffi:audit` passed.

The audit scanned 4 C++ native files, 18 C++ `extern "C"` declarations, 1 Rust
extern block, and 3 TypeScript bridge files. The allowed shape remains
caller-owned buffers, primitive counts, and pointer-plus-length inputs.

Forbidden shapes remain absent from the FFI boundary:

- no `std::string` crossing FFI
- no C++ heap ownership crossing JS/Rust
- no full document text passed into C++ token APIs
- no Emscripten or Embind
- no exported C++ classes

## Correction Safety Audit

`pnpm bench:spell-quality` passed.

- total corpus cases: 142
- allowed autocorrect pass rate: 100.00% (29/29)
- autocorrect precision: 100.00% (29/29)
- suggestion recall@1/@3/@5: 100.00% / 100.00% / 100.00%
- valid-word false autocorrect count: 0
- protected-token false write count: 0
- arbitrary delete-index autocorrect count: 0
- domain-term false autocorrect count: 0
- protected-token non-noop count: 0

Approved common typo autocorrections are explicit and tested. User
never-correct rules suppress common typo corrections, personal dictionary words
block correction, always-correct rules remain explicit, casing/punctuation
behavior is tested, and contraction/plural ambiguity remains conservative.

## Quality Corpus Summary

The structured corpus exists under `tests/spell-quality/corpus` and covers:

- approved common typo autocorrections
- suggestions-only misspellings
- valid-word traps
- protected technical terms
- casing and punctuation
- contractions
- plural and inflection ambiguity
- proper nouns
- trading and cybersecurity domain terms
- Markdown/code contexts
- regression bugs

The latest false-positive review reports no false-positive autocorrections, no
approved autocorrect misses, and no suggestion recall misses at 5. The harness
runs the large core corpus directly instead of sending every row through
Playwright, avoiding an unnecessary O(n^2) browser-level path.

## E2E And Surface Summary

`pnpm test:e2e` passed across Chromium and Firefox.

The surface parity matrix passes for:

- contenteditable
- textarea
- React textarea
- React contenteditable
- CodeMirror

Verified browser behavior includes exact revert, red unresolved marks, blue
correction marks, CodeMirror Markdown/code protection, personal dictionary,
always/never correction rules, stale/race guards, IME guards, and
completion/correction coexistence. Accepted completions remain completion
transactions, not blue correction marks.

## Package Inclusion Summary

`pnpm package:size-report`, `pnpm scan:package-secrets`, `pnpm pack:dry`,
`pnpm smoke:install`, `pnpm smoke:public-beta`, and `pnpm release:check` passed.

Tarballs obey the blocked-host-provided delivery policy:

- no production dictionary binary
- no production frequency table
- no raw ESDB/SCOWL, Hunspell, or Google Ngram source files
- no `.env` files or secrets
- no provider proxy examples in library tarballs
- no tests, reports, or debug dumps in library tarballs
- `@typai/core` contains only `README.md`, `dist`, `pkg`, and `package.json`

Public beta smoke verified packed-package imports, minimal correction,
host-provided dictionary bytes, blocked production mode, mock completion,
endpoint completion against a mock proxy, no `@typai/core` ->
`@typai/completion-remote` dependency, no browser API key path, and no real
provider calls.

## Benchmark Summary

Hard performance gates passed.

Language asset benchmark:

- production state: blocked
- host-provided mock asset: 422 bytes, 20 loaded words
- scaled mock asset: 77.34 KiB, 3,600 loaded words, 58,803 delete-index entries
- scaled mock load p95: 17.3076 ms
- `@typai/core` packed size: 49.11 KiB
- warnings: none
- failures: none

Core benchmark:

- built-in check p95: 0.0068 ms
- built-in suggest p95: 0.0046 ms
- host-provided check p95: 0.0068 ms
- host-provided suggest p95: 0.0044 ms
- loaded scaled-mock check p95: 0.0067 ms
- loaded scaled-mock suggest p95: 0.0057 ms
- failures: none

Browser benchmark:

- deterministic correction p95 stayed below the 20 ms warning threshold on all
  measured Chromium and Firefox surfaces.
- mocked completion stayed below the 2,000 ms hard failure threshold.
- warning-level mocked completion p95 rows above the 800 ms target remain
  documented for textarea and CodeMirror-style surfaces.

Build also still reports Vite chunk-size warnings for demo/consumer bundles;
those are warning-level and are recorded in the remediation doc.

## Full Validation

The final audit ran the requested gate set using the repo-local pnpm shim
because plain `pnpm` was not on this PowerShell PATH:

- `pnpm dictionary:check-production`: passed
- `pnpm dictionary:gate-status`: passed
- `pnpm --filter @typai/core build:dictionary:fixture`: passed
- `pnpm --filter @typai/core validate:dictionary:production`: passed
- `pnpm --filter @typai/core inspect:dictionary`: passed
- `pnpm ffi:audit`: passed
- `pnpm bench:spell-quality`: passed
- `pnpm bench:language-asset`: passed
- `pnpm package:size-report`: passed
- `pnpm scan:package-secrets`: passed
- `pnpm --filter @typai/core bench`: passed
- `pnpm bench:browser`: passed with documented warning-level mocked completion
  rows
- `pnpm test`: passed
- `pnpm test:e2e`: passed
- `pnpm pack:dry`: passed
- `pnpm smoke:install`: passed
- `pnpm smoke:public-beta`: passed
- `pnpm release:check`: passed
- `pnpm docs:check`: passed
- `pnpm build`: passed with documented Vite chunk-size warnings
- `pnpm lint`: passed

## Remediation Summary

Prompt 138 closed one real E2E harness issue: the Firefox contenteditable
completion stale/provider-error scenario now waits for the remote completion
debug state to return to `idle` before arming the provider-error assertion.

Prompt 138 also recorded environment-only elevated execution requirements for
Wasm, package dry-run, npm-cache, and Playwright server paths on this Windows
checkout, plus the remaining warning-level browser completion and Vite chunk
size observations.

## Known Limitations

- Production language asset generation remains blocked.
- Google Ngram gzip partition SHA-256 values are missing.
- Generated production output hash, word count, byte size, and quality evidence
  do not exist yet.
- Final package-visible production notices do not exist because no generated
  production asset is included.
- The host-provided quality fixture and scaled mock are not production language
  coverage.
- Valid-word/context autocorrection remains out of scope.
- Grammar, style, tone, clarity, local model inference, next-edit logging, real
  Codex adapter, browser extension, ProseMirror, and Monaco remain separate
  future phases.

## Preserved Non-Goals

- No npm publish in this prompt.
- No production asset generation.
- No unclear-license asset bundling.
- No raw source files committed or packed.
- No correction/autocorrect behavior expansion.
- No real provider calls in tests, demos, E2E, smoke, or CI.
- No browser provider API key path.
- No next-edit logging.
- No local model inference.
- No real Codex adapter.
- `@typai/core` remains local deterministic correction only and does not import
  `@typai/completion-remote`.

## Next Recommended Phase Options

Choose one explicit next phase:

1. Beta publish continuation if further registry or dist-tag work is desired.
2. Real Codex Adapter Foundation.
3. Apple-style Personalization.
4. Grammar/style Async Editor.
5. Production asset follow-up to capture missing source hashes and re-review
   the manifest.
6. Path B Local Completion Research.
7. ProseMirror/Monaco implementation.
8. Browser extension.

Production asset follow-up is the only option that should change the current
blocked-host-provided language asset state.
