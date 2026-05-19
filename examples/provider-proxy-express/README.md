# Typai Provider Proxy: Express Shape

This example shows the Express-style server boundary for Typai completion
requests. It defaults to deterministic mock mode and does not call any external
provider.

## Run

```sh
pnpm --filter provider-proxy-express test
pnpm --filter provider-proxy-express build
```

Copy `.env.example` into your local server environment if you want to change
the local origin or limits. Do not commit local environment files.

## Defaults

- `PROVIDER_MODE=mock`
- `ALLOWED_ORIGIN=http://localhost:5173`
- bounded context and completion limits from the shared proxy contract
- no provider key required
- no raw context logging

## Mounting

`handleTypaiExpressCompletionRequest()` accepts an Express-shaped request
object and returns a safe response object. A real Express app can adapt its
`req` and `res` to this function at `POST /api/typai/completion`.

Provider integrations belong on the server side. Browser code should call your
proxy endpoint and should never contain provider keys. The provider-specific
server adapter is intentionally left for the next V4.2 prompt.
