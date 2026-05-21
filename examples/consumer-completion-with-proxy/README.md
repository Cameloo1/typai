# Consumer: Completion With Proxy

This example shows a browser consumer using `@typai/completion-remote` with an
embedder-owned endpoint. It does not call a model provider directly.

## Run

```sh
pnpm --filter consumer-completion-with-proxy build
pnpm --filter consumer-completion-with-proxy dev
```

The default endpoint is:

```txt
http://localhost:8787/api/typai/completion
```

Point that URL at a local mock provider proxy based on one of:

- `examples/provider-proxy-express`
- `examples/provider-proxy-next`
- `examples/provider-proxy-cloudflare-worker`

Keep the proxy in `PROVIDER_MODE=mock` for this consumer example. The
server-side OpenAI Responses path is separate and remains disabled unless the
proxy process is explicitly configured for it.

## Demonstrates

- `createRemoteCompletion()`
- `createEndpointCompletionProvider()`
- `createContenteditableCompletionController()`
- contenteditable ghost text through a proxy endpoint

## Does Not Demonstrate

- provider credentials in browser code
- direct browser-to-provider requests
- real provider calls by default
- npm registry installation
