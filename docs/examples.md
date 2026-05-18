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

The demo has three tabs:

- Contenteditable Demo: the original contenteditable adapter demo.
- Textarea Demo: native `<textarea>` plus `@typai/textarea` overlay mirror.
- Chat Input Demo: a native textarea styled as a generic chat composer.

Textarea and chat demos keep `textarea.value` as the source of truth. The
overlay mirror renders red unresolved spelling marks and blue correction marks;
it is not submitted with forms and does not insert markup into the textarea.
The textarea demo includes native form submit/reset checks, and the adapter
respects `readonly`, `disabled`, and IME composition states.

Chat input behavior:

- Enter sends the message.
- Shift+Enter inserts a newline.
- Typai correction runs while typing before send.
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
