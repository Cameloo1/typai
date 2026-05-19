# typai Agent Brief

This is the canonical current-state instruction file for future coding agents.
Archived planning docs are historical context only.

## Project Summary

typai is an open-source embeddable writing intelligence layer. Codex is a future
flagship integration, not the root architecture.

Current phase: V4.2 Provider + Public Beta Readiness.

V4.0 Remote Completion Prototype is complete. The V4 package is
`@typai/completion-remote`. It is a separate, opt-in remote
completion package with provider, scheduler, context, metrics, endpoint
provider, contenteditable controller, mocked demo, E2E coverage, package
readiness, and mocked benchmark coverage.

Contenteditable, textarea, React, and CodeMirror completion exist today.
CodeMirror completion supports ghost-text rendering, dismiss behavior, Tab
accept, completion transactions, and exact revert. Package dry-run, smoke
install, V4.1 E2E, browser benchmark gates, and the hardening audit cover these
surfaces.

V4.2 does not add new editor surfaces. Provider/proxy/security work is active:
API stability labels, source-level API export snapshot tests, provider endpoint
contracts, security/privacy baselines, future server-side-only provider
examples, consumer install docs, release dry-runs, beta API boundaries, and
public-beta smoke gates. Provider examples must keep private keys server-side.

Rich Editor Adapter Foundation is complete. Rich adapters remain local
deterministic correction adapters in this phase.

## Current Packages

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- Internal private `@typai/adapter-testkit`
- Internal private `@typai/ui`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`
- Internal private `@typai/provider-proxy-testkit`
- `examples/simple-demo-editor`
- `tests/golden-corpus`

## V4 / V4.1 / V4.2 Remote Completion Boundary

- `@typai/core` must not import `@typai/completion-remote`.
- Existing adapters must still work without completion installed or configured.
- Existing correction adapters remain local correction adapters.
- `@typai/contenteditable` accepts a structural optional completion
  controller/interface without importing `@typai/completion-remote`.
- `@typai/completion-remote` owns provider, scheduler, context, metrics, and
  completion state.
- `@typai/completion-remote` is optional and package-ready, but not imported by
  `@typai/core`.
- Contenteditable completion exists and must be preserved.
- Textarea completion exists and must be preserved.
- React completion wrappers/components exist and must remain optional.
- CodeMirror completion exists and must keep accepted completions separate from
  blue correction marks.
- Mock providers are used in tests, demos, E2E, and browser benchmark smoke.
- API export snapshot tests must stay explicit when public exports change.
- Provider proxy examples must satisfy `@typai/provider-proxy-testkit`
  validation, safe-error, fixture, and contract-suite coverage before they are
  trusted.
- Endpoint providers require an embedder backend; browser code must not call
  model providers directly.
- Browser examples must not contain private provider API keys.
- Browser package code calls an embedder endpoint; the embedder endpoint calls
  the provider.
- V4.2 provider examples must be server-side only.
- V4.2 real-provider examples or scripts must be env-gated, manually invoked,
  and disabled in CI by default.
- Accepted completions are completion transactions, not blue correction marks.
- Ghost text is visual only until explicit Tab acceptance.
- Optional streaming is allowed only after non-streaming V4.1 surfaces are
  stable, behind a feature flag, and with mocked tests only.
- Browser benchmarks cover deterministic correction plus mocked completion for
  contenteditable, textarea, React textarea, and CodeMirror.
- Package smoke verifies `@typai/completion-remote` imports, structural
  completion options, and `@typai/core` no-remote behavior.
- No real Codex integration.
- No browser extension.
- No local model inference.
- No next-edit logging.
- No grammar, style, tone, or clarity expansion in V4.2.
- No SymSpell/delete index or production dictionary asset in V4.2.
- No direct browser OpenAI/provider calls.
- No npm publish in V4.2 unless a later prompt explicitly opens publishing.

Deterministic correction runs first. Remote completion waits for debounce after
correction settles.

## Deterministic Correction Constraints

- C++ remains the deterministic correction engine.
- Rust owns the Wasm bridge.
- TypeScript owns package wrappers, storage state, protected-span helpers,
  editor adapters, marks, transactions, demos, and tests.
- No Emscripten.
- No Embind.
- No C++ classes crossing into JavaScript.
- No `std::string` across FFI.
- No C++-allocated memory that JS/Rust must free.
- No full document text passed into C++ token APIs.
- `createTypaiCore()` remains the async startup boundary.
- `checkCompletedToken()` and `suggestToken()` remain synchronous after
  initialization.
- No storage reads, network calls, server calls, local-service calls, or model
  calls inside the deterministic correction hot path.
- Valid words are never autocorrected.
- Edit-distance candidates are suggestions only and are never autocorrected.
- Protected spans are hard write barriers.
- Stale writes are blocked with current token/range text and editor-version
  checks.
- IME composition and non-collapsed selections block autocorrection.
- Blue marks mean typai changed the word.
- Red marks mean unresolved spelling issue.
- Memory export/import must not become full-document telemetry.
- Do not log full prompt context by default.
- Do not add grammar/style/tone/clarity behavior without a new explicit phase.
- Do not add a server, daemon, localhost API, browser extension, or local
  service requirement to correction packages.
- Do not add remote completion to `@typai/core`.
- Do not make `@typai/completion-remote` a dependency of `@typai/core`.

## Current Non-Goals

- No SymSpell/delete index.
- No keyboard adjacency.
- No edit-distance autocorrect.
- No valid-word autocorrect.
- No production dictionary asset.
- No ProseMirror implementation.
- No Monaco implementation.
- No real Codex integration.
- No real OpenAI/provider calls in browser examples, tests, E2E, or benchmarks.
- No next-edit logging.
- No private provider key in browser code.
- No local model inference.

## V4 Scope Reference

Use `docs/v4-remote-completion.md` as the V4 Remote Completion Prototype scope
lock. It is the current boundary for completion planning.

Use `docs/v4-remote-completion-complete.md` as the V4.0 hardening audit and
completion checkpoint.

Use `docs/v4-1-completion-surface-expansion.md` as the V4.1 Completion Surface
Expansion scope lock. Do not add a real Codex adapter, ProseMirror/Monaco
completion, browser extension behavior, local model inference, next-edit
logging, private browser provider-key paths, real provider calls in tests or
demos, completion auto-accept, silent rewrite, or streaming outside the V4.1
feature-flag/mock-test gate.

Use `docs/v4-1-completion-surface-expansion-complete.md` as the V4.1 hardening
audit and completion checkpoint.

Use `docs/v4-2-provider-public-beta-readiness.md` as the V4.2 Provider + Public
Beta Readiness scope lock. Do not implement provider examples until the relevant
V4.2 prompt opens them. Keep real provider calls out of tests, demos, E2E,
benchmarks, and CI unless explicitly env-gated for a manual script.

Use `docs/api-stability.md` for public API labels. Use
`docs/provider-proxy-security-contract.md`, `docs/security-threat-model.md`, and
`docs/privacy-model.md` for V4.2 provider, security, and privacy boundaries.
