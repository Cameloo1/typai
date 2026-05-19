# V4.2 Provider + Public Beta Readiness

Status date: 2026-05-19.

V4.2 prepares Typai for public beta adoption without expanding product scope
into new intelligence features. V4.1 proved mocked completion across existing
editor surfaces; V4.2 focuses on provider security, package clarity, install
examples, release dry-runs, beta API boundaries, and public-beta smoke gates.

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
- Provider proxy security contract.
- Reference provider proxy examples.
- OpenAI Responses server-side adapter example, env-gated only.
- No browser provider key path.
- Provider contract tests.
- Consumer install examples.
- Docs site or docs restructure.
- Versioning, changelog, and release scripts.
- Security and privacy threat model.
- Public beta smoke matrix.
- Optional manual real-provider test script, disabled by default.
- CI release-readiness workflow.
- V4.2 hardening audit.

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
- Provider proxy examples are secure by construction.
- Install examples work from local packages and future published packages.
- Release dry-runs prove tarball contents, metadata, and import surfaces.
- Changelog and versioning flow are documented.
- CI includes a release-readiness workflow with no real provider calls.
- Security and privacy threats are documented with concrete mitigations.
- Public beta smoke matrix covers supported packages and surfaces.
- Manual real-provider checks are opt-in, env-gated, and excluded from CI.

## Prompt Sequence

Recommended V4.2 sequence:

1. V4.2-0: provider and public beta readiness scope lock.
2. V4.2-1: public API compatibility audit and report.
3. V4.2-2: provider proxy security contract and server-side-only examples plan.
4. V4.2-3: reference provider proxy example with mocked tests.
5. V4.2-4: OpenAI Responses server-side adapter example, env-gated only.
6. V4.2-5: provider contract tests and mock-provider conformance coverage.
7. V4.2-6: consumer install examples and package import docs.
8. V4.2-7: docs site or docs restructure for beta users.
9. V4.2-8: versioning, changelog, release dry-run, and package metadata gates.
10. V4.2-9: security and privacy threat model.
11. V4.2-10: public beta smoke matrix.
12. V4.2-11: optional manual real-provider script, disabled by default.
13. V4.2-12: CI release-readiness workflow.
14. V4.2-13: V4.2 hardening audit and readiness checkpoint.

Each implementation prompt should preserve existing correction and completion
behavior, keep automated provider paths mocked, and keep private keys out of
browser code.

## Acceptance Gates

V4.2 is ready only when these gates are true:

- Public API compatibility audit is complete.
- Provider proxy contract is documented and tested.
- Reference provider examples keep private keys server-side.
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
