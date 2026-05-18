# typai Agent Brief

This is the canonical current-state instruction file for future coding agents.
Archived planning docs are historical context only.

## Project Summary

typai is an open-source embeddable writing intelligence layer. Codex is a future
flagship integration, not the root architecture. Alpha Foundation and Public
Alpha Readiness are complete.

Current phase: Rich Editor Adapter Foundation. Prompts 48-60 have completed
the scope lock, shared adapter testkit, internal shared UI, React package,
React hooks/components, React demo/package readiness, the CodeMirror 6 adapter
package with red/blue marks, Markdown/code protected contexts, safe correction
transactions, V1B red/blue popovers, the CodeMirror/Codex mock demos, and
planning-only docs for future ProseMirror and Monaco adapters.

Textarea Adapter Foundation is complete. `@typai/textarea` exists and is wired
into package readiness, smoke install, CI, E2E, and browser benchmark coverage.
Overlay mirror is the selected mode because native `<textarea>` cannot render
per-word inline marks inside the control. Native textarea remains the source of
truth.

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
- Internal private `@typai/adapter-testkit`
- Internal private `@typai/ui`
- `@typai/react`
- `@typai/codemirror`
- `examples/simple-demo-editor`
- `tests/golden-corpus`

## New Planned Packages

- Future planning-only adapters: `@typai/prosemirror` and `@typai/monaco`.
  See `docs/prosemirror-adapter-plan.md` and
  `docs/monaco-adapter-plan.md`; no packages, implementations, or dependencies
  exist for either editor.

Do not create `@typai/completion-remote` during Rich Editor Adapter Foundation.

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
- No production dictionary.
- No background scan.
- No next-edit logging.
- No full document text in memory exports.
- No grammar/style/tone/clarity.
- No real Codex integration.
- No ProseMirror implementation.
- No Monaco implementation.
- No `@typai/completion-remote`.
- No V4 remote completion.
- No OpenAI/provider endpoint.
- No ghost text completion.

## Rich Editor Adapter Foundation Scope

See `docs/rich-editor-adapter-foundation.md` for the locked scope.

- Shared adapter contracts and conformance tests come first.
- Prompt 49 created private internal `@typai/adapter-testkit` conformance
  coverage for `@typai/contenteditable` and `@typai/textarea`.
- Prompt 50 created private internal `@typai/ui` framework-free DOM utilities
  for popovers, settings, debug summaries, live regions, focus helpers, and
  prefixed styles.
- Existing contenteditable and textarea adapters were not migrated to
  `@typai/ui` during Prompt 50.
- Internal shared UI comes before public UI API commitments.
- Prompt 51 created `@typai/react` as a real React adapter package scaffold,
  not just thin wrappers.
- React API is staged: `useTypaiTextarea`, `useTypaiContenteditable`,
  `TypaiTextarea`, `TypaiContenteditable`, provider/settings/debug UI.
- Prompt 52 implemented React hook attachment behavior for textarea and
  contenteditable adapters.
- React hooks attach adapters in effects, detach on cleanup, use provider
  context when a direct `typai` option is not passed, and keep textarea overlay
  behavior opt-in so React retains normal element ownership by default.
- Prompt 53 implemented React components over those hooks:
  `TypaiTextarea`, `TypaiContenteditable`, `TypaiSettingsPanel`, and
  `TypaiDebugTable`.
- React components accept direct native props plus `textareaProps` or
  `contenteditableProps`, forward refs, use provider context when `typai` is
  omitted, and let explicit `typai` props override provider context.
- React settings/debug components are local deterministic correction UI only;
  they must not add completion settings, completion metrics, provider metrics,
  next-edit logging, or full-document text collection.
- React is a peer dependency of `@typai/react` only; do not add React to core or
  non-React packages.
- Prompt 54 added the React tab to `examples/simple-demo-editor`, React E2E
  coverage, React accessibility smoke coverage, and local package dry-run/smoke
  install coverage for `@typai/react`.
- Prompt 55 created `@typai/codemirror` for CodeMirror 6 only with
  decoration-only red unresolved spelling marks as the first step.
- Prompt 56 added Markdown/code protected-context detection. Existing typai
  token helpers still run first; when a CodeMirror syntax tree is available,
  inline code, fenced code blocks, URL/link-destination nodes, and other
  code-like syntax nodes are skipped. Without a syntax tree, conservative
  heuristics skip fenced code, inline code, Markdown link destinations, and
  command-looking shell lines.
- Prompt 57 added safe CodeMirror correction transactions for common typo map
  autocorrection only. The adapter verifies document version, document length,
  cursor state, and token text before dispatching a CodeMirror transaction,
  records a CodeMirror correction transaction, renders blue
  `typai-cm-blue-corrected` marks for applied corrections, and exposes exact
  revert commands.
- Prompt 58 added CodeMirror V1B popovers and controls. Blue correction marks
  support revert, always-correct, never-correct, and add-original-to-dictionary.
  Red spelling marks support suggestion application, ignore once,
  add-to-dictionary, and disable-autocorrect while spellcheck can remain
  available. Popover text mutations use CodeMirror transactions and verify the
  current range text before dispatch.
- CodeMirror edit-distance suggestions remain red suggestion marks only and are
  never autocorrected.
- CodeMirror modes are plain text, Markdown, and code-block awareness.
- CodeMirror protected spans start with existing typai helpers and may add
  syntax-tree awareness where available.
- ProseMirror and Monaco remain planning-only future work. Planning docs exist
  in `docs/prosemirror-adapter-plan.md` and
  `docs/monaco-adapter-plan.md`; no packages, implementations, or dependencies
  exist.
- Codex gets a Codex-style mock demo only.
- There is no real Codex integration in this phase.
- Keep publishable-alpha metadata current, but do not publish.
- Keep production dictionary blocked.
- Do not add a production dictionary asset.
- Do not implement SymSpell.
- Do not add next-edit logging.
- Do not implement V4 remote completion.
- Do not create `@typai/completion-remote`.
- Do not add an OpenAI/provider endpoint.
- Do not add ghost text completion.

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
- Do not implement ProseMirror or Monaco adapters; Rich Editor Adapter
  Foundation only plans them.
- Do not implement real Codex integration; Rich Editor Adapter Foundation only
  allows a Codex-style mock demo.
- Do not implement V4 remote completion.
- Do not create `@typai/completion-remote`.
- Do not add OpenAI/provider endpoints.
- Do not add ghost text completion.
- Do not create `packages/codex` or any Codex adapter implementation during
  Rich Editor Adapter Foundation.
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
- Do not introduce adapters beyond the current phase scope without an explicit
  phase update.
- Do not add remote completion, ghost text, or provider calls to deterministic
  correction packages.
- Do not treat old planning docs as current source of truth.
