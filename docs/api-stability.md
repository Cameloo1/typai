# API Stability

Status date: 2026-05-19.

This document labels Typai's exported package APIs for the V4.2 public beta
readiness track. It is a contract for consumers and for future coding agents:
new exports must be intentional, documented, and covered by the API export
snapshot tests.

## Stability Labels

- `stable-beta`: Public beta API. Breaking changes require changelog entries,
  migration notes, and an explicit compatibility decision.
- `experimental`: Public but still allowed to change during pre-release. The
  API must be documented as experimental wherever consumers are likely to see
  it.
- `internal`: Exported for local package wiring, tests, or current package
  readiness. Consumers should not depend on it.
- `private`: Not intentionally exported. Private APIs must not appear in public
  package entrypoints.
- `deprecated`: Public API kept temporarily. Deprecated APIs must list a
  replacement and removal conditions.

## Global Rules

- Do not add accidental public exports.
- Do not export provider API-key configuration for browser use.
- Do not make `@typai/core` depend on `@typai/completion-remote`.
- Keep type exports and runtime exports covered by source-level snapshot tests.
- Treat `@typai/ui` and `@typai/adapter-testkit` as internal unless a later
  packaging prompt promotes specific APIs.

## `@typai/core`

Package label: `stable-beta` for deterministic correction APIs.

`stable-beta`:

- `createTypaiCore`
- `TYPAI_CORE_VERSION`
- Returned `TypaiCore` object methods:
  - `checkCompletedToken`
  - `suggestToken`
  - memory import/export/reset APIs
  - personal dictionary APIs
  - dictionary loading APIs
- Storage APIs:
  - `TypaiStorage`
  - `createMemoryStorage`
  - `createIndexedDbStorage`
  - `CreateIndexedDbStorageOptions`
- Token and protected-span helpers:
  - `getTokenBeforeOffset`
  - `isDelimiter`
  - `classifyToken`
  - `isProtectedTokenText`
- Public correction, token, dictionary, memory, range, language, and storage
  types exported from `@typai/core`.

`private`:

- C++ engine internals.
- Rust/Wasm bridge internals.
- Generated Wasm implementation details.

## `@typai/contenteditable`

Package label: `stable-beta` for deterministic correction adapter APIs;
`experimental` for structural completion controller support.

`stable-beta`:

- `attachContenteditable`
- `TYPAI_CONTENTEDITABLE_VERSION`
- contenteditable options and detach handle types.
- correction transaction, visual mark, popover, settings, text-change, and
  DOM range mapping types/helpers used by the adapter's public contract.

`experimental`:

- Structural completion controller support.
- Completion snapshot, ghost metadata, completion transaction, completion
  revert, and completion clear-reason types.

## `@typai/textarea`

Package label: `stable-beta` for deterministic textarea correction APIs;
`experimental` for textarea completion support.

`stable-beta`:

- `attachTextarea`
- `TYPAI_TEXTAREA_VERSION`
- Textarea settings, overlay mode, snapshot, correction transaction, mark,
  popover action, protected-skip, range, and helper APIs.

`experimental`:

- Textarea completion controller support.
- Textarea completion snapshot, event, transaction, accept/revert, dismiss, and
  render metadata types.

## `@typai/react`

Package label: `stable-beta` for app-level deterministic correction wrappers;
`experimental` for completion props and debug/settings components.

`stable-beta`:

- `TypaiProvider`
- `useTypaiCore`
- `useTypaiTextarea`
- `useTypaiContenteditable`
- `TypaiTextarea`
- `TypaiContenteditable`
- Core provider and adapter hook option/result types.

`experimental`:

- Completion controller props/types.
- `TypaiSettingsPanel`
- `TypaiDebugTable`
- settings/debug component props and debug state types.

## `@typai/codemirror`

Package label: `stable-beta` for the extension factory and options;
`experimental` for command/state helpers and completion-specific exports.

`stable-beta`:

- `createTypaiCodeMirrorExtension`
- `TypaiCodeMirrorOptions`
- correction event, mark, and correction transaction types.

`experimental`:

- CodeMirror completion controller, ghost, transaction, snapshot, and metadata
  types.
- CodeMirror command helpers.
- CodeMirror state fields/effects/facets.
- CSS class-name constants.

## `@typai/completion-remote`

Package label: `experimental` for the whole package during V4.2 public beta.
It is optional and must not be imported by `@typai/core`.

`experimental`:

- `createRemoteCompletion`
- `createMockCompletionProvider`
- `createEndpointCompletionProvider`
- `createNoopCompletionProvider`
- `createContenteditableCompletionController`
- provider interfaces and provider error types.
- completion request, response, delta, mode, instruction, state, scheduling,
  context, endpoint payload, and sanitize types/helpers.
- metrics APIs, including `createMemoryMetricsSink` and metric event types.
- streaming flag/options APIs, including `createMockStreamingCompletionProvider`
  and `RemoteCompletionStreamingOptions`.

`private`:

- Browser provider-key paths. These must not be exported.
- Direct OpenAI or provider SDK clients. These do not exist in V4.2.

## `@typai/ui`

Package label: `internal`.

Current exports are internal/unstable DOM UI utilities used by Typai adapters:
popovers, live region helpers, focus helpers, settings panel helpers, debug
table helpers, style helpers, and their types. They remain private to the
workspace even when package-readiness tooling packs them for local smoke tests.

## `@typai/adapter-testkit`

Package label: `internal`.

Current exports are test-only conformance fixtures, assertions, drivers, and
types for adapter packages. They are not consumer APIs.

## Deprecations

No deprecated public APIs exist in the V4.2 scope lock. Future deprecations must
include the deprecated name, replacement, migration note, and planned removal
condition.
