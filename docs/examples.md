# Typai Examples

Run the local demo app:

```sh
pnpm --filter simple-demo-editor dev
```

The demo app includes these surfaces:

- Contenteditable correction demo.
- Native textarea correction demo.
- React adapter demo.
- CodeMirror adapter demo.
- Codex-style mock prompt editor.
- V4 Remote Completion demo.
- Generic chat input demo.

## V4 Remote Completion Demo

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
