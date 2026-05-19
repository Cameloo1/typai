# Provider Proxy

Typai browser packages should call an embedder-owned endpoint for completion.
They should not call a model provider directly.

The provider proxy pattern is:

1. browser extracts bounded completion context
2. browser sends `{ request }` to the embedder endpoint
3. server validates the request
4. server authenticates the user and applies rate limits
5. server calls a provider only when configured
6. server returns insertion-only text

Provider credentials stay server-side. The reference proxy examples default to
mock mode and have an optional server-side OpenAI Responses path that is
disabled unless explicit environment variables are set.
