# V4.1 Completion Surface Expansion Complete

Status date: 2026-05-19.

V4.1 Completion Surface Expansion is complete for the current checkpoint. Typai
now supports optional, mocked remote completion across contenteditable, native
textarea, React textarea/contenteditable wrappers, and CodeMirror while keeping
deterministic correction local and unchanged.

This document is the hardening audit and handoff point for the phase. It records
what was added, the verified safety boundaries, package readiness, benchmark
coverage, known limitations, and recommended next phase options.

## What Was Added

- Shared completion surface contracts and conformance tests in
  `@typai/adapter-testkit`.
- Provider resilience in `@typai/completion-remote`: typed provider errors,
  endpoint response validation, timeout/abort handling, rate-limit cooldown,
  request budgets, no retry by default, and privacy-safe metrics.
- Textarea ghost-text feasibility utilities, production ghost renderer, Tab
  accept, dismiss behavior, transactions, and exact revert.
- React completion integration for `TypaiTextarea`, `TypaiContenteditable`,
  `useTypaiTextarea`, `useTypaiContenteditable`, and optional provider context.
- CodeMirror ghost-text decorations, dismiss behavior, Tab accept, native
  transactions, protected context suppression, completion transactions, and
  exact revert.
- Mocked demos for contenteditable, textarea, React, and CodeMirror completion.
- Chromium and Firefox Playwright E2E coverage for all V4.1 completion surfaces.
- Optional mocked streaming support behind `streaming.enabled`; non-streaming
  remains the default.
- Package dry-run, smoke install, CI, and browser benchmark readiness gates for
  the expanded surface.

## Supported Completion Surfaces

- Contenteditable.
- Native `<textarea>`.
- React textarea component/hook.
- React contenteditable component/hook.
- CodeMirror.

No V4.1 completion support exists for ProseMirror, Monaco, browser extensions,
or a real Codex adapter.

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
- `examples/simple-demo-editor`
- `tests/golden-corpus`

`@typai/completion-remote` is optional. Existing deterministic correction
adapters work without it installed or configured.

## Architecture Boundaries

`@typai/core` remains local deterministic correction only:

- No import of `@typai/completion-remote`.
- No remote completion provider.
- No completion scheduler.
- No network call.
- No local model inference.
- No next-edit logging.

`@typai/completion-remote` owns:

- Provider interfaces.
- Mock provider behavior.
- Endpoint provider behavior.
- Scheduling, debounce, abort, stale response handling, and metrics.
- Typed provider errors and request budgets.
- Feature-flagged mocked streaming support.

Adapters own:

- Editor-specific ghost rendering.
- Editor state snapshots and stale guards.
- Explicit accept handling.
- Transaction-safe insertion.
- Exact revert.
- Surface-specific dismissal.

React composes existing adapters. React does not construct provider keys or make
completion mandatory.

## Provider Safety

The endpoint provider calls only the host-provided embedder endpoint. It does
not hard-code `api.openai.com` or another model-provider URL, does not include
an OpenAI SDK dependency, and does not expose a browser provider-key option.

Browser demos, tests, E2E, and benchmarks use mocked providers. E2E blocks real
provider domains and asserts no provider secrets appear in DOM text or request
payloads.

Forbidden-source audit result:

- No source implementation match for `dangerouslyAllowBrowserKey`.
- No source implementation match for real OpenAI SDK imports.
- No source implementation match for hard-coded browser calls to
  `api.openai.com`, OpenRouter, or Anthropic.
- `OPENAI_API_KEY` and provider-key strings appear only in docs, guard tests,
  and package-smoke/pack-dry checks.
- `localStorage`, next-edit, server/local-service, and local-model references
  are docs-only or negative-scope mentions.

## Ghost Text Behavior

Ghost text is visual only until explicit user acceptance.

Contenteditable:

- Renders a `contenteditable="false"` ghost span with `data-typai-ghost="true"`
  and `aria-hidden="true"`.
- Adapter source snapshots exclude ghost text.
- Copy/paste/source text behavior remains based on non-ghost content.

Textarea:

- Renders ghost text in the overlay/mirror layer.
- `textarea.value` is not mutated until Tab accept.
- Ghost text is `aria-hidden`, not submitted in forms, and not copied as
  textarea value.

React:

- Passes structural completion controllers into the underlying textarea and
  contenteditable adapters.
- Works with or without completion props.
- Unmount cleanup detaches completion controllers and adapter listeners.

CodeMirror:

- Renders ghost text through CodeMirror decorations/widgets.
- Ghost text is not part of `doc.toString()`.
- Accepted insertion uses CodeMirror transactions.

## Accept, Dismiss, And Revert

Tab is the explicit accept action across supported completion surfaces. Space,
Enter, typing, or silent insertion do not auto-accept completions.

On accept, each adapter verifies the current editor state against the stored
snapshot/range/version before mutating source text. Accepted completions create
completion transactions and remain separate from correction transactions.

Dismiss behavior is covered for:

- Escape.
- Further typing.
- Selection changes.
- Composition/IME start.
- Blur.
- Paste.
- Correction transactions.
- Stale provider responses or stale ghost snapshots.

Exact revert is supported for accepted completions on contenteditable, textarea,
React surfaces through their underlying adapters, and CodeMirror. Revert fails
safely when the inserted range no longer matches.

Accepted completions are not blue correction marks. Red and blue correction
semantics are unchanged:

- Red means unresolved spelling issue.
- Blue means typai changed a word through deterministic correction or a
  correction suggestion.

## Metrics And Privacy

Completion metrics include:

- Latency and timing fields.
- Accept, dismiss, revert, request, stale, provider-error, timeout, invalid
  response, cooldown, budget, and streaming counts.
- Context lengths.
- Completion length.
- Mode and surface.
- Provider name and provider error kind.

Default metrics do not include:

- Full document text.
- Raw prompt context.
- Full surrounding paragraph.
- Raw metadata.
- Stable document ID.
- API key or provider secret.

The metrics tests cover internal and external metric sinks and provider-error
events to ensure raw context and raw metadata are not logged.

## E2E Coverage

V4.1 Playwright E2E covers Chromium and Firefox. WebKit is intentionally
skipped.

Covered completion surfaces:

- Contenteditable completion.
- Textarea completion.
- React textarea completion.
- React contenteditable completion.
- CodeMirror completion.

Covered scenarios include ghost rendering, source text excluding ghost before
accept, Tab accept, accepted source text, exact revert, Escape dismiss, typing
dismiss, selection-change dismiss, stale response dropping, provider-error
non-mutation, correction-transaction dismissal, metrics updates, no real
provider calls, React rerender/unmount cleanup, and CodeMirror protected
Markdown/code contexts.

## Package Readiness

Package readiness covers:

- `pnpm pack:dry`
- `pnpm smoke:install`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm --filter @typai/core bench`
- `pnpm bench:browser`
- `pnpm build`
- `pnpm lint`

Dry-run packaging includes `@typai/completion-remote` and excludes tests,
reports, examples, server routes, demo files, raw source files, and provider
secret-like values in inspectable packed code.

Smoke install verifies:

- `@typai/completion-remote` import.
- `createMockCompletionProvider`.
- `createMockStreamingCompletionProvider`.
- `createEndpointCompletionProvider`.
- `createRemoteCompletion`.
- Structural completion options for contenteditable, textarea, React, and
  CodeMirror.
- `@typai/core` imports and works without depending on completion-remote.

CI runs completion-remote tests, mocked streaming tests, V4.1 E2E,
browser benchmarks, package smoke, Chromium and Firefox only, and no real
provider secrets.

## Benchmark Status

Browser benchmarks report count, mean, p50, p95, p99, and max.

Deterministic correction benchmarks are reported separately from mocked remote
completion benchmarks:

- Deterministic correction warns above 20 ms p95 and fails above 100 ms p95.
- Mocked remote completion targets p95 below 800 ms, warns above 800 ms, and
  fails above 2000 ms.

Current browser benchmark surfaces:

- Deterministic contenteditable correction.
- Deterministic textarea correction.
- Deterministic CodeMirror correction.
- Contenteditable completion.
- Textarea completion.
- React textarea completion.
- CodeMirror completion.

Some mocked completion surfaces can warn above the 800 ms target because the
demo path includes debounce and browser rendering overhead. The hard failure
threshold remains 2000 ms.

## Known Limitations

- No real Codex adapter.
- No local completion engine.
- No next-edit logging.
- No ProseMirror completion.
- No Monaco completion.
- No browser extension.
- No production provider/server examples.
- No real OpenAI/provider calls in demos, E2E, tests, or benchmarks.
- No private provider API key path in browser code.
- No local model inference.
- No grammar/style/tone/clarity behavior.
- No production dictionary asset.
- No SymSpell.
- No WebKit E2E or benchmark gate.

## Recommended Next Phase Options

- Real Codex adapter, still preserving provider and source-mutation safety
  boundaries.
- Provider/server examples for embedder-owned endpoints.
- Path B local completion research.
- Production dictionary and SymSpell work for deterministic correction.
- Apple-style personalization and local user memory research.
- Async grammar/style editor phase, separate from deterministic correction and
  V4.1 completion.
