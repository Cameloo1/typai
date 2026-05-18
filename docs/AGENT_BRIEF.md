# Typai Agent Brief

This is the canonical current-state instruction file for future coding agents.
Archived planning docs are historical context only.

## Project Summary

Typai is an open-source embeddable writing intelligence layer. Codex is a future
flagship integration, not the root architecture. Alpha Foundation and Public
Alpha Readiness are complete.

Current phase: Textarea Adapter Foundation complete. `@typai/textarea` exists
and is wired into package readiness, smoke install, CI, E2E, and browser
benchmark coverage. Overlay mirror is the selected mode because native
`<textarea>` cannot render per-word inline marks inside the control. Native
textarea remains the source of truth. Do not implement a replacement editor or
degraded-only mode for this phase.

## Current Architecture

- C++ deterministic correction engine.
- Rust-owned Wasm bridge.
- TypeScript package wrapper and editor adapters.
- No Emscripten.
- No Embind.
- No C++ classes crossing into JS.
- No `std::string` across FFI.
- No C++-allocated memory that JS/Rust must free.
- No full document text passed into C++ for token checks.

## Current Packages

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `examples/simple-demo-editor`
- `tests/golden-corpus`

## Product Laws

- Automatic edits are rare, fast, explainable, reversible.
- Blue = system changed this word.
- Red = unresolved spelling issue.
- V1 only autocorrects non-word typos.
- Valid words are never autocorrected.
- Protected spans are hard write barriers.
- No stale writes: `documentVersion` and token text must match.
- No LLM/model calls in V1 hot path.
- No server, daemon, localhost API, browser extension, or native helper required
  for MVP.

## Current Alpha Foundation Behavior

- Common typo map and tiny dictionary only.
- C++ edit-distance candidate generation flows through Rust/Wasm into
  `@typai/core` suggestions.
- Common typo map remains the only source of autocorrection.
- Edit-distance candidates are suggestions only and are never autocorrected.
- `TypaiStorage` is the storage boundary. In-memory storage is available for
  ephemeral use and tests; IndexedDB is available as a browser storage backend.
- User state is loaded into memory during `createTypaiCore()` initialization, so
  `checkCompletedToken()` does not perform storage reads or other async storage
  work in the typing hot path.
- Personal dictionary and always/never-correct rules are TypeScript intercepts
  before or around Wasm decisions; they are not stored in C++.
- Playwright E2E covers the simple demo and V1B controls.
- Browser-path latency smoke benchmark and direct core benchmark are available.
- V1B popovers exist for blue corrections and red unresolved spelling issues.
- Local memory reset/export/import exists through `TypaiCore`. The export format
  is versioned and limited to personal dictionary entries, correction rules,
  optional settings, and export metadata.
- The demo has a session-local debug table for token-level corrections,
  suppressions, unresolved marks, and user actions. It must not become
  full-document telemetry or next-edit logging.
- V1B demo popovers have basic keyboard/ARIA support and axe-core Playwright
  smoke checks for initial, blue-popover, red-popover, and settings/memory
  states.
- GitHub Actions CI runs install, build, unit tests, lint, package smoke,
  direct core benchmark, contenteditable and textarea browser benchmark smoke,
  and Playwright E2E in Chromium and Firefox. WebKit remains out of scope for
  now.
- Benchmarks warn above 20 ms p95 and fail above 100 ms p95.
- Contenteditable is hardened for text-first use: caret preservation, mark
  metadata, stale-mark cleanup, plain-text range mapping, and text-only paste are
  supported. Arbitrary nested rich text remains outside scope.
- Textarea is hardened for native form semantics, `readonly`/`disabled` guards,
  IME composition guard behavior, overlay resize/scroll resync, axe checks, and
  local package smoke installation.
- No SymSpell.
- No keyboard adjacency.
- No `localStorage`.
- No server/local-service/API storage path.
- No project dictionary.
- No background scan.
- No next-edit logging.
- No full document text in memory exports.
- No grammar/style/tone/clarity.
- No React/ProseMirror/CodeMirror/Monaco/Codex adapter.

## Alpha Foundation Checkpoint

- Git/source-control hygiene exists.
- Generated artifacts are ignored.
- Playwright E2E exists.
- Browser-path latency smoke test exists.
- C++ suggestions are wired through Rust/Wasm/TypeScript.
- Storage adapter interface exists.
- In-memory and IndexedDB storage exist.
- V1B contenteditable controls exist.
- See `docs/alpha-foundation.md` for the current phase report and commands.

## Public Alpha Readiness Checkpoint

Public Alpha Readiness was a scope-locked hardening and packaging phase.

- Git/source-control completion.
- NPM package readiness, but no public publish.
- Dictionary loader architecture.
- Mock compact dictionary/frequency asset.
- Runtime dictionary loading through TypeScript -> Rust/Wasm -> C++.
- Frequency-ranked suggestions.
- Dictionary/frequency license research selected preferred candidates, but
  production asset integration remains blocked until the policy gate is met.
- Conditional production asset pipeline only after license approval.
- Contenteditable medium hardening.
- Accessibility and keyboard/ARIA popover behavior.
- Memory reset/export/import.
- Local false-positive/debug table.
- GitHub Actions CI.
- Codex integration planning exists only as future direction; no Codex implementation exists yet.

## Textarea Adapter Foundation Checkpoint

Textarea Adapter Foundation is complete. See
`docs/textarea-adapter-foundation.md` for the locked scope and
`docs/textarea-adapter-foundation-complete.md` for the completion audit.

- `@typai/textarea` exists.
- Overlay mirror is the selected rendering mode.
- Native textarea remains the source of truth.
- Package dry-run, smoke install, Chromium/Firefox E2E, and browser benchmark
  coverage include `@typai/textarea`.
- The completion audit found only allowed forbidden-source hits: docs/non-goals,
  archived planning text, Playwright/Vite dev-server config, lockfile integrity
  strings, and false positives such as `rangeStillMatches`.
- The C++/Rust/Wasm/TypeScript architecture remains intact.
- All previous non-goals remain active unless this phase explicitly narrows
  them.

## Do Not Implement Without A New Explicit Phase

- Do not implement SymSpell/delete index yet.
- Do not implement keyboard adjacency yet.
- Do not implement edit-distance autocorrect.
- Do not implement valid-word autocorrect.
- Do not implement grammar/style/tone/clarity.
- Do not add LLM/model calls.
- Do not add next-edit prediction logging.
- Do not implement replacement-editor or degraded-only textarea mode.
- Do not implement React/ProseMirror/CodeMirror/Monaco/Codex adapters.
- Do not create `packages/codex` or any Codex adapter implementation during
  Public Alpha Readiness.
- Do not add server/local-service/API.
- Do not add a browser extension.
- Do not add background paragraph scanning.
- Do not bundle production dictionary/frequency assets without explicit license and redistribution review.

## Dictionary Direction

- Final strategy is real English dictionary plus frequency data.
- Immediate implementation uses the mock compact dictionary/frequency loader.
- Preferred candidates are English Speller Database / SCOWL v2 for the
  dictionary and Google Books Ngram unigrams for frequency data.
- Production asset bundling is still blocked until license, attribution, redistribution, deterministic transform, and review gates are explicitly closed.
- Frequency scores rank suggestions only.
- Frequency scores must not expand autocorrect triggers in Public Alpha
  Readiness.

## Current V1B Control Semantics

- Blue correction marks open a correction popover instead of reverting directly.
- Revert restores the exact original token and removes the blue mark.
- Always-correct and never-correct rules are stored through `TypaiCore`.
- Never-correct suppresses future common-typo autocorrection; the adapter leaves
  spellcheck enabled and can show a red unresolved mark with the suppressed
  replacement as a suggestion.
- Adding the original token from a blue correction to the dictionary reverts the
  current correction and removes the blue mark because the user is declaring the
  original token valid.
- Red spelling marks open a suggestion popover. Applying a suggestion replaces
  the token through a range/version-safe action, removes the red mark, and adds a
  blue correction mark.
- Ignore once only removes the current red mark.
- Disable autocorrect is session/document adapter state; spellcheck can remain
  enabled.

## Do Not Do

- Do not replace C++ engine with TypeScript-only correction logic.
- Do not replace Rust Wasm bridge with Emscripten/Embind.
- Do not add server/local-service/API.
- Do not add LLM/model calls.
- Do not autocorrect valid words.
- Do not autocorrect edit-distance candidates.
- Do not autocorrect protected spans.
- Do not apply corrections without version/token safety.
- Do not introduce future adapters before core is stable.
- Do not treat old planning docs as current source of truth.
