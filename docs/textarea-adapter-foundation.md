# Textarea Adapter Foundation

Completion audit: [textarea-adapter-foundation-complete.md](textarea-adapter-foundation-complete.md)

## Why This Phase Exists

Typai's product goal is embeddable correction for ordinary writing surfaces.
Native textarea support is a major step toward "install into any chat input."

Native `<textarea>` cannot render per-word inline marks inside the control.
Therefore `@typai/textarea` must use an explicit overlay mirror strategy.

## Selected Rendering Mode

```text
overlay mirror:
  keep the native textarea as the source of truth
  render marked text in a synchronized mirror layer
  preserve textarea focus, selection, typing, scrolling, resize, and form behavior

Rejected modes for this phase:

replacement editor:
  not used because it changes the host control semantics

degraded mode:
  not used first because inline visual marks are needed for product parity
```

## Goals

- Add `@typai/textarea` package.
- Preserve native textarea as source of truth.
- Add overlay mirror rendering for red and blue marks.
- Share as much adapter logic as practical with contenteditable/core types.
- Maintain `documentVersion` and token-text safety.
- Keep `checkCompletedToken()` and `suggestToken()` synchronous after
  initialization.
- Preserve existing C++/Rust/Wasm engine boundaries.
- Add generic chat-input demo.
- Add Playwright E2E for textarea behavior.
- Add accessibility and keyboard behavior.
- Add package readiness and smoke install coverage.

## Non-goals

- No SymSpell/delete index.
- No production dictionary asset.
- No edit-distance autocorrect.
- No valid-word autocorrect.
- No grammar/style/tone/clarity.
- No LLM/model calls.
- No server/local-service/API.
- No browser extension.
- No Codex implementation.
- No React/ProseMirror/CodeMirror/Monaco.
- No contenteditable replacement.
- No deep mobile IME final polish.
- No arbitrary rich editor abstraction.
- No next-edit logging.

## Textarea-specific Constraints

- The textarea value is the source of truth.
- The overlay must never accept user input.
- The overlay should use `pointer-events: none` except for deliberate
  mark/popover triggers if required.
- The overlay must not break form submission.
- The textarea must keep focus.
- The textarea must remain accessible.
- The adapter must work without persistence if the host uses memory storage.
- The adapter must work with IndexedDB storage if the host passes it through
  core.
- Mark rendering must not alter `textarea.value`.
- All mutations must verify `rangeStillMatches` before applying.
- Protected spans are hard write barriers.
- Valid words are not autocorrected.
- Edit-distance suggestions are suggestions-only.

## Risks

- Line wrapping differences.
- Font metric mismatch.
- Scroll synchronization.
- High-DPI rendering.
- Resize handling.
- Caret not visible in overlay.
- Marked text range positioning.
- IME composition.
- Mobile virtual keyboard.
- Browser differences.
- Long text performance.

## Acceptance Criteria

- `@typai/textarea` package exists.
- Textarea overlay mirror renders red/blue marks.
- Autocorrect works on completed token after delimiter.
- Unresolved words render red marks.
- Blue marks allow review/revert.
- Red marks allow suggestions and V1B controls.
- Protected tokens are not corrected.
- Valid words are not corrected.
- Stale writes are prevented.
- Scroll and resize behavior are covered by tests.
- Playwright covers Chromium and Firefox.
- Package dry run and smoke install include `@typai/textarea`.
- Docs explain overlay mirror limitations.

## Implementation Boundary

This phase starts by locking the source-of-truth scope. It does not create the
package, add code, or change product behavior until a later implementation
prompt explicitly does that work.

When implementation begins, the package must keep the existing architecture:

- C++ owns deterministic correction and suggestion logic.
- Rust owns the Wasm module and calls C++ through the narrow C ABI.
- TypeScript owns package APIs, storage state, protected-span helpers, and
  editor adapters.
- The core hot path remains synchronous after `createTypaiCore()` resolves.

## Overlay Mirror Contract

The adapter must keep the native `<textarea>` as the writable control and render
visual correction state in a separate synchronized mirror layer. The mirror is a
view, not state ownership.

The implementation should treat these as hard boundaries:

- Reads originate from `textarea.value`.
- Writes go through textarea-safe range operations.
- The overlay does not mutate document text.
- The overlay does not steal focus during normal typing.
- Form behavior remains native.
- Selection behavior remains native.
- Scrolling and resize synchronization are test-covered behaviors, not manual
  best-effort polish.

## Overlay Limitations To Document

Overlay mirror support is intentionally product-real but browser-sensitive.
Implementation docs and public package docs must be explicit about the limits:

- Visual marks are mirrored, not actually inside the native control.
- Font, padding, line height, wrapping, scroll, and zoom differences can affect
  mark alignment.
- High-DPI displays and browser text rendering can expose off-by-pixel drift.
- IME and mobile keyboard handling need coverage, but deep final mobile polish
  is outside this foundation phase.
- Very long text may require throttling or incremental mirror updates.

## Accessibility And Native Semantics

The textarea remains the accessible text control. The mirror is marked
`aria-hidden` so screen readers do not hear duplicated text. Review controls for
red and blue marks are separate keyboard-accessible buttons with labels, and the
popover uses non-modal dialog semantics with Escape-to-close behavior. Live
status messages announce applied corrections, reverted corrections, spelling
marks, suggestion applications, and dictionary actions.

The adapter must preserve native form behavior:

- `textarea.value` is the submitted value.
- The overlay never submits form data and never inserts markup into the value.
- Native form reset is allowed to reset the textarea, then the adapter resyncs
  the mirror and removes stale marks.
- `required`, placeholder, focus, selection, and browser validation remain owned
  by the native textarea.
- `readonly` and `disabled` textareas are treated as not writable: the adapter
  may resync the overlay, but it does not run correction writes or suggestion
  mutations.

IME and mobile input are guarded conservatively. Composition updates do not
trigger correction, and after composition ends the adapter waits for a later
explicit delimiter input before applying Typai logic. The overlay does not create
hidden focus traps and should not interfere with the virtual keyboard.

Resize handling is best-effort and explicit: the overlay tracks `ResizeObserver`
updates, window resize, scroll, and direct style/class changes where browser
APIs are available. Hosts with custom auto-resize behavior can call the
adapter's `resyncOverlay()` method after changing textarea dimensions.

## Demo Surface

`examples/simple-demo-editor` now keeps the original contenteditable demo and
adds two `@typai/textarea` surfaces:

- Textarea Demo: a native textarea with the overlay mirror enabled, visible
  autocorrect and spellcheck toggles, storage mode selection, memory
  import/export/reset controls, and debug counters for decisions, latency,
  corrections, unresolved marks, protected skips, reverts, and active marks.
- Chat Input Demo: a generic native textarea composer. Typai corrects while the
  user types. Enter submits the message, Shift+Enter inserts a newline, and the
  submitted message is read from `textarea.value`.

Run the demo with:

```bash
pnpm --filter simple-demo-editor dev
```

Manual checks:

- `teh ` becomes `the ` and renders a blue dotted overlay mark.
- `reciept ` renders a red mark with `receipt` available from the popover.
- Applying a suggestion updates `textarea.value` and renders a blue mark.
- `form ` remains unchanged.
- `user@example.com ` and `/etc/passwd ` remain unchanged.
- Multiline text and scroll behavior keep the mirror synchronized.
- Native form submit reads the corrected `textarea.value`; native form reset
  clears the value and resyncs the overlay.
- `readonly` and `disabled` textareas do not receive Typai correction writes.

The overlay remains a visual layer only. It does not own input state, does not
submit with forms, and does not insert markup into `textarea.value`.

## Package Readiness

`@typai/textarea` is package-ready for local dry runs and smoke installs. It is
not published to npm.

The package exports `attachTextarea` and related textarea types from
`dist/index.js` with `dist/index.d.ts` as the type entry. Its npm file allowlist
contains only `dist/`, `README.md`, and package metadata automatically included
by npm. It depends on `@typai/core` through the workspace dependency during
development and does not include a generated Wasm package of its own.

Consumer shape:

```ts
import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

const typai = await createTypaiCore();
const detach = attachTextarea({
  textarea: document.querySelector("textarea")!,
  typai,
});
```

Readiness commands:

```sh
pnpm --filter @typai/textarea build
pnpm --filter @typai/textarea test
pnpm pack:dry
pnpm smoke:install
pnpm test:e2e
pnpm bench:browser
```

`pnpm smoke:install` installs packed `@typai/core`, `@typai/contenteditable`,
and `@typai/textarea` into a temporary consumer project. The smoke imports
`attachTextarea`, attaches it to a minimal textarea-like control with overlay
disabled, and verifies `teh ` becomes `the `.

`pnpm bench:browser` reports both contenteditable and textarea browser-path
latency summaries. The textarea benchmark uses the demo textarea path with
`teh`, `adn`, `reciept`, `form`, `user@example.com`, `/etc/passwd`, and
`zzzzword`. Browser benchmark smoke gates warn above 20 ms p95 and fail above
100 ms p95.

## Required Test Surface

The implementation phase must prove ordinary textarea behavior, not only visual
rendering:

- Typing a completed common typo applies the same deterministic autocorrect path
  as contenteditable.
- Red unresolved marks appear without mutating `textarea.value`.
- Blue correction marks support review and revert.
- Red unresolved marks support suggestions and V1B actions.
- Protected spans block writes.
- Valid words stay untouched.
- Stale range writes fail closed when token text or `documentVersion` no longer
  matches.
- Scroll synchronization works with multi-line text.
- Resize synchronization works when the textarea changes dimensions.
- Chromium and Firefox Playwright coverage exists.

## Current Lock

Current phase: Textarea Adapter Foundation complete.

`@typai/textarea` exists and is wired into local package readiness, smoke
install, CI, E2E, and browser benchmark coverage. Overlay mirror is the selected
mode. Native textarea remains the source of truth. Do not implement a
replacement editor or degraded-only mode for this phase. Keep all previous
engine, storage, and product non-goals intact. The completion checkpoint is
documented in `docs/textarea-adapter-foundation-complete.md`.
