# V4.2 Provider + Public Beta Readiness

Status date: 2026-05-19.

V4.2 prepares Typai for public beta adoption without expanding product scope
into new intelligence features. V4.1 proved mocked completion across existing
editor surfaces; V4.2 focuses on provider security, package clarity, install
examples, release dry-runs, beta API boundaries, API stability labels, privacy
threat modeling, and public-beta smoke gates.

This scope lock is docs, contracts, and tests only. Provider examples,
OpenAI-specific server adapters, release tooling, and real provider calls start
only in later V4.2 prompts.

## Current V4.1 Completed State

V4.1 Completion Surface Expansion is complete for the current checkpoint.

The current implementation includes:

- Local deterministic correction through `@typai/core`.
- Optional remote completion through `@typai/completion-remote`.
- Completion support for contenteditable, textarea, React wrappers/components,
  and CodeMirror.
- Ghost rendering, dismiss behavior, Tab accept, completion transactions, and
  exact revert across the completed V4.1 surfaces.
- Provider resilience in `@typai/completion-remote`: timeout handling, typed
  provider errors, endpoint response validation, request budgets, rate-limit
  cooldown, stale response discard, and abort/cancel paths.
- Mock providers for demos, tests, E2E, package smoke, and browser benchmarks.
- Local package dry-run, smoke install, browser benchmark, E2E, build, lint,
  and CI gates.

Existing deterministic correction adapters still work without completion
installed or configured.

## V4.2 Scope

V4.2 is a provider and public-beta readiness phase. In scope:

- Public API compatibility audit.
- Beta API stability labels.
- Provider proxy security contract.
- Security and privacy threat model baseline.
- Public beta readiness checklist.
- Release-readiness boundaries.
- API export snapshot tests.
- No browser provider key path.
- No implementation yet.

This phase should make the existing package set easier to install, evaluate,
and verify. It should not introduce new editor surfaces or new model
capabilities.

## Non-Goals

The following are out of scope for V4.2 unless a later prompt explicitly opens
them:

- Real Codex adapter.
- Path B local completion engine.
- Local model inference.
- Next-edit logging.
- Grammar, style, tone, or clarity features.
- SymSpell or delete index.
- Production dictionary asset.
- Browser extension.
- ProseMirror implementation.
- Monaco implementation.
- WebKit expansion unless already stable and explicitly approved.
- npm publish.
- Real provider calls in CI.
- API keys in browser examples.
- Direct browser OpenAI calls.
- Completion auto-accept.
- Silent rewrite.

## Safety Boundaries

Required V4.2 boundaries:

- `@typai/core` must not import `@typai/completion-remote`.
- `@typai/core` remains local deterministic correction only.
- Existing correction behavior must not change.
- Existing completion behavior must not regress.
- Existing adapters must still work without completion installed or configured.
- Tests, demos, E2E, smoke, and CI must use mock providers by default.
- Real provider paths must be env-gated and manually invoked.
- Real provider examples must be server-side only.
- Browser examples must not contain private provider API keys.
- Browser code must call an embedder-controlled endpoint, not OpenAI or another
  model provider directly.
- `@typai/completion-remote` must not expose private provider-key paths for
  browser use.
- Provider examples must avoid logging raw full-document text or secrets.
- Accepted completions remain explicit transactions with exact revert.
- Ghost text remains visual only until explicit user acceptance.

## Package Boundary

`@typai/core` owns deterministic correction only:

- No remote completion dependency.
- No provider calls.
- No network calls.
- No scheduler.
- No local model inference.

`@typai/completion-remote` owns optional completion infrastructure:

- Provider interfaces.
- Endpoint provider behavior.
- Mock provider behavior.
- Scheduling, debounce, abort, stale response handling, and metrics.
- Typed provider error classification.
- Request budgets and rate-limit cooldown.
- Mocked streaming behind the existing feature flag.

Editor adapters own surface behavior:

- Ghost rendering.
- Dismiss handling.
- Explicit accept.
- Transaction-safe insertion.
- Exact revert.
- Surface-specific state mapping.

V4.2 may add examples, docs, tests, release tooling, and security gates around
these packages. It must not merge the deterministic correction and completion
boundaries.

## Provider Security Model

Typai browser packages do not hold private provider credentials.

The supported provider model is:

1. Browser package collects bounded completion context.
2. Browser package sends the request to an embedder-owned backend endpoint.
3. Embedder backend authenticates and rate-limits the request.
4. Embedder backend calls OpenAI Responses API or another provider with
   server-side credentials.
5. Embedder backend returns insertion-only completion text to the browser.
6. Typai renders ghost text and mutates editor content only after explicit
   user acceptance.

Reference examples must make this boundary obvious. Any OpenAI Responses
adapter example must live on the server side, require explicit environment
configuration, and stay disabled in automated tests and CI.

## Release-Readiness Goals

V4.2 should make public beta readiness inspectable:

- API surface is documented and compatibility-checked.
- API stability labels are assigned in `docs/api-stability.md`.
- Provider proxy rules are documented in
  `docs/provider-proxy-security-contract.md`.
- Security threats are documented in `docs/security-threat-model.md`.
- Privacy defaults are documented in `docs/privacy-model.md`.
- Future provider proxy examples are secure by construction.
- Future install examples work from local packages and future published
  packages.
- Future release dry-runs prove tarball contents, metadata, and import
  surfaces.
- Future changelog and versioning flow are documented before npm publish.
- Future CI release-readiness workflow uses no real provider calls.
- Future public beta smoke matrix covers supported packages and surfaces.
- Future manual real-provider checks are opt-in, env-gated, and excluded from
  CI.

## Compressed Prompt Sequence

Recommended V4.2 sequence:

1. V4.2-0/1: scope, beta API labels, security/privacy contracts, and export
   snapshot tests.
2. V4.2-2: provider proxy rules and example implementation plan.
3. V4.2-3: reference provider proxy examples with mocked tests.
4. V4.2-4: OpenAI Responses server-side adapter example, env-gated only.
5. V4.2-5: provider contract tests and mock-provider conformance coverage.
6. V4.2-6: consumer install examples and package import docs.
7. V4.2-7: docs site or docs restructure for beta users.
8. V4.2-8: versioning, changelog, release dry-run, and package metadata gates.
9. V4.2-9: public beta smoke matrix and CI release-readiness workflow.
10. V4.2-10: optional manual real-provider script, disabled by default.
11. V4.2-11: V4.2 hardening audit and readiness checkpoint.

Each implementation prompt should preserve existing correction and completion
behavior, keep automated provider paths mocked, and keep private keys out of
browser code.

## Acceptance Gates

V4.2 is ready only when these gates are true:

- Public API compatibility audit is complete.
- API export snapshot tests are present and passing.
- API stability labels are documented.
- Provider proxy contract is documented and tested.
- Security and privacy baseline docs exist.
- Reference provider examples exist for Express-shaped, Next route-handler, and
  Cloudflare Worker-shaped server proxies; they are mock-only by default,
  require no provider keys, and pass the shared proxy contract harness.
- Future real-provider examples keep private keys server-side.
- OpenAI Responses example is server-side, env-gated, and disabled by default.
- Browser examples contain no API keys or direct model-provider calls.
- Consumer install examples are verified.
- Package dry-run and smoke install pass.
- Tests, build, lint, E2E, and browser benchmarks pass with mock providers.
- Release-readiness CI runs without real provider credentials.
- Security and privacy threat model is complete.
- Public beta smoke matrix is documented and executed.
- V4.2 hardening audit records current verified behavior and remaining
  non-goals.
