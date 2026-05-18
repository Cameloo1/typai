# Textarea Ghost Text Feasibility

Status date: 2026-05-18.

Prompt: V4.1-3 textarea ghost-text feasibility spike.

## Summary

Textarea ghost text is feasible enough to proceed to a production
implementation prompt, with constraints.

The spike added internal-only caret geometry utilities under
`packages/textarea/src/completion/` and a demo-only Playwright hook. It did not
wire `@typai/completion-remote` into `@typai/textarea`, did not implement Tab
accept, did not add provider calls, and did not expose a public textarea
completion API.

## What Was Tested

Unit coverage verifies that the experimental utilities:

- Do not throw for empty textareas.
- Do not write ghost text into `textarea.value`.
- Clear idempotently.
- Handle multiline values.
- Handle trailing spaces and trailing newlines.
- Can measure against an overlay mirror without mutating overlay text.

Playwright coverage verifies in the real demo surface that:

- A textarea value can be set and the caret placed after known text.
- An experimental ghost element appears.
- `textarea.value` remains unchanged.
- The ghost position is within tolerance of the overlay caret marker.
- Scrolling the textarea keeps the ghost aligned after resync.
- Resizing the textarea keeps the ghost aligned after resync.

The focused feasibility test passed in Chromium and Firefox.

## Implementation Shape

The spike uses a hidden mirror node with the same text, padding, border,
box-sizing, wrapping, and line-height style sync as the textarea overlay. Text
before the caret is rendered into the mirror, followed by a zero-width marker.
The marker's client rect is used as the candidate ghost origin.

The experimental ghost itself is a separate visual element. It is not inserted
into the native textarea value and does not create a Typai correction or
completion transaction.

## Known Alignment Limits

This approach depends on the mirror matching native textarea layout closely.
Known limits to account for in production:

- Browser textarea wrapping can differ at fractional pixels.
- Native caret painting is not directly readable from the textarea API.
- Horizontal scrolling, custom fonts loading late, zoom, and platform text
  rendering can shift the visual caret by a few pixels.
- Very long unbroken tokens may need extra wrapping checks.
- IME composition should suppress ghost rendering rather than trying to chase
  interim composition geometry.
- The current spike resyncs on scroll, resize, and explicit calls; production
  wiring should also resync on font readiness, value changes, selection changes,
  and overlay lifecycle changes.

## Browser Notes

Chromium and Firefox both passed the feasibility path with the current demo
styles. The test compares ghost placement against the overlay mirror marker, not
against a browser-native caret rect, because native textarea caret rects are not
available through a stable DOM API.

WebKit remains unverified in this repo's current E2E matrix.

## Source Of Truth

`textarea.value` remains the only source of truth for source text.

Ghost text must stay visual-only until explicit acceptance in a later prompt.
The feasibility harness proves this by rendering and clearing the ghost while
asserting the value remains unchanged.

## Decision

Acceptable to proceed.

Production textarea completion can build on this approach if the next prompt
adds the missing product behavior deliberately:

- Provider scheduling through `@typai/completion-remote`.
- Ghost lifecycle tied to typing, selection, composition, blur, paste, and
  correction transactions.
- Stale accept guards.
- Explicit Tab accept.
- Accepted-completion transaction and exact revert.
- Cross-browser tolerance checks.

No fallback is required yet. If production alignment fails later, the fallback
options remain a below-input suggestion chip, a degraded completion panel, or
contenteditable-only completion for V4.1.
