# Real-Provider Demo

Typai completion demos are mock-only by default. The real-provider path is a
manual local demo for proving the server-owned provider boundary. It is not used
by package tests, E2E, registry smoke, or CI.

Use this doc only when you intentionally want a local proxy server to call a
real provider from the server side.

## Safety Model

- Mock mode is the default.
- Browser code calls only a configured Typai proxy endpoint.
- Browser UI accepts an endpoint URL, not provider credentials.
- Automated tests and smoke checks use mocked provider behavior.
- OpenAI mode is manual, local, env-gated, and may incur provider cost.
- Provider secrets must stay in the server process environment.

## Mock Mode

Start the local proxy:

```sh
pnpm dev:completion-proxy
```

Default endpoint:

```text
http://127.0.0.1:8787/api/typai/completion
```

Mock mode does not need provider credentials and does not call an external
provider.

Start the full demo app in another terminal:

```sh
pnpm --filter simple-demo-editor dev
```

Open the V4 Remote Completion tab, choose proxy mode, and point the endpoint at
the local proxy URL. Type a prompt prefix, pause, then accept ghost text with
Tab.

## OpenAI Mode

OpenAI mode must be enabled only in the server terminal:

```sh
$env:TYPAI_ALLOW_REAL_PROVIDER_TEST = "1"
$env:PROVIDER_MODE = "openai"
$env:OPENAI_API_KEY = "<server-side key>"
$env:OPENAI_MODEL = "gpt-4.1-mini"
pnpm dev:completion-proxy
```

Optional:

```sh
$env:OPENAI_TIMEOUT_MS = "10000"
$env:ALLOWED_ORIGIN = "http://127.0.0.1:5173"
```

The proxy refuses OpenAI mode unless the allow flag, provider mode, and
server-side key are present.

## Manual Smoke

The real-provider smoke is disabled unless the same explicit gates are set:

```sh
pnpm smoke:real-provider:manual
```

Without the gates, it exits safely without a provider call. With the gates, it
calls the local proxy route and reports latency, model, and completion length.

## Boundary Check

In browser DevTools Network:

- browser requests should go to the configured `/api/typai/completion`
  endpoint
- browser requests should not go directly to a provider domain
- request payloads should not contain provider secrets
- provider credentials should exist only in the proxy server environment

## Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Demo shows `error` | proxy is not running or endpoint URL is wrong | restart proxy and copy the endpoint URL exactly |
| OpenAI mode refuses to start | one of the required env gates is missing | set the allow flag, provider mode, and server-side key |
| Browser request is blocked | CORS origin mismatch | set `ALLOWED_ORIGIN` to the demo origin |
| Completion is empty | prompt prefix/model/provider returned no usable text | try a longer prefix or different model |

Keep this path manual until a later explicit provider-integration phase changes
the release boundary.
