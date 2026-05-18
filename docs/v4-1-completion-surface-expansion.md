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

Optional streaming support may be added only after non-streaming textarea,
React, and CodeMirror completion surfaces are stable. Streaming must remain
behind a feature flag and must use mocked tests only.

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
- Streaming before stable non-streaming textarea, React, and CodeMirror
  completion surfaces.

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
9. V4.1-8: CodeMirror accept, transaction, revert, mocked tests, and demo
   wiring.
10. V4.1-9: cross-surface conformance audit.
11. V4.1-10: optional streaming experiment behind a feature flag, mocked only,
    after non-streaming surfaces are stable.

Each implementation prompt should preserve contenteditable completion behavior
and keep tests mocked.

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
- Provider errors never render ghost text.
- Provider errors never mutate editor text.
- Scheduler cooldown and budget rejections never create editor transactions.
- Typing, Escape, selection change, composition, blur, paste, and incompatible
  correction transactions dismiss visible completions.
- Default retry count is zero.
- Completion auto-accept is forbidden.
- Silent rewrite is forbidden.

## Package Boundary

`@typai/completion-remote` owns:

- Provider interfaces.
- Endpoint provider behavior.
- Mock provider behavior.
- Scheduling, debounce, abort, stale response handling, and metrics.
- Typed provider error classification.
- Request budget controls and rate-limit cooldown.
- Feature flags for later optional streaming support.

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
