# Examples

## Simple Demo Editor

Run:

```bash
pnpm --filter simple-demo-editor dev
```

Browser E2E and benchmark smoke:

```bash
pnpm test:e2e
pnpm bench:browser
```

The demo has six tabs:

- Contenteditable Demo: the original contenteditable adapter demo.
- Textarea Demo: native `<textarea>` plus `@typai/textarea` overlay mirror.
- React Demo: `TypaiProvider`, `TypaiTextarea`, `TypaiContenteditable`,
  settings, debug, and memory controls from `@typai/react`.
- CodeMirror Demo: CodeMirror 6 plain text and Markdown modes using
  `@typai/codemirror` transactions, red unresolved marks, blue applied marks,
  and V1B popovers.
- Codex Mock Demo: a CodeMirror Markdown prompt-composer mock. It is demo-only
  and does not integrate with Codex, call APIs, or render completion UI.
- Chat Input Demo: a native textarea styled as a generic chat composer.

Textarea and chat demos keep `textarea.value` as the source of truth. The
overlay mirror renders red unresolved spelling marks and blue correction marks;
it is not submitted with forms and does not insert markup into the textarea.
The textarea demo includes native form submit/reset checks, and the adapter
respects `readonly`, `disabled`, and IME composition states.

Chat input behavior:

- Enter sends the message.
- Shift+Enter inserts a newline.
- typai correction runs while typing before send.
- Sent messages are read from `textarea.value`.

Manual textarea checks:

- Type `teh ` and expect `the ` with a blue dotted mark.
- Open the blue mark controls and revert to `teh`.
- Type `reciept ` and expect a red mark with `receipt` as a suggestion.
- Apply `receipt` and expect a blue mark on the corrected word.
- Type `form `, `user@example.com `, and `/etc/passwd ` and expect no
  correction.
- Type or paste multiple lines, then scroll to check overlay synchronization.
- Submit the textarea form and verify the output matches the corrected
  `textarea.value`.
- Use Native Reset and verify the textarea value, overlay, and active marks are
  cleared.

Manual React checks:

- Open the React Demo tab.
- Verify Provider core reports `ready`.
- Type `teh ` in the React textarea and expect `the ` with a blue mark.
- Type `reciept ` and expect a red mark with `receipt` as a suggestion.
- Type `form ` and `user@example.com ` and expect no correction.
- Toggle Autocorrect off and verify `teh ` is left as plain text while
  spellcheck can still mark it.
- Click Re-render React Demo and verify only one textarea overlay is attached.

Manual CodeMirror checks:

- Open the CodeMirror Demo tab.
- In plain text mode, type `teh ` and expect `the ` with a blue mark.
- Type `reciept ` and expect a red mark with `receipt` as a suggestion.
- Apply the suggestion and expect `receipt ` with a blue mark.
- Type `form `, `user@example.com `, `https://example.com/teh `, and
  `/etc/passwd ` and expect no correction.
- Switch to Markdown mode and type `` `teh` `` followed by a space; expect no
  correction or mark.
- In Markdown mode, type a fenced code block containing `teh ` and expect no
  correction.
- In a normal Markdown paragraph, type `Please teh ` and expect
  `Please the `.

Manual Codex mock checks:

- Open the Codex Mock Demo tab.
- Verify the visible "Codex mock only" label.
- Type ordinary prose such as `Please teh ` and expect prose correction.
- Type command-like, code-fenced, CVE, tool-name, and path examples and expect
  them to remain unchanged.
- Click Run mock prompt and verify the output states that no Codex APIs are
  called.

The examples do not include completion UI, ghost text, provider endpoints, or
remote completion packages.
