# Intelligence Quality Foundation Complete

Status date: 2026-05-19.

This checkpoint closes the Intelligence Quality Foundation phase. It audits the
spell-quality, dictionary, completion, package, and privacy boundaries added in
Prompts 99 through 106. It does not publish Typai, add new intelligence
features, add provider calls to automation, or promote a production dictionary
asset.

## What Was Added

- Prompt 99: phase scope, baseline diagnosis, non-goals, and future gates.
- Prompt 100: dictionary and frequency source review, asset policy, approval
  status, and remaining blockers.
- Prompt 101: hardened dictionary blob loading plus scaled mock and
  host-provided asset paths.
- Prompt 102: C++ delete-index candidate generation for suggestions.
- Prompt 103: expanded explicit common typo table, ranking, reason codes,
  casing and punctuation preservation, contraction suggestions, and plural
  ambiguity handling.
- Prompt 104: cross-surface spell-quality E2E for contenteditable, textarea,
  React textarea, React contenteditable, and CodeMirror.
- Prompt 105: optional proxy-routed completion demo path, still manual and
  server-side for real provider calls.
- Prompt 106: spell-quality benchmark, false-positive review report, and CI
  quality gates.

## Dictionary And Asset Status

The approved source path is documented, but no production language asset is
bundled.

- Approved dictionary source path: English Speller Database / SCOWL v2,
  official non-Australian `en-US` size 60, release `2026.02.25` / `[7e99eda]`.
- Approved frequency source path: Google Books Ngram Viewer American English
  2019 unigrams, corpus identifier `googlebooks-eng-us-20200217`.
- Asset ingestion status: blocked until manifest, transform, raw-input hashes,
  generated-output hashes, attribution, size, quality, and review gates pass.
- Checked-in runtime fixture: `packages/core/assets/mock-en-us.dictionary.bin`
  plus JSON companion, explicitly mock-only.
- Generated scaled mock path: ignored files under
  `packages/core/assets/generated/`, explicitly `mockOnly: true` and
  `production: false`.
- Host-provided asset path: documented through `createTypaiCore({ dictionary })`
  and still subject to Typai Dictionary Blob v1 validation.

The source/license audit passes for the current repository state because no
unclear-license production dictionary or frequency asset is committed, packed,
or claimed as shipped.

## Candidate Generation Status

The C++ engine builds a deterministic delete index from the loaded dictionary
fixture and built-in fallback words. The index is used for suggestions, not as
an automatic correction source.

Current native constraints:

- C ABI uses primitive returns and caller-owned buffers.
- No `std::string` crosses FFI.
- No C++ heap ownership crosses into Rust or JavaScript.
- No full document text is passed into native token APIs.
- Delete-index storage is owned inside the native engine.
- Malformed blobs are rejected without replacing the current dictionary/index.
- Dictionary and delete-index clear paths are covered by native tests.

## Ranking And Autocorrect Gate Status

Autocorrect remains explicit and conservative:

- Valid words are never autocorrected.
- Protected tokens are never autocorrected.
- Delete-index and edit-distance candidates remain suggestions-only unless the
  token is explicitly listed in `docs/common-typo-table.md`.
- Expanded common typo entries are exact table entries and test covered.
- User never-correct rules override the expanded common typo table.
- Personal dictionary entries block correction.
- User always-correct rules still work as explicit user rules.
- Casing and trailing punctuation are preserved for approved autocorrections.
- Contractions and plural ambiguities stay suggestions-only unless separately
  approved in a future phase.

`pnpm bench:spell-quality` is the live safety gate for protected-token writes,
valid-word autocorrections, autocorrect precision, suggestion recall, and direct
core latency.

## Cross-Surface Quality Status

The Prompt 104 parity matrix covers:

- contenteditable
- textarea
- React textarea
- React contenteditable
- CodeMirror

Covered behavior:

- expanded typos autocorrect where approved
- suggestions-only typos stay red until user action
- protected tokens remain unchanged
- valid words remain unchanged
- exact revert remains available for blue corrections
- personal dictionary, always-correct, and never-correct flows remain active
- CodeMirror protects inline and fenced Markdown code contexts
- completion and correction coexist without accepted completions becoming blue
  correction marks

## Real-Provider Demo Status

The real-provider completion path is a manual local demo path routed through
the provider proxy boundary.

- Mock remains the default provider mode.
- Browser code configures an endpoint, not a private provider credential.
- Real OpenAI Responses calls are server-side only.
- Manual real-provider smoke requires explicit environment gates and a server
  key.
- Automated tests, E2E, browser benchmarks, smoke scripts, CI, and public-beta
  smoke use mock providers or mocked proxy routes.

## Benchmark And Validation Status

Prompt 107 validation on 2026-05-19 ran the full local stack requested by the
phase contract:

- `pnpm bench:spell-quality`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm --filter @typai/core bench`
- `pnpm bench:browser`
- `pnpm pack:dry`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm scan:package-secrets`
- `pnpm release:check`
- `pnpm build`
- `pnpm lint`

The spell-quality benchmark reported zero protected-token false writes and zero
valid-word false autocorrections in this validation run. Browser and core
benchmarks passed their hard failure thresholds; any timing values should be
read from the command output for the machine that ran the validation.

## Safety Audit Summary

- Source/license: passes for current state; production asset ingestion remains
  blocked by policy gates.
- Engine/FFI: passes current static and test audit; caller-owned buffers and
  primitive returns remain the boundary.
- Correction safety: passes current benchmark and tests; protected-token writes
  and valid-word autocorrections remain zero.
- Surface parity: passes current E2E matrix across implemented surfaces.
- Completion boundary: passes current package, E2E, smoke, and secret-scan
  gates; real provider use is manual and env-gated.
- Metrics/privacy: no next-edit logging exists; spell-quality reports and
  debug tables use token/case summaries, counts, reason codes, and redacted or
  length-based completion metrics rather than full-document telemetry.

## Known Limitations

- No production dictionary or frequency asset is bundled.
- Scaled mock assets test loading and ranking mechanics, not real language
  coverage.
- Suggestion recall is still limited by the tiny default dictionary fixture.
- No real-word or context-aware autocorrection exists.
- No grammar, style, tone, or clarity engine exists.
- Local model inference remains absent.
- No next-edit logging exists.
- No real Codex adapter exists.
- No ProseMirror, Monaco, or browser extension implementation exists.
- No npm publish has occurred in this checkpoint.

## Preserved Non-Goals

- No arbitrary delete-index or SymSpell autocorrect.
- No valid-word autocorrect.
- No protected-token writes.
- No browser-held private provider credential path.
- No direct browser call to a model provider.
- No real provider calls in tests, demos, E2E, browser benchmarks, smoke, or CI.
- No provider dependency or remote completion import in `@typai/core`.
- No local model inference.
- No next-edit logging.
- No production dictionary asset without manifest and review approval.
- Blue marks remain correction marks only.
- Accepted completions remain completion transactions, not blue correction
  marks.

## Next Recommended Phase Options

- Actual npm publish, if the current quality level is acceptable for a public
  beta and manual approval is recorded.
- Production dictionary asset ingestion, if the remaining manifest, transform,
  hash, attribution, size, quality, and review blockers are resolved.
- Apple-style personalization for local user memory and reviewable correction
  preferences.
- Async grammar/style editor work as a separate non-core feature lane.
- Real Codex adapter integration after the reusable product surface remains
  stable.
- Path B local completion research, still separate from deterministic
  correction and without next-edit logging by default.
