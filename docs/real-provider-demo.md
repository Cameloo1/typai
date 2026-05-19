# Real-Provider Demo

Typai completion demos stay mock-only by default. This manual path lets a local
browser demo call a local Typai proxy endpoint, and lets that proxy call OpenAI
Responses from the server side when explicit environment gates are present.

## Safety Model

- mock remains the default provider mode
- browser code calls only the configured proxy endpoint
- no browser API key input exists
- no direct browser OpenAI request is supported
- automated tests use mocked proxy responses only
- OpenAI mode is manual, local, env-gated, and may incur provider cost

## Run The Proxy In Mock Mode

Start the local proxy:

```sh
pnpm dev:completion-proxy
```

The proxy listens on:

```text
http://127.0.0.1:8787/api/typai/completion
```

Mock mode is the default. It does not need provider credentials and does not
call an external provider.

Start the full demo app in another terminal:

```sh
pnpm --filter simple-demo-editor dev
```

Open the V4 Remote Completion tab, switch Provider mode from `Mock` to `Proxy`,
and set the endpoint to the local proxy URL. Type at least 12 characters, pause,
then accept the ghost text with Tab.

## Run The Proxy In OpenAI Mode

OpenAI mode must be opted into from the server terminal:

```sh
$env:TYPAI_ALLOW_REAL_PROVIDER_TEST = "1"
$env:PROVIDER_MODE = "openai"
$env:OPENAI_API_KEY = "<your server-side key>"
$env:OPENAI_MODEL = "gpt-4.1-mini"
pnpm dev:completion-proxy
```

Optional:

```sh
$env:OPENAI_TIMEOUT_MS = "10000"
$env:ALLOWED_ORIGIN = "http://127.0.0.1:5173"
```

The proxy refuses to start in OpenAI mode unless
`TYPAI_ALLOW_REAL_PROVIDER_TEST=1`, `PROVIDER_MODE=openai`, and
`OPENAI_API_KEY` are set. Keep the key in the server environment only.

## Manual Smoke

The manual real-provider smoke remains disabled by default:

```sh
pnpm smoke:real-provider:manual
```

Without the required env flags, it exits safely without making a provider call.
With the required env flags, it calls the server-side proxy route directly and
prints latency, model, and completion length.

## Verify The Boundary

In browser DevTools Network:

- browser requests should go to `/api/typai/completion` on the configured local
  proxy host
- browser requests should not go to `api.openai.com`
- request payloads should contain a Typai completion request, not provider
  credentials
- provider credentials should appear only in the proxy server environment

## Troubleshooting

- If the demo shows `error`, confirm the proxy is running and the endpoint URL
  matches the demo setting.
- If OpenAI mode refuses to start, check the three required env gates.
- If the browser request is blocked by CORS, set `ALLOWED_ORIGIN` to the Vite
  demo origin shown in the browser address bar.
- If output is empty, try a longer prompt prefix or a different `OPENAI_MODEL`.
