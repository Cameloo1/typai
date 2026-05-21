# Typai Provider Proxy: Express Shape

This example shows the Express-style server boundary for Typai completion
requests. It defaults to deterministic mock mode and does not call any external
provider.

## Run

```sh
pnpm --filter provider-proxy-express test
pnpm --filter provider-proxy-express build
pnpm --filter provider-proxy-express dev
```

Copy `.env.example` into your local server environment if you want to change
the local origin or limits. Do not commit local environment files.

The dev runner starts a local endpoint at
`http://127.0.0.1:8787/api/typai/completion`, allows
`http://127.0.0.1:5173` unless `ALLOWED_ORIGIN` is set, and defaults to mock
mode.

The optional real-provider smoke is manual-only:

```sh
TYPAI_ALLOW_REAL_PROVIDER_TEST=1 PROVIDER_MODE=openai OPENAI_API_KEY=... pnpm smoke:real-provider:manual
```

That command may incur provider cost and must not be added to CI.

## Defaults

- `PROVIDER_MODE=mock`
- `ALLOWED_ORIGIN=http://127.0.0.1:5173` for the local full demo runner
- bounded context and completion limits from the shared proxy contract
- no provider key required
- no raw context logging

## Production Controls To Add

This example is a reference route shape. Before exposing a real provider mode,
mount it behind your normal server authentication or same-origin session and
add a rate limit keyed by user/session/IP. The V4.2 provider proxy contract
requires rate limiting for deployed provider endpoints; this example keeps that
control as an embedder-owned production hook.

## OpenAI Responses Mode

This example includes a server-side OpenAI Responses adapter through the shared
example utility package. The local dev runner refuses OpenAI mode unless
`TYPAI_ALLOW_REAL_PROVIDER_TEST=1`, `PROVIDER_MODE=openai`, and
`OPENAI_API_KEY` are set in the server environment. `OPENAI_MODEL` selects the
model; the example uses a conservative sample default when it is omitted.

The adapter sends only the validated Typai completion request context, applies
the requested completion character limit, uses a timeout, maps provider errors
to safe proxy errors, and does not log raw context.

Never put `OPENAI_API_KEY` or any provider credential in browser code. Browser
code should call your server proxy endpoint.

## Mounting

`handleTypaiExpressCompletionRequest()` accepts an Express-shaped request
object and returns a safe response object. A real Express app can adapt its
`req` and `res` to this function at `POST /api/typai/completion`.

Provider integrations belong on the server side. Browser code should call your
proxy endpoint and should never contain provider keys.
