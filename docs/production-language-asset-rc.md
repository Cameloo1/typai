# Production Language Asset + Beta Release Candidate

Status date: 2026-05-21.

Completion status: complete in the blocked-production-asset public beta RC
state. This phase prepared Typai for a production language asset release
candidate and public beta candidate without publishing to npm.

Final checkpoints:

- `docs/production-language-asset-rc-complete.md`
- `docs/production-asset-unblock-complete.md`

## Current Foundation State

The Intelligence Quality Foundation is complete. Typai currently has:

- local deterministic correction in `@typai/core`
- optional remote completion in `@typai/completion-remote`
- contenteditable, textarea, React, and CodeMirror surfaces
- safe expanded common-typo autocorrect gates
- delete-index candidate suggestions
- cross-surface spell-quality coverage
- quality benchmark gates for protected-token writes, valid-word safety,
  autocorrect precision, suggestion recall, and direct core latency
- scaled mock and host-provided asset loading paths
- expanded Prompt 112 spell-quality corpus for common typos,
  suggestions-only misspellings, valid-word traps, protected technical tokens,
  acronyms, proper nouns, domain terms, and completion coexistence
- cross-surface E2E parity across contenteditable, textarea, React textarea,
  React contenteditable, and CodeMirror for the production/host-provided asset
  path boundaries
- Prompt 135 structured spell-quality corpus with safety gates for approved
  common typos, suggestions-only misspellings, valid-word traps, protected
  tokens, casing/punctuation, contractions, plural ambiguity, proper nouns,
  domain terms, Markdown/code contexts, and regressions
- Prompt 136 corpus-backed surface parity E2E across contenteditable,
  textarea, React textarea, React contenteditable, and CodeMirror, recorded in
  `reports/spell-quality/surface-parity.md`
- Prompt 137 performance, memory, package-size, and browser benchmark hardening
  with machine-readable language-asset, core, browser, and package-size gate
  output
- a deterministic production dictionary transform pipeline with fixture mode,
  production gates, source-hash verification, Blob v1 output, metadata, and
  inspection commands
- manual/env-gated real-provider demo support through a secure proxy

The current implementation does not bundle a production dictionary or frequency
asset. The scaled mock asset remains a loader and performance stress fixture,
not language coverage.

`pnpm bench:spell-quality` uses an in-memory host-provided quality fixture so
the corpus can measure valid-word, proper-noun, and domain-term safety without
generating or packing a production language asset.

## What Remains Blocked

Production asset ingestion remains blocked until the asset PR proves:

- exact upstream source pins and retrieval dates
- raw input SHA-256 hashes
- pinned local source file paths for every production input
- generated output SHA-256 hashes
- full license and redistribution evidence
- package-visible attribution
- deterministic transform commands
- manifest counts, sizes, and package-inclusion decision
- package-size and performance evidence
- spell quality and false-positive evidence against the generated asset
- named review signoff

No generated production dictionary, frequency table, raw corpus, or derived
asset may be committed, packed, published, or claimed as shipped until those
gates pass.

The Prompt 131 transform pipeline exists at
`packages/core/scripts/build-production-dictionary.mjs`. In the current blocked
state, `pnpm --filter @typai/core build:dictionary:production` fails before
processing. `pnpm --filter @typai/core build:dictionary:fixture` exercises the
full transform against repo-local fixtures, and
`pnpm --filter @typai/core validate:dictionary:production` accepts blocked
state only when no production output is present and blockers are documented.

Prompt 132 executed the blocked-host-provided branch. It confirmed
`build:dictionary:production` fails closed on the blocked manifest, kept
production output absent, and recorded the current fallback state in
`docs/production-asset-status-report.md`.

Prompt 133 hardened production/host-provided runtime loading while the branch
remains blocked-host-provided. Host-provided, fixture, and scaled-mock Blob v1
bytes load through TypeScript -> Rust/Wasm -> C++ during `createTypaiCore()`
initialization only. Failed blocked-production or malformed host-provided loads
do not replace the currently loaded C++ dictionary/delete-index state.
Runtime diagnostics now include loaded dictionary word count, loaded dictionary
byte size, delete-index entry count, and delete-index memory estimate. The
`pnpm ffi:audit` command checks the FFI boundary for forbidden `std::string`,
heap ownership transfer, Embind/Emscripten bindings, exported C++ classes, and
full-document text pass-through patterns.

Prompt 111 keeps package inclusion as **excluded from `@typai/core` and
host-provided only** while production approval is blocked. The package does not
include `packages/core/assets/production/`, raw source files, generated
production binaries, or generated frequency tables. `dictionary.mode:
"production"` is reserved for a future approved asset and currently throws a
clear unavailable error during `createTypaiCore()` initialization.

Prompt 136 keeps the branch blocked-host-provided and expands browser-level
spell parity against representative corpus rows. It fixed contenteditable
punctuation mark persistence and in-progress URL protection without changing
core autocorrect rules or production asset availability.

Prompt 137 keeps the branch blocked-host-provided and hardens the measurable
release gates. `pnpm bench:language-asset` now reads the authoritative
production `MANIFEST.json`, reports built-in, host-provided, scaled-mock, and
blocked/production asset status, and emits a parseable
`language-asset-benchmark-json` line. `pnpm --filter @typai/core bench` emits
`core-benchmark-json`, and browser latency smoke emits per-surface
`browser-benchmark-json` lines while keeping deterministic correction
thresholds separate from mocked completion thresholds.

Prompt 138 completed the remediation loop for this blocked branch. It fixed one
E2E harness race in the Firefox contenteditable completion stale/provider-error
scenario and reran the full audit gate set.

Prompt 139 completed the final Production Asset Unblock hardening audit. The
final asset state remains **production asset still blocked / host-provided
only**. The final checkpoint verifies source/license truthfulness, fixture
transform determinism, fail-closed production transform behavior, hardened
runtime loading, FFI boundary checks, correction safety gates, quality corpus,
surface parity, package inclusion/exclusion, package scans, performance gates,
and no npm publish during the audit.

## Phase Scope

This phase covers:

- production dictionary and frequency source pinning
- asset manifest and attribution files
- deterministic transform pipeline
- production asset generation or explicit continued blocked-state docs
- C++/Rust/Wasm loading with the production asset after gates pass
- package inclusion policy for `none`, `optional`, or `bundled`
- cross-surface spell quality expansion
- package-size, memory, and performance gates
- public beta RC docs and version plan
- final production asset and beta RC hardening audit

## Non-Goals

- no npm publish
- no real Codex adapter
- no grammar, style, tone, or clarity engine
- no local model inference
- no next-edit logging
- no browser extension
- no ProseMirror or Monaco implementation
- no valid-word autocorrect
- no real-word or context autocorrect
- no arbitrary delete-index or SymSpell autocorrect
- no unclear-license asset bundling
- no browser-held provider credential path
- no real provider calls in tests, demos, E2E, smoke, or CI
- no weakening of current safety gates

## Hard Boundaries

- `@typai/core` remains local deterministic correction only.
- `@typai/core` must not import `@typai/completion-remote`.
- Completion remains optional.
- Mock provider behavior remains default.
- Valid words are never autocorrected.
- Protected tokens are never autocorrected.
- Delete-index candidates remain suggestions-only unless explicitly listed in
  the approved common typo table.
- Blue marks mean Typai changed text through correction.
- Accepted completions are not blue correction marks.
- Static language assets stay separate from personal, user, and project
  dictionary memory.
- Dictionary assets load only during `createTypaiCore()` initialization. Token
  checking and suggestions stay synchronous after initialization.
- A production asset cannot be bundled unless license, redistribution,
  attribution, manifest, source hash, transform, size, quality, and review
  gates pass.

## Asset Approval Gates

Every production dictionary, frequency, or combined asset must include:

- official source URL for every input
- exact source version, corpus identifier, release tag, commit, or durable pin
- retrieval date and SHA-256 for every raw source file
- full license or durable official notice link
- explicit redistribution, commercial-use, and modification evidence
- package-ready attribution text and any required notice file
- deterministic transform script and command
- generated output format and SHA-256
- word count, frequency row count, compressed size, and uncompressed size
- package inclusion policy: `none`, `optional`, or `bundled`
- update and rollback process
- reviewer, review date, and review status

If any gate is missing, unclear, or contradictory, package inclusion remains
`none`.

## Implementation Sequence

1. Preserve the current correction and completion boundaries before touching
   asset code.
2. Refresh the production asset recap and gate-status check.
3. Reconfirm the approved ESDB/SCOWL and Google Books Ngram source pins before
   any generated output is promoted.
4. Use the deterministic transform pipeline to process only approved pinned
   local inputs. While blocked, keep the fixture transform as the only runnable
   path.
5. Emit manifest and attribution artifacts for review before package inclusion.
6. Load the generated asset through the existing C++/Rust/Wasm dictionary blob
   boundary and keep malformed-load recovery intact.
7. Decide package inclusion using measured compressed and uncompressed size.
   Current blocked-state decision is `none`: do not include assets in
   `@typai/core`; use host-provided assets only.
8. Keep the Prompt 112 spell-quality and false-positive corpora passing. When
   a generated production asset exists, re-run the same corpus against that
   asset before any package inclusion change.
9. Run package dry-run, smoke install, public beta smoke, docs, lint, test, and
   build gates.
10. Record the version plan and public beta RC docs without publishing.
11. Finish with a hardening audit covering asset provenance, package contents,
    quality behavior, completion boundaries, privacy, and release risk.

## Acceptance Gates

This phase cannot be called RC-ready until:

- production asset manifest and attribution exist, or blocked state is
  explicitly recorded
- generated production outputs are absent unless all approval gates pass
- raw upstream corpus files are absent from Git and package tarballs
- `@typai/core` still has no dependency on `@typai/completion-remote`
- mock providers remain the automated default
- valid-word and protected-token autocorrections remain zero
- arbitrary delete-index candidates remain suggestions-only
- accepted completions do not create blue correction marks
- C++/Rust/Wasm asset loading passes malformed, duplicate, unsupported,
  protected-looking, and clear/reload tests
- package smoke proves asset inclusion matches the package policy
- docs describe only verified behavior
- no npm publish has occurred

## Package-Size And Performance Targets

Package inclusion policy:

- Current state: production assets are **host-provided only** and excluded from
  `@typai/core`.
- Prompt 134 package delivery decision: **C. host-provided only** for language
  assets, with production mode blocked until the manifest review and package
  inclusion fields are approved.
- Prompt 132 branch: **blocked-host-provided**; no generated production output
  exists and package inclusion remains blocked.
- `@typai/core` may include only `dist`, generated Wasm `pkg`, package
  metadata, and `README.md` while `review.status` is blocked.
- Production dictionary/frequency binary inclusion requires approved manifest,
  license, attribution, generated output hash, size evidence, and review
  signoff.
- Raw ESDB/SCOWL, Hunspell, Google Ngram, or frequency source files are never
  allowed in package tarballs unless a future approved manifest explicitly
  changes that policy.

Package-size targets and thresholds:

- target production generated asset size: <= 2 MiB compressed/package impact
- generated asset hard failure threshold: > 8 MiB
- blocked-state `@typai/core` tarball warning threshold: > 256 KiB
- blocked-state `@typai/core` tarball failure threshold: > 1 MiB
- general package tarball warning threshold: > 512 KiB
- general package tarball failure threshold: > 2 MiB
- raw Google Ngram inputs in Git/package tarballs: 0 bytes
- raw dictionary source files such as `.dic`, `.aff`, `.gz`, `.tsv`, and `.zip`
  in package tarballs: 0 bytes
- `.env` files, provider secrets, and private-key-looking payloads in package
  tarballs: 0

Initial performance targets:

- direct core token p95 warning threshold: 20 ms
- direct core token p95 failure threshold: 100 ms
- language asset load/delete-index p95 warning threshold: 250 ms
- language asset load/delete-index p95 failure threshold: 1000 ms
- delete-index memory estimate warning threshold: 8 MiB
- delete-index memory estimate failure threshold: 32 MiB
- protected-token writes: 0
- valid-word autocorrections: 0
- autocorrect precision: at least 99% on the committed corpus
- suggestion recall: warn below 90%
- browser correction p95 warning/failure thresholds: 20 ms / 100 ms
- mocked browser completion p95 warning/failure thresholds: 800 ms / 2000 ms

Memory evidence must include inspectable dictionary word count, delete-index
entry count, generated asset byte size, package dry-run contents, and packed
tarball byte sizes.

Current blocked-state package and asset measurements are produced by:

```sh
pnpm bench:language-asset
pnpm package:size-report
```

The language asset benchmark reports built-in, host-provided mock, scaled mock,
and approved production asset mode when available. It includes asset byte size,
manifest word count, loaded word count, dictionary load mean/p50/p95/p99,
initialization-inclusive delete-index build mean/p50/p95/p99, core
check/suggest mean/p50/p95/p99, delete-index memory estimate, and
`@typai/core` tarball impact. The package size report fails if blocked
production assets, raw source files, `.env` files, secret-like payloads, or
production binaries without package-visible manifest, license, and attribution
appear in packed output.

`docs/language-asset-delivery-policy.md` is the current package delivery
decision record for production, host-provided, prepack-generated, bundled, and
future language-pack delivery modes.

## RC Readiness Definition

The beta release candidate is ready only when:

- source, license, transform, attribution, manifest, size, quality, and review
  gates are either passed or explicitly blocked
- package inclusion policy is recorded and verified by dry-run contents
- all requested verification commands pass locally
- public docs distinguish mock, host-provided, optional, and bundled asset
  states without overclaiming
- release/version docs identify the next publish step but do not publish
- the final hardening audit confirms preserved correction/completion/privacy
  boundaries
