# Typai Provider Proxy: Cloudflare Worker

This example shows a Cloudflare Worker-style `fetch()` handler for Typai
completion requests. It defaults to deterministic mock mode and does not call
any external provider.

## Run

```sh
pnpm --filter provider-proxy-cloudflare-worker test
pnpm --filter provider-proxy-cloudflare-worker build
```

Use `.env.example` as the local configuration shape for worker bindings or
local dev variables. Do not commit local environment files.

## Defaults

- `PROVIDER_MODE=mock`
- `ALLOWED_ORIGIN=http://localhost:5173`
- bounded context and completion limits from the shared proxy contract
- no provider key required
- no raw context logging

## Browser Boundary

Browser code should call the worker endpoint. Provider integrations belong
inside the worker, never in browser bundles. The provider-specific server
adapter is intentionally left for the next V4.2 prompt.
