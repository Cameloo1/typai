# Intelligence Quality Foundation

Status date: 2026-05-19.

Prompt 99 starts the quality phase after V4.2 Provider + Public Beta
Readiness. V4.2 made Typai safe to package, test, document, and route through
server-side provider rails. It did not make the local spell engine broadly
intelligent.

## Current State After V4.2

V4.2 is complete at checkpoint
`51b3067 feat: complete v4.2 provider public beta readiness`.

Current package readiness covers:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/ui`
- `@typai/react`
- `@typai/codemirror`
- `@typai/adapter-testkit`
- `@typai/completion-remote`
- provider proxy test and example utilities

Completion works structurally across contenteditable, textarea, React, and
CodeMirror through mocked providers and secure provider proxy rails. Provider
examples default to mock mode. Server-side OpenAI Responses examples are
environment-gated. Tests, demos, E2E, smoke scripts, and CI do not make real
provider calls.

`@typai/core` remains local deterministic correction only. It does not import
`@typai/completion-remote`, does not call a server, and does not run local model
inference.

## Why Spellcheck Feels Weak

The current local spell intelligence is intentionally thin:

- five built-in common typo autocorrections
- a tiny built-in valid-word list
- a 20-entry mock dictionary/frequency fixture used for loader and ranking
  tests
- edit-distance suggestions over tiny word sources only
- no production dictionary or frequency asset
- no SymSpell/delete index or equivalent scalable candidate generation
- no expanded common typo map
- no broad casing, plural, contraction, or morphology handling
- no product-scale false-positive review corpus

That means Typai can prove the correction pipeline and safety boundaries, but
it cannot yet feel like a high-coverage spellchecker.

## Why Completion Is Structurally Correct But Not Product-Smart

Remote completion has the right boundaries: optional package, bounded context,
mock-first providers, endpoint-provider shape, server-side credential handling,
metrics, and cross-surface ghost text. The default local demos still use mock
providers, and the real-provider path is a manual server-side example path.

This is product-safe but not yet product-smart. The next quality work needs a
real proxy-backed demo mode, while keeping provider calls out of CI and keeping
private provider credentials server-side.

## Phase Scope

This phase covers:

- production dictionary and frequency source approval
- production or approved large-scale asset pipeline
- scalable C++ candidate generation
- SymSpell/delete-index or equivalent candidate lookup
- ranking and conservative confidence gates
- expanded common typo coverage
- casing preservation
- contractions and plurals
- cross-surface spell quality tests
- real proxy completion demo mode
- quality benchmarks and false-positive review

No model/local inference is included in this phase.

## Non-Goals

- no Path B local completion engine
- no next-edit logging
- no grammar, style, tone, or clarity engine
- no valid-word autocorrect
- no real-word or context autocorrect
- no browser-held provider secret path
- no direct browser OpenAI/provider calls
- no real Codex adapter
- no ProseMirror or Monaco implementation
- no browser extension
- no local model inference
- no silent rewrite
- no auto-accept of completion
- no production dictionary asset without license approval

## Hard Boundaries

- `@typai/core` remains local deterministic correction only.
- `@typai/core` must not import `@typai/completion-remote`.
- `@typai/completion-remote` remains optional.
- Provider examples remain server-side and environment-gated for real provider
  calls.
- Edit-distance and SymSpell candidates do not become autocorrect
  automatically.
- Valid words are never autocorrected.
- Protected tokens are never autocorrected.
- Blue still means Typai changed text.
- Red still means unresolved spelling issue.
- Accepted completions are not blue correction marks.
- No real provider calls occur in tests, demos, E2E, smoke scripts, or CI.

## Quality Targets

Future quality gates should target:

- protected-token writes: 0
- valid-word autocorrections: 0
- edit-distance/SymSpell autocorrections: 0 unless the token is explicitly in
  the common-typo/high-confidence gate
- unknown non-words receive red unresolved marks
- broad common misspellings receive useful suggestions after dictionary and
  SymSpell work lands
- expanded common typo map precision: at least 99% on the approved golden
  corpus
- p95 direct core token check remains under existing thresholds
- browser correction p95 remains under existing thresholds
- completion p95 smoke thresholds do not regress
- completion provider real calls remain absent from CI

## Prompt Sequence

1. Prompt 99: Intelligence Quality Foundation scope, baseline diagnosis, and
   quality gates.
2. Prompt 100: approve dictionary/frequency source inputs and create the
   license-gated asset pipeline without committing production assets.
3. Prompt 101: add scalable C++ candidate generation using SymSpell/delete
   index or an equivalent deterministic lookup.
4. Prompt 102: add ranking, conservative confidence gates, and expanded common
   typo coverage.
5. Prompt 103: add casing preservation, contraction handling, and plural
   handling without valid-word autocorrect.
6. Prompt 104: add cross-surface spell quality tests for contenteditable,
   textarea, React, and CodeMirror.
7. Prompt 105: add a real proxy completion demo mode through secure server-side
   rails, still disabled from CI by default.
8. Prompt 106: add quality benchmarks, false-positive review, and release
   readiness evidence for the intelligence phase.

## Acceptance Gates

Prompt 99 acceptance:

- Intelligence Quality Foundation doc exists.
- Spell quality baseline doc exists.
- Baseline characterization tests exist.
- README and agent brief identify Intelligence Quality Foundation as the next
  phase.
- No spell behavior changes are introduced.
- Baseline tests report current weakness without turning future quality targets
  into failing gates.
- Existing safety invariants still fail loudly if broken.

Future phase acceptance:

- production dictionary/frequency source is approved before any production
  asset is committed, packed, or published
- generated assets include source URLs, retrieval dates, notices, manifest,
  counts, hashes, and deterministic transform commands
- scalable candidate generation is measured against direct core latency budgets
- broad common misspellings receive suggestions without opening autocorrect
  beyond the approved common-typo/high-confidence gate
- valid-word and protected-token write counts remain zero
- cross-surface correction behavior remains consistent
- real-provider demo path stays server-side and manually gated
- CI remains mock-only for completion providers
