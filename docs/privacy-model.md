# Privacy Model

Status date: 2026-05-19.

Typai's privacy model separates local deterministic correction from optional
remote completion.

## Local Correction

Deterministic correction is local. `@typai/core` runs correction and suggestion
logic without network calls, server calls, provider calls, local-service calls,
or model calls. The correction adapters do not require a server, daemon,
browser extension, localhost API, or remote model.

Correction data stays in the browser unless the embedder explicitly moves it:

- completed-token checks use the current token, not the full document.
- protected-token guards are local.
- correction transactions are local adapter state.
- personal dictionary storage is local by default.
- memory import/export/reset is user-controlled.

## Optional Remote Completion

Completion is optional through `@typai/completion-remote`. It sends bounded
context only when an embedder installs and configures the opt-in completion
package.

When completion is configured:

- context extraction is bounded by character limits.
- the browser calls an embedder-controlled endpoint.
- provider credentials stay server-side.
- returned text is rendered as ghost text first.
- editor text mutates only after explicit user acceptance.
- accepted completions are transactions and remain revertible.

## Logging And Metrics

Raw context is not logged by default. Metrics are redacted and length-based by
default.

Default-safe metrics may include:

- request ID.
- mode.
- context length.
- completion length.
- latency.
- provider/model label.
- status or safe error code.
- accept, dismiss, abort, stale, and revert counts.

Default metrics must not include:

- full `contextBefore`.
- full `contextAfter`.
- full generated completion.
- provider API key.
- stable document ID.
- full document text.

## Embedder Responsibility

Provider proxy security is the embedder's responsibility. Typai documents the
required proxy controls and supplies optional packages, but deployed systems must
own:

- authentication.
- origin policy.
- strict CORS.
- rate limits.
- request size limits.
- provider credentials.
- log redaction.
- safe error mapping.
- data retention policy.

## Public Beta Privacy Boundary

For V4.2 public beta readiness:

- deterministic correction remains local.
- completion remains optional.
- no real provider calls run in tests, demos, E2E, browser benchmarks, smoke,
  or CI.
- no browser examples include provider API keys.
- no direct browser OpenAI/provider calls are allowed.
- no next-edit logging or local model inference is introduced.
