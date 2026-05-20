# Troubleshooting

## Nothing Corrects

Check that the core has loaded and the adapter is attached. For textarea,
verify the textarea is not disabled or read-only.

## Textarea Marks Look Offset

The textarea overlay is visual. Keep textarea font, padding, line-height, and
box sizing stable. Call the adapter's resync method after layout changes.

## Completion Does Not Appear

Completion is optional. Confirm that:

- a completion controller is configured
- the prefix is long enough
- the endpoint is reachable
- the proxy is running in mock mode for local examples
- the request was not dismissed by typing, blur, selection change, or Escape

## Provider Proxy Returns Errors

Proxy errors are intentionally safe and terse. Inspect server-side redacted logs
for request ID, status, provider mode, context length, completion length, and
latency. Do not log full context by default.

## Package Imports Fail

For repo examples, run `pnpm install` and `pnpm build` from the repository root
before running a consumer example.

For external npm consumers, install from the beta dist-tag:

```sh
npm install @typai/core@beta @typai/textarea@beta
```

If install unexpectedly resolves `latest`, pin the exact beta version:

```sh
npm install @typai/core@0.0.0-beta.0 @typai/textarea@0.0.0-beta.0
```

## Production Dictionary Coverage Is Missing

The production dictionary and frequency table are not bundled. The current local
correction baseline includes deterministic rules, a common-typo autocorrect
gate, and mock or host-provided dictionary paths. Full production spell coverage
requires a later approved production asset.

## Provider Proxy Credentials

Completion providers should run through an embedder-owned server endpoint. The
browser side should receive only an endpoint URL and completion responses, never
provider credentials.
