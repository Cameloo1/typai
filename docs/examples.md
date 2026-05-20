# Examples

Typai has focused consumer examples and one larger demo app.

These examples run from workspace packages in the current prepublish state.
Registry-based beta examples will be added only after a real publish and
registry smoke.

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

For a local proxy endpoint, run:

```sh
pnpm dev:completion-proxy
```

The runner defaults to mock mode at
`http://127.0.0.1:8787/api/typai/completion` and allows the local Vite demo
origin at `http://127.0.0.1:5173`. OpenAI mode is manual-only and requires
server-side environment gates. See [Real-provider demo](./real-provider-demo.md).

## Full Demo App

`examples/simple-demo-editor` remains the broad integration demo. It includes
contenteditable, textarea, React, CodeMirror, chat-input, mocked completion, and
an optional proxy completion mode. Mock completion remains the default.

The demo is also the Prompt 104 cross-surface spell-quality harness. Playwright
checks the same expanded typo autocorrections, suggestions-only behavior,
valid-word safety, protected-token safety, casing/punctuation preservation,
personal dictionary flow, and correction-rule flow across contenteditable,
textarea, React textarea, React contenteditable, and CodeMirror.

```sh
pnpm --filter simple-demo-editor dev
```

The full demo app uses mock providers for completion by default. Its V4 Remote
Completion tab can be switched to proxy mode for a local server endpoint; the
browser UI accepts an endpoint URL only, not provider credentials.

## Beta Example Limits

- examples are not published packages
- provider proxy examples are not bundled into library tarballs
- production dictionary and frequency assets are not bundled
- completion is optional and works through mock or server-owned providers
- local deterministic correction does not require a server
