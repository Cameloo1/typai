# Typai Provider Proxy: Next Route Handler

This example shows a Next-style route handler for
`app/api/typai/completion/route.ts`. It defaults to deterministic mock mode and
does not call any external provider.

## Run

```sh
pnpm --filter provider-proxy-next test
pnpm --filter provider-proxy-next build
```

Copy `.env.example` into your local Next server environment if you want to
change the local origin or limits. Do not commit local environment files.

## Defaults

- `PROVIDER_MODE=mock`
- `ALLOWED_ORIGIN=http://localhost:5173`
- bounded context and completion limits from the shared proxy contract
- no provider key required
- no raw context logging

## Browser Boundary

Browser code should call `/api/typai/completion`. Provider integrations belong
inside the server route, never in client components or browser bundles. The
provider-specific server adapter is intentionally left for the next V4.2 prompt.
