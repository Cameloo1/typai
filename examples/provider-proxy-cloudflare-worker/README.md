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

The optional real-provider smoke is manual-only:

```sh
TYPAI_ALLOW_REAL_PROVIDER_TEST=1 PROVIDER_MODE=openai OPENAI_API_KEY=... pnpm smoke:real-provider:manual
```

That command may incur provider cost and must not be added to CI.

## Defaults

- `PROVIDER_MODE=mock`
- `ALLOWED_ORIGIN=http://localhost:5173`
- bounded context and completion limits from the shared proxy contract
- no provider key required
- no raw context logging

## OpenAI Responses Mode

This example includes a server-side OpenAI Responses adapter through the shared
example utility package. It is disabled unless `PROVIDER_MODE=openai` and
`OPENAI_API_KEY` are set in the worker environment. `OPENAI_MODEL` selects the
model; the example uses a conservative sample default when it is omitted.

The adapter sends only the validated Typai completion request context, applies
the requested completion character limit, uses a timeout, maps provider errors
to safe proxy errors, and does not log raw context.

Never put `OPENAI_API_KEY` or any provider credential in browser code. Browser
code should call your worker endpoint.

## Browser Boundary

Browser code should call the worker endpoint. Provider integrations belong
inside the worker, never in browser bundles.
