# Examples

Typai has focused consumer examples and one larger demo app.

## Consumer Examples

These are the best starting points for public-beta evaluation:

- `examples/consumer-vanilla-contenteditable` - local correction on a
  `contenteditable` element
- `examples/consumer-vanilla-textarea` - local correction on a native textarea
  with overlay rendering
- `examples/consumer-react` - `TypaiProvider`, `TypaiTextarea`, and
  `TypaiContenteditable`
- `examples/consumer-codemirror` - CodeMirror 6 extension
- `examples/consumer-completion-with-proxy` - optional completion through an
  embedder endpoint running in mock mode

Build all consumer examples through the root build:

```sh
pnpm build
```

Run one example:

```sh
pnpm --filter consumer-vanilla-textarea dev
```

## Provider Proxy Examples

These examples show server-side proxy shapes:

- `examples/provider-proxy-express`
- `examples/provider-proxy-next`
- `examples/provider-proxy-cloudflare-worker`

They default to `PROVIDER_MODE=mock`. The server-side OpenAI Responses path is
disabled unless explicit environment gates are set.

## Full Demo App

`examples/simple-demo-editor` remains the broad integration demo. It includes
contenteditable, textarea, React, CodeMirror, chat-input, and mocked completion
tabs.

```sh
pnpm --filter simple-demo-editor dev
```

The full demo app uses mock providers for completion and does not call a real
provider.
