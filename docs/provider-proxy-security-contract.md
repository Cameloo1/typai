# Provider Proxy Security Contract

Status date: 2026-05-19.

This contract defines the required security shape for future Typai provider
proxy examples and embedder-owned provider endpoints. It is not a provider
implementation and does not authorize direct browser provider calls.

## Threat Model

Threats in scope:

- Exposed API keys in browser bundles, static config, examples, logs, or
  response payloads.
- Open unauthenticated proxy abuse.
- Prompt or completion context leakage.
- Excessive context size causing cost, latency, privacy, or denial-of-service
  risk.
- Prompt injection into provider instructions.
- Cross-origin abuse.
- Rate-limit exhaustion.
- Accidental raw context logging.
- Provider errors leaking secrets, headers, account data, stack traces, or raw
  provider payloads.
- Deployment misconfiguration.
- CORS misconfiguration.
- Test fixtures accidentally using real providers.

## Required Proxy Controls

Every real provider proxy or example must provide:

- Server-side provider API key only.
- Required auth mechanism or same-origin session.
- Origin allowlist.
- Strict CORS.
- Request body size limit.
- Maximum context characters.
- Maximum completion characters.
- Provider timeout.
- Rate limit.
- No raw context logging by default.
- No API keys in response payloads.
- Safe error mapping.
- JSON schema validation.
- Optional context redaction hook.
- Optional audit log with redacted metadata only.

## Request Schema

The browser sends an embedder endpoint request shaped as:

```json
{
  "request": {
    "id": "request-1",
    "mode": "prompt",
    "contextBefore": "Bounded text before the cursor.",
    "contextAfter": "",
    "currentLine": "Bounded text before the cursor.",
    "cursorOffset": 31,
    "maxCompletionChars": 220,
    "stopSequences": [],
    "instruction": {
      "task": "continue",
      "style": "same_voice",
      "output": "continuation_only",
      "constraints": [
        "Return only text that should be inserted at the cursor."
      ]
    }
  }
}
```

`request` is required and must be validated as a `CompletionRequest`.

## Response Schema

The proxy returns insertion-only completion text:

```json
{
  "text": " safe continuation text",
  "model": "provider-model-name",
  "usage": {
    "inputTokens": 120,
    "outputTokens": 12
  },
  "finishReason": "stop"
}
```

`text` is required. `model`, `usage`, and `finishReason` are optional and must
not contain secrets.

## Error Schema

Errors must be safe and structured:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The completion request is invalid."
  }
}
```

Use stable error codes such as:

- `invalid_method`
- `invalid_content_type`
- `invalid_json`
- `invalid_request`
- `context_too_large`
- `completion_too_large`
- `unauthorized`
- `forbidden_origin`
- `rate_limited`
- `provider_timeout`
- `provider_unavailable`
- `internal_error`

Do not forward raw provider errors to browsers.

## Safe Logging Policy

Allowed by default:

- request ID.
- timestamp.
- mode.
- context length.
- requested completion length.
- generated completion length.
- latency.
- provider/model.
- status or safe error code.

Forbidden by default:

- full `contextBefore`.
- full `contextAfter`.
- provider API key.
- auth/session token.
- full generated completion unless debug opt-in is explicitly enabled.
- stable document ID.
- raw provider request or response payload.

Debug logging, when added later, must be opt-in, local-development-oriented,
redacted, and clearly documented.

## CI And Test Rules

- CI must use mock providers only.
- Tests must not require real provider credentials.
- Env-gated manual scripts must fail closed when credentials are absent.
- `.env.example` may document variables; `.env` files must not be committed.
- Browser examples must never ask for provider API keys.
