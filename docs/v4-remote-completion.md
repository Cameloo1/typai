# V4 Remote Completion Prototype

Status date: 2026-05-18.

This document tracks the V4 Remote Completion Prototype scope and current
readiness boundary. V4 includes an optional package, mocked demo, E2E coverage,
package readiness checks, and mocked benchmark coverage. It still does not add a
production server, real provider credential path, real provider streaming, or
model integration.

Completion checkpoint: `docs/v4-remote-completion-complete.md`.

V4.1 begins by hardening the shared remote provider layer before expanding
completion beyond contenteditable. The V4.0 browser-key, mocked-test, and
no-real-provider-call boundaries still apply.

V4.1 also adds optional mocked streaming behind an explicit feature flag.
Non-streaming remains the default path.

## Phase

Phase name: V4 Remote Completion Prototype.

Package: `@typai/completion-remote`.

`@typai/completion-remote` is a separate, opt-in package. It is not part of
`@typai/core` and is not implicitly bundled into existing correction adapters.

## Scope

V4.0 includes:

- Contenteditable only.
- Endpoint-based remote provider.
- Provider abstraction.
- Non-streaming first.
- Debounce, cancellation, and stale response handling.
- Ghost text at the caret.
- Tab accepts the visible completion.
- Escape dismisses the visible completion.
- Further typing dismisses the visible completion.
- Accepted completion uses the transaction/revert system.
- Local metrics.
- Mocked provider E2E.

## Non-Scope

V4.0 does not include:

- Textarea ghost text.
- React completion surface.
- CodeMirror completion surface.
- ProseMirror or Monaco completion.
- Real Codex adapter.
- Browser extension.
- Local model inference.
- Specialized model training.
- Multi-provider support out of the box.
- Streaming unless a later phase explicitly approves it.
- Next-edit prediction away from the caret.
- Silent rewrite.
- Private provider API keys in browser examples.

Path B local completion remains future work. Textarea ghost text, CodeMirror
completion, and React completion surfaces are V4.1+ or later.

## Architecture

`@typai/core` remains local deterministic correction only and must not import
`@typai/completion-remote`.

`@typai/contenteditable` may accept a structural optional completion
controller/interface, but it must still work without completion installed or
configured.

`@typai/completion-remote` owns:

- Provider abstraction.
- Typed provider error classification.
- Endpoint response validation.
- Request budget controls and rate-limit cooldown.
- Request scheduler.
- Context extraction.
- Metrics.
- Completion state.
- Debounce and cancellation.
- Stale response dropping.

Deterministic correction runs first. Completion waits for debounce after
correction settles. If deterministic correction mutates text, any pending or
visible completion must be cleared before a new completion request is eligible.

## Context Extraction

V4 context extraction is bounded by default. It must not send the full document
unless an embedder explicitly opts into a larger bound.

Default extraction policy:

- `contextBefore`: last 2000 characters before the cursor.
- `contextAfter`: next 300 characters after the cursor.
- `includeSelection`: `false`.
- `maxCompletionChars`: 220.
- `maxContextChars`: bounded to the configured before/after window by default.

Selection handling is conservative. With `includeSelection: false`, selected
text is excluded from the extracted context. With `includeSelection: true`,
selected text may appear in `contextAfter`, so embedders should only enable it
when that is intentional.

Embedders may provide a redaction hook before the provider request is built.
The hook receives bounded `textBefore`, bounded `textAfter`, and the completion
mode, and returns replacement `contextBefore`, `contextAfter`, and optional
metadata. Redaction hooks are the intended place for app-specific removal of
secrets, stable IDs, or private snippets. Metrics still must not include raw
context by default.

## Prompt And Instruction Policy

V4 completion instructions are continuation-only. The default instruction tells
providers to:

- Continue from the cursor.
- Return only text that should be inserted at the cursor.
- Not answer the user.
- Not explain the completion.
- Not quote the completion.
- Not repeat text already before the cursor.
- Match the current voice, tone, formatting, and markdown style.
- Stop at a natural short boundary.
- Return an empty string when no useful continuation exists.

The request shape remains provider-neutral. Endpoint providers receive
`{ request: CompletionRequest }` and the embedder-owned endpoint decides how to
translate that request for OpenAI Responses API or another server-side provider.

## Sanitization

V4 sanitization is intentionally light. It does not attempt grammar/style
rewrites, fact filtering, or model-specific cleanup.

Sanitization rules:

- Remove a duplicated prefix when the provider repeats text already before the
  cursor.
- Remove simple surrounding quotes when the whole continuation is safely quoted.
- Trim excessive outer whitespace.
- Return an empty string for whitespace-only completions.
- Enforce `maxCompletionChars`.
- Stop at configured stop sequences.

Spacing policy: sanitization preserves one leading space only when the provider
already returned separator whitespace after a duplicated prefix and the context
before the cursor does not end in whitespace. Typai does not invent a missing
separator in V4.0. For example, if context ends with `Can you help me` and the
provider returns `Can you help me understand this`, the sanitized continuation
is ` understand this`.

Existing packages remain correction adapters:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`

They must not import `@typai/completion-remote`.

## Security

The browser package calls an embedder-controlled endpoint. The embedder endpoint
calls the provider.

Private provider API keys must remain server-side. Browser examples must not
embed private provider API keys or teach users to put provider secrets into
client bundles.

Default context handling should be bounded and inspectable. Do not send full
documents by default.

## Provider Resilience

Provider failures are typed before they reach editor surfaces:

- `network_error`.
- `timeout`.
- `abort`.
- `rate_limited`.
- `invalid_response`.
- `server_error`.
- `client_error`.

Endpoint providers classify HTTP responses conservatively:

- HTTP 429 becomes `rate_limited` and may carry `retryAfterMs`.
- HTTP 5xx becomes `server_error`.
- HTTP 4xx becomes `client_error`.
- Timeout becomes `timeout`.
- Abort becomes `abort`.
- Malformed JSON or malformed response shape becomes `invalid_response`.

The scheduler defaults to one in-flight request per controller/surface. Hosts
may configure `maxRequestsPerMinute`, `maxConcurrentRequests`, and
`cooldownAfterRateLimitMs` as request-budget controls.

Rate-limited responses start a local cooldown. During cooldown, scheduling is
suppressed and a metric is recorded. Provider errors never render ghost text,
never mutate editor source text, and do not create completion transactions.

There is no automatic retry by default. Tests and demos continue to use mocked
providers only.

## Optional Mock Streaming

Streaming is available only when the host opts in:

```ts
createRemoteCompletion({
  provider,
  streaming: {
    enabled: true,
    minCharsBeforeRender: 4,
  },
});
```

If `streaming.enabled` is omitted or false, the scheduler calls `complete()` and
uses the existing non-streaming path. If streaming is enabled but the provider
does not implement `streamComplete`, the scheduler also falls back to
`complete()`.

The supported streaming provider for this phase is the deterministic mock
streaming provider. It yields test-controlled deltas and does not perform
network streaming. Endpoint streaming, server-sent events, OpenAI streaming, and
provider SDK streaming remain future work.

Streaming behavior:

- Deltas accumulate into visual ghost text after `minCharsBeforeRender`.
- Ghost text updates as the accumulated text grows.
- Escape and typing abort the active stream.
- Tab accepts the currently visible accumulated text and aborts remaining
  deltas.
- Deltas from stale or aborted streams are ignored.
- Provider completion finalizes the visible ghost text.

## Latency

Remote completion has a separate latency budget from deterministic correction.

V4.0 target:

- p95 typing-pause-to-ghost-visible latency below 800 ms.

Deterministic correction p95 targets remain separate and must not be weakened
by remote completion.

The mocked browser benchmark uses deterministic local mock latency. It warns
above 800 ms p95 typing-pause-to-ghost-visible latency and fails above 2000 ms
p95. This threshold is separate from deterministic correction's 20 ms browser
benchmark target.

## Metrics

Metrics are local/session-only by default. They exist for Path A learning:
understanding whether the endpoint-based, caret-only remote completion
prototype feels fast, useful, dismissible, and reversible before Typai expands
to additional editor surfaces or provider modes.

V4 local metrics track:

- `request_scheduled`.
- `request_canceled_before_send`.
- `request_aborted_in_flight`.
- `request_budget_exceeded`.
- `provider_error`.
- `provider_timeout`.
- `invalid_response`.
- `rate_limit_cooldown_started`.
- `provider_latency`.
- `stream_started`.
- `stream_delta`.
- `stream_completed`.
- `stream_aborted`.
- `stream_stale_delta_dropped`.
- `ghost_shown`.
- `ghost_dismissed_by_typing`.
- `ghost_dismissed_by_escape`.
- `ghost_dismissed_by_selection_change`.
- `ghost_dismissed_by_blur`.
- `ghost_dismissed_by_composition`.
- `ghost_accepted`.
- `completion_reverted`.
- `stale_response_dropped`.

Timing metrics include:

- Time from last user input to request start.
- Provider latency.
- Time from request start to response.
- Time from last user input to ghost visible.
- Time from ghost visible to accept or dismiss.

Metric payloads are intentionally small. They may include request ID,
completion mode, surface category, context-before length, context-after length,
completion length, latency, provider name, status, dismiss/error reason,
provider error kind, retry-after duration, cooldown deadline, and budget limit.

Metric payloads must not include:

- Full document text.
- Raw prompt context.
- Full surrounding paragraphs.
- Stable document IDs.
- Provider API keys.
- Private provider secrets.

The default in-memory log is a rolling local/session event log. V4 does not add
analytics upload, server telemetry, persistent cross-session telemetry, or
next-edit logging.

## Mock Demo

`examples/simple-demo-editor` includes a `V4 Remote Completion` tab for manual
prototype testing.

The demo:

- Uses contenteditable only.
- Uses `@typai/completion-remote`.
- Uses a deterministic mock provider by default.
- Does not call OpenAI or any other provider directly.
- Does not ask for or store a browser provider API key.
- Does not require a server route.
- Shows local/session metrics for requests, ghost visibility, accept, dismiss,
  revert, and p95 ghost latency.

Manual verification path:

- Type at least 12 characters.
- Wait for subtle gray ghost text at the caret.
- Press Tab to accept.
- Press Escape or keep typing to dismiss.
- Revert an accepted completion with the demo's revert control.

## E2E Coverage

`tests/e2e/remote-completion.spec.ts` covers the mocked V4 demo in Chromium and
Firefox. WebKit is intentionally not part of the current matrix.

Covered paths:

- Ghost text appears after debounce and remains out of the adapter source text.
- Tab accepts ghost text and increments the accepted metric.
- Escape, typing, selection change, and compositionstart dismiss ghost text.
- Accepted completion revert removes exactly the inserted completion.
- Stale mock-provider responses are dropped and counted locally.
- Correction transactions dismiss visible completion and completion can reschedule
  after typing resumes.
- Tests guard against requests to real provider domains such as `api.openai.com`
  and check that provider keys are not sent in request payloads.

The E2E path uses only the deterministic mock provider. It does not use a real
OpenAI endpoint, provider SDK, browser provider key, streaming response, or
server route.

## Package Readiness

`@typai/completion-remote` is included in local package readiness:

- `pnpm pack:dry` includes the package and validates the tarball surface.
- `pnpm smoke:install` installs the packed package, imports the remote
  completion entrypoints, runs a deterministic mocked completion request, and
  verifies `@typai/core` does not depend on `@typai/completion-remote`.
- CI explicitly builds and tests `@typai/completion-remote`.
- CI runs V4 remote completion E2E in Chromium and Firefox with mocked provider
  behavior.
- `pnpm bench:browser` includes the mocked remote completion ghost latency
  smoke benchmark.

The package ships `dist`, `README.md`, and type declarations. It does not ship
tests, reports, examples, or browser artifacts in the dry-run tarball.

## Explicit Boundaries

- No OpenAI SDK is added to the browser package.
- No browser provider API-key path is added.
- No production server implementation is added.
- No real provider calls are required by tests, E2E, demos, or benchmarks.
- No automatic retry is enabled by default.
- No real streaming provider or endpoint streaming is implemented.
- Textarea, React, and CodeMirror completion are V4.1 surface-expansion work,
  not part of the original V4.0 contenteditable prototype boundary.
- Codex adapter integration is not added.
- No next-edit logging is added.

## Hardening Checkpoint

The V4.0 hardening audit is recorded in
`docs/v4-remote-completion-complete.md`.

The audit confirmed:

- `@typai/core` remains no-remote deterministic correction.
- `@typai/completion-remote` has no OpenAI SDK dependency and no browser API-key
  path.
- Endpoint provider code calls only the embedder endpoint passed by the host.
- Contenteditable ghost text remains visual-only until Tab accept.
- Accepted completions use completion transactions and exact revert, not blue
  correction marks.
- Metrics are local/session-only and exclude raw prompt context and full
  document text.
- Mocked Chromium/Firefox E2E, package smoke install, dry-run packing, and
  browser benchmark coverage are part of the checkpoint.
