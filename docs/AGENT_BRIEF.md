# typai Agent Brief

This is the canonical current-state instruction file for future coding agents.
Archived planning docs are historical context only.

## Project Summary

typai is an open-source embeddable writing intelligence layer. Codex is a future
flagship integration, not the root architecture.

Current phase: V4 Remote Completion Prototype complete.

The V4 package is `@typai/completion-remote`. It is a separate, opt-in remote
completion package with provider, scheduler, context, metrics, endpoint
provider, contenteditable controller, mocked demo, E2E coverage, package
readiness, and mocked benchmark coverage.

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
- `examples/simple-demo-editor`
- `tests/golden-corpus`

## V4 Remote Completion Boundary

- `@typai/core` must not import `@typai/completion-remote`.
- Existing adapters must still work without completion installed or configured.
- Existing correction adapters remain local correction adapters.
- `@typai/contenteditable` accepts a structural optional completion
  controller/interface without importing `@typai/completion-remote`.
- `@typai/completion-remote` owns provider, scheduler, context, metrics, and
  completion state.
- `@typai/completion-remote` is optional and package-ready, but not imported by
  `@typai/core`.
- Mock providers are used in tests, demos, E2E, and browser benchmark smoke.
- Endpoint providers require an embedder backend; browser code must not call
  model providers directly.
- Browser examples must not contain private provider API keys.
- Browser package code calls an embedder endpoint; the embedder endpoint calls
  the provider.
- No textarea ghost text in V4.0.
- No React completion surface in V4.0.
- No CodeMirror completion surface in V4.0.
- No real Codex adapter in V4.0.
- No browser extension in V4.0.
- No local model inference in V4.0.
- No next-edit logging.

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

## V4 Scope Reference

Use `docs/v4-remote-completion.md` as the V4 Remote Completion Prototype scope
lock. It is the current boundary for completion planning.

Use `docs/v4-remote-completion-complete.md` as the V4.0 hardening audit and
completion checkpoint. Do not add V4.1 features such as streaming, textarea
ghost text, React completion, CodeMirror completion, partial accept, local
completion research, or next-edit prediction without a new explicit phase.
