# @typai/provider-proxy-testkit

Internal V4.2 testkit for provider proxy validation and conformance.

This package is for future server-side proxy examples. It keeps proxy request
validation, safe error mapping, and contract tests in one place so Express,
Next, Cloudflare Worker, or other examples cannot drift into slightly different
security behavior.

## What It Provides

- `validateCompletionProxyRequest()` for method, content-type, body size, JSON,
  and `CompletionRequest` shape validation.
- `createSafeErrorResponse()` and provider-error mapping helpers.
- `runProviderProxyContractSuite()` for reusable proxy contract tests.
- Fixtures for valid, oversized, invalid-mode, malformed, and mock-completion
  cases.

## Unknown Fields

Unknown fields are rejected at the top-level payload, `request`, and
`instruction` objects. This is intentionally strict for public-beta proxy
examples. Metadata is the only extension object and is bounded by serialized
JSON byte size.

## Safe Errors

Browser-facing errors use fixed messages from the safe error table. Provider
errors, thrown exceptions, validation details, raw context, and API keys are
never echoed into the response body by default.

## Using The Harness Later

Future proxy example packages should expose a test wrapper like:

```ts
runProviderProxyContractSuite({
  name: "example proxy",
  async makeRequest(input) {
    return sendToExampleProxy(input);
  },
});
```

`makeRequest()` owns transport details. For in-memory handlers it can call the
handler directly. For real local servers it can issue HTTP requests. The
contract harness sends no provider API key and expects the example to default
to deterministic mock/no-key mode.

## Non-Goals

- No Express, Next, or Cloudflare Worker implementation.
- No OpenAI SDK.
- No real provider calls.
- No browser provider-key path.
