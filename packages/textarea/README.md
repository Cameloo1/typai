# @typai/textarea

`@typai/textarea` is the native textarea adapter for Typai.

Native `<textarea>` controls cannot render per-word inline marks inside the
actual control, so this adapter uses the overlay mirror strategy: the native
`textarea.value` remains the source of truth while visual correction marks are
rendered in a synchronized mirror layer.

This package requires an initialized `TypaiCore` from `@typai/core`. It does not
require a server, local service, API, browser extension, remote model, or Codex
integration.

## Usage

```ts
import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

const typai = await createTypaiCore();
const detach = attachTextarea({
  textarea: document.querySelector("textarea")!,
  typai,
});
```

Install package consumers with both packages:

```sh
npm install @typai/core @typai/textarea
```

Typai is not published to npm yet during this local readiness phase.

## Current Status

The current implementation has the core textarea event lifecycle and the
foundation overlay mirror engine.

- `attachTextarea()` validates the textarea and Typai core arguments.
- `attachTextarea()` returns an idempotent detach function.
- The adapter tracks snapshots, document versions, selections, and IME
  composition state.
- Delimiter input extracts the completed token before the cursor and calls
  `TypaiCore.checkCompletedToken()` with only that token text.
- Protected tokens are skipped before calling Typai core.
- Decision, red mark, protected-skip, and correction events are emitted
  synchronously.
- With overlay enabled, `attachTextarea()` wraps the textarea in a positioned
  overlay root, renders escaped plain text into a non-editable mirror, and syncs
  font, padding, box sizing, scroll offsets, and resize observations.
- Common typo auto-corrections are applied through guarded textarea transactions
  that verify the captured range and document version before writing.
- Applied corrections create blue marks and can be reverted from the returned
  detach/controller function.
- Unresolved words create red marks and edit-distance suggestions remain
  suggestions-only.
- Blue and red marks expose accessible review triggers that open V1B popovers for
  revert, suggestion application, ignore once, dictionary, always-correct,
  never-correct, and autocorrect-disable actions.
- Popover actions call the `TypaiCore` memory APIs from the TypeScript adapter and
  verify current textarea ranges before any text mutation.
- The adapter respects `readonly` and `disabled` textareas by resyncing visual
  state without applying correction writes.
- Native form submission reads `textarea.value`; native reset resyncs the mirror
  and removes stale marks.
- The simple demo includes native textarea and chat-input tabs.
- Local package dry-run, smoke install, CI, E2E, and browser benchmark coverage
  include `@typai/textarea`.

## Overlay Assumptions

- The native textarea remains focused, selectable, submittable, and is still the
  only source of truth.
- The mirror is `aria-hidden` and uses `pointer-events: none`.
- Separate mark review triggers are keyboard accessible and labelled.
- The textarea text remains visible. The mirror currently uses transparent text
  so it can track layout without drawing duplicate glyphs.
- Overlay rendering is visual-only and never changes `textarea.value`.
- The mirror copies the textarea styles that affect text layout, but exact
  wrapping can still vary across browsers, zoom levels, font loading states, and
  mobile virtual keyboard behavior.
- Popovers first try to position from rendered mirror mark spans. If geometry is
  unavailable, they fall back to a stable position at the textarea overlay edge.
- Composition updates do not trigger corrections; correction resumes only after a
  later explicit delimiter input.

## Verification

```sh
pnpm --filter @typai/textarea build
pnpm --filter @typai/textarea test
pnpm pack:dry
pnpm smoke:install
pnpm test:e2e
pnpm bench:browser
```
