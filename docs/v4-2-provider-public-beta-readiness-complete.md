# V4.2 Provider + Public Beta Readiness Complete

Status date: 2026-05-19.

V4.2 is complete. This phase made Typai shippable for public-beta evaluation
without adding new editor surfaces or new intelligence features.

## What V4.2 Added

- Public API stability labels and API export snapshot tests.
- Provider proxy security contract.
- Security threat model and privacy model.
- Provider proxy schema validation, safe error mapping, fixtures, and contract
  harness.
- Mock-first provider proxy examples for Express-shaped, Next route-handler,
  and Cloudflare Worker-shaped server boundaries.
- Server-side OpenAI Responses example path, disabled by default and env-gated.
- Manual real-provider smoke script, disabled by default and excluded from CI.
- Prompt 105 local demo proxy mode, disabled by default and routed through the
  secure provider proxy boundary.
- Focused consumer install examples.
- Public-beta documentation structure.
- Release dry-run tooling, package metadata audit, and package secret scan.
- Public beta smoke matrix from packed local tarballs.
- Public beta readiness CI workflow.

## Package List

Public beta package candidates:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`

Internal packages:

- `@typai/adapter-testkit`
- `@typai/provider-proxy-testkit`
- `@typai/provider-proxy-example-utils`

## Provider Proxy Examples

Reference server proxy examples now exist:

- `examples/provider-proxy-express`
- `examples/provider-proxy-next`
- `examples/provider-proxy-cloudflare-worker`

They default to `PROVIDER_MODE=mock`, require no provider key in mock mode,
validate Typai completion requests through the shared contract utilities, map
errors to safe response schemas, enforce origin policy and request limits, and
avoid raw context logging by default.

These examples are reference shapes, not production deployment claims. The
provider proxy security contract requires authentication and rate limiting for
real deployments; the examples document that embedders must add their own
session/auth and rate-limit control before exposing a live provider endpoint.

## Server-Side OpenAI Responses Example Status

The OpenAI Responses path is server-side only. It lives in example-only proxy
utilities and is enabled only when `PROVIDER_MODE=openai` and `OPENAI_API_KEY`
are present in the server environment.

Automated tests mock the Responses fetch path. CI, E2E, browser benchmarks,
package smoke, and public beta smoke use mock providers only. Demos default to
mock mode.

After Prompt 105, the full demo's V4 Remote Completion tab can be switched from
mock mode to proxy mode for a local manual run. The browser still calls only the
configured proxy endpoint; OpenAI mode remains server-side and env-gated.

## Security Model

- `@typai/core` remains local deterministic correction only.
- `@typai/core` does not import `@typai/completion-remote`.
- Browser packages do not contain private provider-key paths.
- Browser completion calls embedder endpoints, not provider APIs directly.
- Provider proxy examples keep provider credentials server-side.
- Provider errors are mapped to safe error codes and messages.
- Raw context is not logged by default.
- Real-provider checks are manual and env-gated.
- No npm publish command has been run.

## Privacy Model

Deterministic correction is local. Completion is optional and sends bounded
context only when an embedder configures `@typai/completion-remote` and an
endpoint provider.

Metrics are length-based/redacted by default. Memory import/export/reset stays
user-controlled. Provider proxy authentication, retention, rate limits, origin
policy, and log handling are embedder responsibilities.

## Public Beta Docs And Examples

Docs now cover:

- getting started and installation from this checkout.
- local deterministic correction concepts.
- protected spans, red/blue marks, storage, and completion.
- package-specific guides.
- provider proxy pattern and security contract.
- troubleshooting, roadmap, API stability, security, and privacy.

Consumer examples cover contenteditable, textarea, React, CodeMirror, and
completion through a local mock proxy endpoint.

## Package Readiness

Release tooling now checks package metadata, tarball contents, package secrets,
local install smoke, public beta smoke, and dry-run publish flow. Package
tarballs exclude tests, reports, raw source directories, server routes,
example code, `.env` files, and provider secrets. `@typai/core` includes its
generated Wasm package output.

No npm publish has occurred.

## Public Beta Smoke Matrix

`pnpm smoke:public-beta` creates temporary consumer apps, installs packed local
tarballs, and verifies:

- package imports.
- minimal deterministic correction.
- minimal mock completion.
- endpoint provider against a mock proxy.
- no `@typai/core` dependency on `@typai/completion-remote`.
- no browser provider-key path in packed package artifacts.
- expected package artifact boundaries.
- vanilla Vite, React Vite, CodeMirror, and provider proxy mock app builds.

Temporary directories are cleaned unless the debug keep flag is set.

## Benchmark Status

Deterministic correction keeps the existing p95 warning target of 20 ms and
hard failure threshold of 100 ms. Mocked completion benchmarks target p95 below
800 ms and fail above 2000 ms.

The final V4.2 validation passed the benchmark gates. Some mocked completion
browser surfaces can warn above the 800 ms target on this Windows run, but they
remained below the 2000 ms failure threshold.

## CI Status

`.github/workflows/public-beta-readiness.yml` is the public beta readiness CI
workflow. It covers frozen install, build, lint, unit tests, Chromium and
Firefox E2E, axe/accessibility specs, core benchmark, browser benchmark,
package dry-run, smoke install, public beta smoke matrix, release dry-runs,
package secret scan, provider proxy contract tests, and docs safety checks.

The workflow does not run WebKit, does not require real provider secrets, does
not run the manual real-provider smoke, and does not publish.

## Known Limitations

- Packages are not published to npm yet.
- `@typai/ui` is still an internal support package even though it is packed
  because public packages depend on it.
- Provider proxy examples are reference shapes and need production auth,
  rate-limiting, deployment configuration, and observability added by the
  embedder.
- The OpenAI Responses path is an example-only server path, not a browser or
  package-level provider SDK integration.
- The dictionary remains a mock/built-in public-beta asset, not a production
  dictionary.
- Completion remains opt-in and experimental.

## Preserved Non-Goals

- No real Codex adapter.
- No Path B local completion engine.
- No local model inference.
- No next-edit logging.
- No grammar, style, tone, or clarity engine.
- No SymSpell/delete index.
- No production dictionary asset.
- No browser extension.
- No ProseMirror or Monaco implementation.
- No WebKit expansion.
- No npm publish.
- No real provider calls in CI, tests, demos, E2E, smoke, or benchmarks.
- No browser API keys.
- No direct browser OpenAI/provider calls.
- No auto-accept.
- No silent rewrite.

## Next Recommended Phase Options

- Actual npm publish after explicit manual approval.
- Real Codex adapter.
- Production dictionary/SymSpell.
- Apple-style personalization.
- Grammar/style async editor.
- Path B local completion research.
