# Security

Typai's current security posture is built around a narrow boundary:
deterministic correction is local, and optional completion goes through an
embedder-owned server endpoint.

## Current Beta State

- Published beta: `0.0.0-beta.0`.
- Registry smoke passed from public npm packages.
- `@typai/core` has no dependency on `@typai/completion-remote`.
- Production language assets are blocked / host-provided only.
- Provider proxy examples default to mock mode.
- Real provider calls are manual and env-gated.
- Package secret scanning passed for the seven release packages.

## Package Boundaries

| Boundary | Current Rule |
| --- | --- |
| Core | local deterministic correction only |
| Completion | separate optional `@typai/completion-remote` package |
| Provider credentials | server-owned only |
| Browser packages | endpoint URL only, no provider credential field |
| Examples | mock mode by default |
| Tests/CI/smoke | no real provider calls |
| Production assets | blocked from package output |

`@typai/core` must stay independent from React, CodeMirror, UI, provider proxy
examples, and remote completion.

## External-Action Gates

The repo uses explicit gates for external or costly actions:

- npm publishing requires release approval and publish-specific gates.
- Trusted publishing workflow uses OIDC permissions and no npm auth token.
- Real provider smoke requires `TYPAI_ALLOW_REAL_PROVIDER_TEST=1`.
- Production dictionary generation refuses to run while manifest review is
  blocked.
- Git tag creation/push is separate from package publish.

## Package And Secret Checks

Release checks cover:

- package file lists
- package size report
- package secret scan
- package install smoke
- public beta smoke
- registry smoke after publish
- production dictionary manifest gate

Release tarballs must not contain `.env` files, provider credentials, raw
language source files, production dictionary binaries, production frequency
tables, local smoke secrets, test reports, examples, or server proxy code inside
browser/library packages.

## Provider Proxy Risk

Completion requests may include bounded editor context. The server endpoint
owner is responsible for:

- authentication and abuse control
- provider key storage
- retention policy
- redacted logs
- model choice
- cost controls
- response filtering appropriate to the app

Typai's browser packages do not provide a direct provider-key path.

## Related Docs

- [Provider proxy security contract](./provider-proxy-security-contract.md)
- [Security threat model](./security-threat-model.md)
- [Privacy](./privacy.md)
- [Real-provider demo](./real-provider-demo.md)
