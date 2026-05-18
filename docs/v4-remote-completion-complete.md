# V4 Remote Completion Prototype Complete

Status date: 2026-05-18.

V4 Remote Completion Prototype is complete for the V4.0 checkpoint. It adds an
optional remote completion package, contenteditable-only ghost text integration,
mocked provider demo coverage, local metrics, package readiness checks, and
Chromium/Firefox E2E coverage without changing the deterministic correction
contract.

## What Was Added

- `@typai/completion-remote` as a separate opt-in package.
- Provider interfaces, mock provider, and endpoint provider for
  embedder-controlled backend endpoints.
- Scheduler/state-machine behavior for debounce, cancellation, stale response
  dropping, provider errors, and local metrics.
- Bounded context extraction, continuation-only instruction shaping, light
  sanitization, and duplicate-prefix trimming.
- Structural contenteditable controller integration without importing
  `@typai/completion-remote` from `@typai/contenteditable`.
- Contenteditable ghost text rendering at the caret.
- Tab accept, Escape dismiss, typing dismiss, selection-change dismiss,
  composition dismiss, blur dismiss, paste dismiss, and correction-transaction
  dismiss.
- Transaction-safe accepted completion insertion and exact revert.
- Local/session metrics with privacy-safe event payloads.
- `V4 Remote Completion` demo in `examples/simple-demo-editor`.
- Mocked Chromium and Firefox Playwright E2E coverage.
- Package dry-run, smoke install, CI, and browser benchmark coverage.

## Package List

Current package surface:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/ui`
- `@typai/react`
- `@typai/codemirror`
- `@typai/adapter-testkit`
- `@typai/completion-remote`

`@typai/core` remains local deterministic correction only. It does not import or
depend on `@typai/completion-remote`.

## Contenteditable-Only Scope

V4.0 remote completion is contenteditable-only. The contenteditable adapter owns
visual ghost text and transaction-safe insertion/revert behavior through a
structural interface. Existing contenteditable correction behavior still works
without a completion controller installed.

No V4.0 completion surface exists for native textarea, React, CodeMirror,
ProseMirror, or Monaco.

## Provider Endpoint Contract

Browser code calls an embedder-controlled endpoint. The embedder endpoint calls
OpenAI Responses API or another provider from server-side code.

The browser package sends:

```json
{
  "request": {
    "id": "request-id",
    "mode": "prose",
    "contextBefore": "bounded text before the cursor",
    "contextAfter": "bounded text after the cursor",
    "currentLine": "current line before the cursor",
    "cursorOffset": 32,
    "maxCompletionChars": 220,
    "stopSequences": [],
    "instruction": {
      "task": "continue",
      "style": "same_voice",
      "output": "continuation_only",
      "constraints": []
    }
  }
}
```

The endpoint returns:

```json
{
  "text": " continuation text",
  "model": "provider-model-name",
  "usage": {
    "inputTokens": 10,
    "outputTokens": 4
  },
  "finishReason": "stop"
}
```

`@typai/completion-remote` does not include a production server and does not
call provider APIs directly from browser code.

## No Browser API Key Policy

Private provider API keys must stay server-side. Browser examples, demos, tests,
benchmarks, and E2E must not ask for, store, display, or transmit a private
provider key. `@typai/completion-remote` has no OpenAI SDK dependency and no
browser API-key configuration path.

## Ghost Text Behavior

Ghost text is visual only until the user accepts it.

Ghost DOM:

- `contenteditable="false"`
- `data-typai-ghost="true"`
- `aria-hidden="true"`
- `class="typai-ghost-text"`

Ghost text is not included in contenteditable source text snapshots, copy/paste
source content, saved content, or metrics payloads. It is removed on further
typing, Escape, selection change, compositionstart, blur, paste, correction
transactions, stale version/range checks, or manual clear.

## Accept, Dismiss, And Revert

Tab is the only V4.0 accept gesture. Space, Enter, and silent insertion do not
accept completions.

On Tab accept, Typai verifies that the visible ghost is still current for the
stored version, range, and caret position. The ghost span is removed, the
completion text is inserted as normal source text, and a completion transaction
is recorded.

Revert verifies that the current range still contains the exact inserted text.
If it matches, only that inserted completion is removed and the caret is
restored to the insertion point. If the range no longer matches, revert fails
safely without changing unrelated text or earlier correction transactions.

Accepted completions are not blue correction marks. Blue marks remain reserved
for deterministic correction transactions.

## Metrics And Privacy

Remote completion metrics are local/session-only by default and use an
in-memory rolling event log.

Metrics include:

- Request scheduled/canceled/aborted events.
- Provider errors and provider latency.
- Ghost shown, dismissed, accepted, reverted, and stale-response events.
- Latency timings for request start, provider response, ghost visible, and
  accept/dismiss.
- Request ID, mode, surface, context lengths, completion length, provider name,
  status, and reason.

Metrics do not include:

- Full document text.
- Raw prompt context.
- Full surrounding paragraph.
- Stable document ID.
- API key or provider secret.
- Next-edit logs.

## E2E Coverage

`tests/e2e/remote-completion.spec.ts` covers the mocked V4 demo in Chromium and
Firefox. WebKit is intentionally skipped.

Covered paths:

- Ghost appears after debounce.
- Ghost is not source text.
- Tab accepts and increments accepted metrics.
- Escape dismisses and leaves source text unchanged.
- Typing dismisses while preserving the typed character.
- Selection change dismisses.
- Compositionstart dismisses or suppresses scheduling.
- Accepted completion reverts exactly.
- Stale mock-provider response is dropped.
- Correction transactions dismiss visible completion and allow rescheduling.
- No real provider network call or provider key appears in DOM/network payloads.

## Package Readiness

Package readiness includes `@typai/completion-remote`.

- `pnpm pack:dry` validates the tarball surface.
- `pnpm smoke:install` installs packed tarballs and imports
  `createRemoteCompletion`, `createMockCompletionProvider`, and
  `createEndpointCompletionProvider`.
- The smoke app runs a mocked completion request and verifies core imports
  without completion-remote.
- CI builds/tests `@typai/completion-remote`.
- CI runs mocked V4 E2E in Chromium and Firefox.
- `pnpm bench:browser` reports deterministic correction latency separately from
  V4 mocked remote completion ghost latency.

## Hardening Audit Summary

Forbidden-source search passed for the V4.0 boundary.

Allowed hits were limited to:

- Docs that name future/non-goal items.
- Tests that assert forbidden behavior is absent.
- Endpoint contract pseudo-code in docs.
- The optional `streamComplete?` provider interface reserved for a later phase.
- Wasm loader `instantiateStreaming` generated by wasm-pack, unrelated to
  remote completion streaming.
- Historical archived planning docs.

No real browser OpenAI call, OpenAI SDK dependency, browser provider-key path,
textarea ghost implementation, React completion implementation, CodeMirror
completion implementation, next-edit logging, local model inference, silent
rewrite, or real Codex integration was found in the current V4 surface.

## Known Limitations

- No textarea ghost text.
- No React completion surface.
- No CodeMirror completion surface.
- No ProseMirror or Monaco completion surface.
- No streaming provider implementation.
- No multi-provider routing.
- No production server implementation.
- No real Codex integration.
- No local model inference.
- No specialized model training.
- No next-edit logging or prediction away from the caret.
- No partial accept.

## Next Recommended V4.1 Options

- Streaming provider support.
- Textarea ghost text research.
- React completion integration.
- CodeMirror completion integration.
- Provider error and rate-limit hardening.
- Partial accept.
- Path B local completion research.
