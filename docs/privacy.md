# Privacy

Typai separates local correction from optional completion. In the current beta,
deterministic correction does not send text to a Typai service.

## Local Correction

`@typai/core` and the editor adapters:

- run in the host app/browser process
- inspect completed tokens
- skip protected-looking URLs, emails, paths, identifiers, and code-like spans
- support personal dictionary and correction-rule memory
- can use in-memory or IndexedDB-backed storage
- do not require a server

The current beta does not include Typai-hosted telemetry, next-edit logging, or
local model inference.

## Optional Completion

Completion is opt-in and separate:

- apps install `@typai/completion-remote`
- browser code sends bounded context to an app-owned endpoint
- the endpoint owns real provider credentials and calls
- ghost text is visual until the user accepts it
- typing, blur, selection changes, paste, composition, and Escape dismiss stale
  or unwanted ghost text

If an app enables completion, that app must define its own privacy policy for
the endpoint and provider.

## Provider Proxy Responsibility

The embedder-owned server should decide and document:

- what context is sent
- how requests are authenticated
- whether logs are retained
- how secrets are stored
- which provider/model is used
- how users are informed about remote completion

Typai examples keep this path mock-first and manual for real-provider testing.

## Language Assets

Production dictionary/frequency assets are blocked and not bundled. Host apps
may provide Typai Dictionary Blob v1 bytes during initialization, but the app is
responsible for the provenance and distribution policy of those bytes.

## Related Docs

- [Privacy model](./privacy-model.md)
- [Provider proxy concept](./concepts/provider-proxy.md)
- [Security](./security.md)
