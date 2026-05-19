# V4.1 Completion Surface Expansion

Status date: 2026-05-18.

V4.1 expands the optional remote completion surface beyond the V4.0
contenteditable prototype while preserving Typai's local deterministic
correction contract. This phase is a scope lock for surface expansion, shared
contracts, and provider resilience.

## Current V4.0 State

V4.0 Remote Completion Prototype is complete.

The current completion implementation includes:

- `@typai/completion-remote` as a separate opt-in package.
- Endpoint-based provider calls routed through an embedder-controlled backend.
- Mock provider support for demos, tests, E2E, and benchmarks.
- Contenteditable ghost text.
- Tab accept.
- Escape, typing, selection change, composition, blur, paste, and correction
  transaction dismissal.
- Accepted-completion transactions with exact revert.
- Local/session metrics.
- Mocked provider demo and E2E coverage.

The deterministic correction packages still work without
`@typai/completion-remote` installed or configured.

## V4.1 Goals

V4.1 adds completion support for additional existing editor surfaces:

- Native `<textarea>`.
- React wrappers and components.
- CodeMirror.

V4.1 also adds shared completion surface contracts and conformance tests so the
same safety behavior can be verified across surfaces. Provider calls remain
routed through `@typai/completion-remote`.

Provider resilience basics are in scope:

- Timeout handling.
- Typed provider error classification.
- Endpoint response validation.
- Rate-limit cooldown.
- Request budget controls.
- Stale response discard.
- Provider error state that does not break the editor.
- Abort/cancel paths when user input changes.
- No automatic retry by default.
- Mocked tests for retry/rate-limit behavior; no real provider calls.

Optional streaming support was added only after non-streaming textarea, React,
and CodeMirror completion surfaces stabilized. Streaming remains behind the
`streaming.enabled` feature flag and uses mocked providers/tests only.

## Target Surfaces

### Textarea

Textarea completion must preserve `textarea.value` as the only source of truth.
Ghost text must be visual only and must not insert markup or hidden completion
text into the textarea value before explicit acceptance.

The textarea adapter owns editor-specific rendering, caret mapping, dismiss
behavior, and transaction application.

### React

React completion support should compose existing Typai packages without making
React the owner of provider behavior. React hooks and components may expose
completion options, lifecycle wiring, and controlled/uncontrolled integration
helpers.

React wrappers must continue to work for deterministic correction when
completion is not installed or configured.

### CodeMirror

CodeMirror completion should use CodeMirror-native decoration and transaction
primitives. Ghost text must remain a visual decoration until explicit user
acceptance.

The CodeMirror adapter owns state mapping, transaction application, stale accept
guards, and revert behavior for accepted completions.

## Current Non-Goals

The following remain out of scope for V4.1 unless a later prompt explicitly
opens them:

- Real Codex adapter.
- ProseMirror completion.
- Monaco completion.
- Browser extension.
- Local model inference.
- Path B local completion engine.
- Next-edit logging.
- Grammar, style, tone, or clarity features.
- SymSpell.
- Production dictionary asset.
- Private provider API key path in browser examples.
- Real OpenAI or provider calls in E2E, demos, or tests.
- Completion auto-accept.
- Silent rewrite.
- Streaming by default.
- Real provider streaming, server streaming, or OpenAI streaming.

## Implementation Prompt Sequence

Recommended V4.1 sequence:

1. V4.1-0: scope lock and documentation handoff.
2. V4.1-1: shared completion surface contract and conformance test harness.
3. V4.1-2: provider resilience for `@typai/completion-remote`.
4. V4.1-3: textarea completion rendering design and non-streaming adapter
   implementation.
5. V4.1-4: textarea mocked tests, E2E, and accessibility checks.
6. V4.1-5: React hooks/components for contenteditable and textarea completion.
7. V4.1-6: React mocked tests and demo wiring.
8. V4.1-7: CodeMirror ghost-text decoration layer and dismiss behavior.
9. V4.1-8: CodeMirror accept, transaction, and revert.
10. V4.1-9: completion demo expansion for textarea, React, and CodeMirror.
11. V4.1-10: cross-surface conformance audit.
12. V4.1-11: optional streaming experiment behind a feature flag, mocked only,
    after non-streaming surfaces are stable.
13. V4.1-12: package readiness, CI, smoke install, and browser benchmark gates
    for V4.1 completion surfaces.

Each implementation prompt should preserve contenteditable completion behavior
and keep tests mocked.

V4.1-11 keeps non-streaming as the default. The scheduler only uses
`streamComplete` when the host passes `streaming: { enabled: true }` and the
provider implements streaming. The mock streaming provider yields deterministic
deltas for unit tests; endpoint streaming and real provider streaming remain
out of scope.

V4.1-12 adds readiness gates for the expanded completion surface. Dry-run
packaging includes `@typai/completion-remote`, excludes tests/reports/server
routes/demo files, and checks packed metadata and inspectable code for provider
secret-like values. Smoke install imports the completion package entrypoints,
verifies structural completion options for contenteditable, textarea, React,
and CodeMirror, and confirms `@typai/core` still works without depending on
`@typai/completion-remote`.

CI covers completion-remote tests, mocked streaming tests, Chromium and Firefox
V4.1 E2E, package smoke, and browser benchmarks. WebKit remains skipped and no
real provider secrets are required.

## V4.1 Demo Expansion

The simple demo editor now exposes mocked completion paths for all V4.1
completion surfaces:

- Contenteditable through the existing `V4 Remote Completion` tab.
- Native textarea through the `Textarea Completion Demo` tab.
- React textarea and contenteditable components through the `React Completion
  Demo` tab.
- CodeMirror through the `CodeMirror Completion Demo` tab.

Each demo uses mock providers by default, includes request/ghost/accept/dismiss/
revert metrics, reports status, and documents manual Tab accept, Escape
dismiss, typing dismiss, and exact revert checks. Browser demos do not include
private provider keys or real provider calls.

## V4.1 Benchmark Readiness

Browser benchmark smoke now reports count, mean, p50, p95, p99, and max for
deterministic correction and mocked remote completion surfaces.

Thresholds:

- Deterministic correction warns above 20 ms p95 and fails above 100 ms p95.
- Mocked remote completion targets p95 below 800 ms, warns above 800 ms, and
  fails above 2000 ms.

Current benchmarked completion surfaces:

- Contenteditable completion.
- Textarea completion.
- React textarea completion.
- CodeMirror completion.

## Safety Contract

Completion suggestions must never mutate source text until explicit user
acceptance.

Required invariants:

- Ghost text is visual only.
- Accepted completion requires explicit user action.
- Accepted completion creates a transaction that is revertible.
- Stale accept is blocked by checking the current editor state before
  insertion.
- Provider responses are discarded if stale.
- Streaming deltas are discarded if stale.
- Provider errors never render ghost text.
- Provider errors never mutate editor text.
- Scheduler cooldown and budget rejections never create editor transactions.
- Typing, Escape, selection change, composition, blur, paste, and incompatible
  correction transactions dismiss visible completions.
- Default retry count is zero.
- Completion auto-accept is forbidden.
- Silent rewrite is forbidden.
- Streaming accept inserts only the currently visible accumulated ghost text.

## Package Boundary

`@typai/completion-remote` owns:

- Provider interfaces.
- Endpoint provider behavior.
- Mock provider behavior.
- Scheduling, debounce, abort, stale response handling, and metrics.
- Typed provider error classification.
- Request budget controls and rate-limit cooldown.
- Feature-flagged mocked streaming support.

Adapters own:

- Editor-specific ghost rendering.
- Editor-specific state mapping.
- Explicit accept handling.
- Transaction-safe source text insertion.
- Exact revert for accepted completions.
- Surface-specific dismissal behavior.

`@typai/core` remains no-remote:

- No import of `@typai/completion-remote`.
- No provider calls.
- No network calls.
- No completion scheduler.
- Local deterministic correction only.

Deterministic correction remains local and trusted. Remote completion remains
optional, explicit, and routed through the separate completion package.
