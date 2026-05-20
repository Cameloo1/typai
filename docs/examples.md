# Examples

Typai examples are split between small consumer apps and provider-proxy
examples. They are useful for evaluating the beta, but they are not themselves
published packages.

Current beta facts:

- registry packages are `0.0.0-beta.0`
- npm `beta` resolves to that version
- registry smoke passed from public npm packages
- production language assets are not bundled
- completion examples default to mock behavior

## Install From npm

External consumers can install the beta packages directly:

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
npm install @typai/completion-remote@beta
```

## Consumer Examples

| Example | What It Shows | Provider Calls |
| --- | --- | --- |
| `examples/consumer-vanilla-contenteditable` | local correction on a `contenteditable` element | none |
| `examples/consumer-vanilla-textarea` | local correction on a native textarea with overlay marks | none |
| `examples/consumer-react` | `TypaiProvider`, `TypaiTextarea`, and `TypaiContenteditable` | none |
| `examples/consumer-codemirror` | CodeMirror 6 correction extension | none |
| `examples/consumer-completion-with-proxy` | optional completion through an embedder endpoint | mock proxy by default |

Run a consumer example:

```sh
pnpm install
pnpm build
pnpm --filter consumer-vanilla-textarea dev
```

## Provider Proxy Examples

| Example | Runtime Shape | Default Provider Mode |
| --- | --- | --- |
| `examples/provider-proxy-express` | Express-style server endpoint | mock |
| `examples/provider-proxy-next` | Next-style route handler | mock |
| `examples/provider-proxy-cloudflare-worker` | Worker-style handler | mock |

The proxy examples demonstrate the boundary: browser code sends a Typai
completion request to an embedder-owned endpoint, and the endpoint owns any real
provider integration. Mock mode is the normal local and CI path.

Start the shared local proxy:

```sh
pnpm dev:completion-proxy
```

Default endpoint:

```text
http://127.0.0.1:8787/api/typai/completion
```

OpenAI mode exists only as a manual, server-side demo path. See
[Real-provider demo](./real-provider-demo.md).

## Full Demo App

`examples/simple-demo-editor` is the broad integration demo. It includes:

- contenteditable correction
- textarea correction and overlay marks
- React textarea/contenteditable surfaces
- CodeMirror correction
- mocked ghost completion
- optional local proxy completion mode
- settings and debug surfaces used by tests

Run it:

```sh
pnpm --filter simple-demo-editor dev
```

The full demo is also used by Playwright coverage for typo correction,
valid-word safety, protected-token safety, casing/punctuation preservation,
personal dictionary behavior, correction rules, and completion ghost behavior.

## What Examples Do Not Prove

- They do not prove production dictionary coverage.
- They do not use a bundled production language asset.
- They do not make real provider calls in automated test paths.
- They do not ship provider proxy code inside library tarballs.
- They do not add a real Codex adapter.
- They do not add grammar/style, local inference, or next-edit logging.
