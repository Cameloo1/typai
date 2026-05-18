# Typai Examples

Run the local demo app:

```sh
pnpm --filter simple-demo-editor dev
```

The demo app includes these surfaces:

- Contenteditable correction demo.
- Textarea completion and correction demo.
- React completion and correction demo.
- CodeMirror completion and correction demo.
- Codex-style mock prompt editor.
- V4 Remote Completion demo.
- Generic chat input demo.

All completion demos use deterministic mock providers through
`@typai/completion-remote`. They do not call OpenAI or any other real provider,
do not require a server, and do not expose a browser API-key field.

## Contenteditable Completion Demo

Open the `V4 Remote Completion` tab in `examples/simple-demo-editor`.

The demo uses `@typai/completion-remote` with a deterministic mock provider. It
does not call OpenAI, does not require a server, and does not ask for a browser
API key.

Manual path:

1. Keep completion enabled.
2. Type at least 12 characters in the contenteditable editor.
3. Pause for the displayed debounce plus mock latency.
4. Confirm subtle gray ghost text appears at the caret.
5. Press Tab to accept the completion.
6. Confirm accepted text becomes normal source text.
7. Use `Revert Completion` to remove the accepted completion.
8. Try Escape or continued typing to dismiss visible ghost text.

The metrics panel is local/session-only. It shows request count, ghost shown
count, accept count, dismiss count, revert count, and p95 ghost latency without
logging raw prompt context or full document text.

## Textarea Completion Demo

Open the `Textarea Completion Demo` tab.

Manual path:

1. Keep mocked completion enabled.
2. Type at least 8 characters in ordinary prose.
3. Pause for the debounce and mock latency.
4. Confirm gray ghost text appears near the caret in the overlay.
5. Confirm the submitted form value does not include ghost text before accept.
6. Press Tab to accept the completion.
7. Use `Revert Completion` to remove the exact inserted text.
8. Try Escape and continued typing to dismiss visible ghost text.

Textarea completion keeps `textarea.value` as the source of truth. The overlay
ghost is aria-hidden visual text; it is not copied, pasted, or submitted unless
Tab accepts it. The demo notes call out the remaining caret-alignment limits of
native textarea overlay rendering.

## React Completion Demo

Open the `React Completion Demo` tab.

Manual path:

1. Leave `Enable mocked completion` checked.
2. Type at least 8 characters in the React textarea, pause, then accept with
   Tab.
3. Repeat in the React contenteditable surface.
4. Use `Revert React Completion` after accepting text.
5. Turn `Enable mocked completion` off and confirm correction still works.
6. Use `Re-render React Demo` and confirm completion listeners are not
   duplicated.

The demo passes completion controllers explicitly to the React components. It
does not construct provider credentials in React code.

## CodeMirror Completion Demo

Open the `CodeMirror Completion Demo` tab.

Manual path:

1. Type at least 8 ordinary prose characters outside inline or fenced code.
2. Pause for the mocked provider and confirm CodeMirror ghost text appears as a
   decoration, not document content.
3. Press Tab to accept the completion.
4. Use `Revert Completion` to remove the exact inserted text.
5. Press Escape or keep typing to dismiss a visible completion.
6. Move into the inline-code or fenced-code examples and confirm completion is
   suppressed there when protected Markdown context applies.

CodeMirror completion uses CodeMirror decorations and transactions only. The
demo includes protected Markdown/code examples so prose completion can be
checked separately from inline and fenced code suppression.
