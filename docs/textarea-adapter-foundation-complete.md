# Textarea Adapter Foundation Complete

Status date: 2026-05-18

Textarea Adapter Foundation is complete as a public-alpha checkpoint.
`@typai/textarea` now exists as a package-ready native textarea adapter using
the overlay mirror strategy. Native `textarea.value` remains the source of truth,
and the overlay remains a visual layer for red unresolved spelling marks and
blue applied-correction marks.

This checkpoint closes the foundation phase. It does not publish to npm and does
not add new editor adapters beyond contenteditable and native textarea.

## What Was Added

- `@typai/textarea` package with ESM exports, TypeScript declarations, local
  build/test scripts, package README, and package file allowlist.
- Native textarea attach/detach lifecycle with document versioning, selection
  tracking, IME composition guard, delimiter handling, protected-token skips,
  and synchronous `TypaiCore.checkCompletedToken()` calls after initialization.
- Overlay mirror rendering that keeps the textarea as the real input and mirrors
  escaped text plus red/blue mark spans.
- Safe textarea correction transactions with `rangeStillMatches` checks,
  token-text checks, version checks, caret preservation, blue marks, and exact
  revert.
- V1B textarea popovers for blue corrections and red spelling suggestions:
  revert, suggestion apply, ignore once, add to dictionary, always-correct,
  never-correct, and disable-autocorrect actions.
- Accessibility hardening: labelled mark triggers, dialog popovers,
  Escape-to-close behavior, live-region announcements, focus return, and
  axe-core checks for textarea and chat demos.
- Native form hardening: form submit reads `textarea.value`, native reset
  resyncs the overlay, placeholder remains native, and `readonly`/`disabled`
  textareas do not receive adapter writes.
- Resize and scroll hardening through `ResizeObserver`, window resize, style
  resync, scroll synchronization, cleanup tests, and a public `resyncOverlay()`
  hook for host auto-resize behavior.
- Textarea Demo and Chat Input Demo in `examples/simple-demo-editor`.
- Chromium and Firefox Playwright E2E coverage for textarea typing, marks,
  popovers, protected tokens, scroll, resize, settings, persistence, form
  behavior, IME guard, keyboard behavior, and chat submission.
- Package dry-run, local smoke install, CI, and browser benchmark integration
  for `@typai/textarea`.

## Current Architecture

- C++ owns deterministic correction and suggestion logic.
- Rust owns the Wasm module and calls C++ through the narrow C ABI.
- TypeScript owns package APIs, storage state, protected-span helpers, and
  editor adapters.
- `createTypaiCore()` remains async.
- `checkCompletedToken()` and `suggestToken()` remain synchronous after
  initialization.
- No full document text is passed into C++ token APIs.
- User memory is loaded into TypeScript state during initialization; typing hot
  paths do not perform async storage reads.
- No C++ classes, `std::string`, or C++ memory ownership cross into JS/Rust.
- No Emscripten or Embind is used.

## Package API

Consumers create the core, then attach the textarea adapter:

```ts
import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

const typai = await createTypaiCore();
const detach = attachTextarea({
  textarea: document.querySelector("textarea")!,
  typai,
});
```

`attachTextarea()` returns a detach/controller function with:

- `revertTextareaCorrection(transactionId)`
- `getSettings()`
- `updateSettings(settings)`
- `resyncOverlay()`

The adapter depends on `@typai/core`. It does not include a Wasm package of its
own.

## Overlay Mirror Strategy

Native `<textarea>` cannot render per-word inline marks inside the control, so
`@typai/textarea` uses overlay mirror mode:

- The native textarea owns focus, selection, typing, scrolling, resize behavior,
  browser validation, and form submission.
- The overlay mirrors text and mark spans for visual underlines.
- The overlay mirror is `aria-hidden`.
- Separate mark review triggers are keyboard accessible and labelled.
- Overlay rendering never inserts markup into `textarea.value`.
- The overlay has `pointer-events: none` for visual text; popovers and triggers
  are separate controls.

## Known Limitations

- Underline alignment is browser/font/zoom sensitive because marks are mirrored,
  not native textarea decorations.
- High-DPI rendering and font metric differences can show small visual drift.
- Long text performance is smoke-covered, but no virtualization is implemented.
- IME composition is guarded, but deep mobile virtual keyboard polish remains a
  later phase.
- Popover geometry uses mirror mark spans when available and falls back near the
  textarea overlay edge.
- WebKit is not in the browser matrix for this phase.

## Test Coverage

Textarea unit and integration tests cover:

- Attach/detach lifecycle.
- Document version increments.
- Composition guard.
- Common typo autocorrection.
- Red unresolved mark emission and rendering.
- Blue applied correction mark rendering.
- Exact blue revert.
- Red suggestion application.
- Valid word no-correction.
- Protected email, URL, path, identifier, and CVE no-correction paths.
- Token mismatch and version mismatch stale-write prevention.
- Non-collapsed selection prevention.
- `readonly` and `disabled` mutation prevention.
- Mark invalidation after edits.
- Duplicate mark prevention.
- `textarea.value` remaining plain text.
- Overlay HTML escaping.
- Newline and trailing newline preservation.
- Style synchronization.
- Scroll synchronization.
- ResizeObserver, window resize, MutationObserver, and cleanup behavior.
- Overlay `aria-hidden` behavior.
- Live-region messages.
- Native form reset overlay resync.

Playwright E2E covers:

- Chromium and Firefox textarea autocorrect and blue overlay mark behavior.
- Blue popover revert.
- Red unresolved mark and suggestion application.
- Valid word no-correction.
- Protected token no-correction.
- Scroll synchronization.
- Multi-line correction.
- Autocorrect/spellcheck settings.
- IndexedDB personal dictionary persistence and reset.
- Native form submit and reset.
- `readonly` and `disabled` no-write behavior.
- Placeholder and resize behavior.
- Chat input send behavior.
- Keyboard popover open/close/action paths.
- IME/composition smoke behavior.
- Axe accessibility checks for contenteditable, textarea, and chat demo paths.

## Package Readiness Status

Local package readiness includes:

- `pnpm pack:dry` for `@typai/core`, `@typai/contenteditable`, and
  `@typai/textarea`.
- `@typai/core` tarball includes `dist/`, generated `pkg/`, and package
  metadata.
- `@typai/contenteditable` tarball includes `dist/` and package metadata.
- `@typai/textarea` tarball includes `README.md`, `dist/index.d.ts`,
  `dist/index.js`, `dist/index.js.map`, and package metadata.
- Generated `.pack/`, `packages/core/pkg/`, package `dist/`, demo `dist/`,
  Playwright reports, and test results remain ignored in Git.
- `pnpm smoke:install` installs packed core, contenteditable, and textarea
  packages into a temporary consumer project and verifies textarea correction
  through the packed adapter.

Npm publish is still not performed.

## Benchmark Status

Benchmarks remain smoke gates:

- Warn above 20 ms p95.
- Fail above 100 ms p95.
- Do not fail CI solely for exceeding the 20 ms product target.

`pnpm --filter @typai/core bench` covers direct core-path latency.
`pnpm bench:browser` reports both contenteditable and textarea browser-path
summaries with count, mean, p50, p95, p99, and max.

## Forbidden-Source Audit

The forbidden-source search checked:

- `emscripten`
- `embind`
- `openai`
- `anthropic`
- `llm`
- `model`
- `nextEdit`
- `next edit`
- `symspell`
- `prosemirror`
- `codemirror`
- `monaco`
- `react`
- `codex`
- `browser extension`
- `localhost`
- `server`
- `daemon`
- `localStorage`
- `XMLHttpRequest`
- `WebSocket`

Allowed hits were documentation/non-goal text, archived planning references,
Vite/Playwright dev-server config, lockfile integrity strings, and false
positives such as `rangeStillMatches`, `ResizeObserver`, and
`storageModeLabel`.

No source hit implemented a forbidden product feature.

## Non-goals Preserved

- No SymSpell/delete index.
- No keyboard adjacency.
- No edit-distance autocorrect.
- No valid-word autocorrect.
- No grammar/style/tone/clarity.
- No LLM/model calls.
- No server/local-service/API.
- No browser extension.
- No Codex implementation.
- No React/ProseMirror/CodeMirror/Monaco adapter.
- No next-edit logging.
- No production dictionary asset.
- No replacement editor mode.
- No degraded-only textarea mode.

## Next Recommended Phase Options

Choose the next phase explicitly. Good candidates:

- SymSpell/delete index, if suggestion lookup performance and scale become the
  main priority.
- Production dictionary blockers resolution, if license evidence, attribution,
  deterministic transforms, manifests, and redistribution approval can be closed.
- React adapter, if framework ergonomics become the next product need.
- Codex adapter planning, still implementation-later unless a new phase
  explicitly authorizes it.

Do not start any of these by implication.
