# Security Threat Model

Status date: 2026-05-19.

This is the V4.2 baseline security threat model for Typai public beta
readiness. It covers current packages and the planned provider-proxy boundary.

## Assets

- User text in the active editor.
- Correction history and correction transactions.
- Personal dictionary entries.
- Correction rules and dictionary assets.
- Completion context sent through `@typai/completion-remote`.
- Provider API keys held by an embedder backend.
- Provider responses.
- Local metrics and debug data.
- Package artifacts and tarballs.
- CI secrets, if any are added later.

## Trust Boundaries

- Browser app.
- `@typai/core`.
- Editor adapters: `@typai/contenteditable`, `@typai/textarea`,
  `@typai/react`, and `@typai/codemirror`.
- `@typai/completion-remote`.
- Embedder backend proxy.
- Provider API.
- IndexedDB.
- Package tarballs.
- CI.

## Current Security Properties

- Deterministic correction runs locally through `@typai/core`.
- `@typai/core` does not import `@typai/completion-remote`.
- Existing correction adapters work without completion installed or configured.
- Completion is optional and routed through `@typai/completion-remote`.
- Tests, demos, E2E, browser benchmarks, and package smoke use mock providers.
- Browser package code calls embedder endpoints, not provider APIs directly.
- Reference proxy examples default to mock mode and include an env-gated
  server-side OpenAI Responses path only.
- The manual real-provider smoke requires explicit opt-in flags and is not a CI
  gate.
- No real Codex adapter, local model inference, next-edit logging, browser
  extension, npm publish, or production dictionary asset exists in this phase.

## Threats And Controls

| Threat | Control |
| --- | --- |
| Provider key exposure | Provider keys are server-side only; browser examples must not contain keys. |
| Core remote-call regression | API boundary docs and package smoke verify `@typai/core` remains no-remote. |
| Accidental public API expansion | API export snapshot tests fail on unexpected exports. |
| Raw context logging | Provider proxy contract forbids raw context logging by default. |
| Excessive completion context | Provider proxy contract requires request body and context size limits. |
| Cross-origin proxy abuse | Future proxies require origin allowlists and strict CORS. |
| Open proxy abuse | Future proxies require auth or same-origin session plus rate limits. |
| Provider error leakage | Future proxies must map errors to safe codes/messages. |
| Prompt injection into provider instructions | Proxies must keep server-owned instructions separate from user context. |
| Test fixture using real provider | CI and tests use mocks; the manual real-provider smoke exits unless explicit env gates are set. |
| Package artifact leakage | Package dry-run and smoke install remain release-readiness gates. |
| IndexedDB data exposure | Memory import/export/reset stays user-controlled and local. |

## Security Requirements For Later V4.2 Work

- Do not add browser provider-key options.
- Do not log full document text or stable document IDs by default.
- Do not add npm publish or production deployment claims in this contract
  prompt.
- Document every new public export with a stability label.
- Preserve correction behavior and completion behavior while adding security
  docs, tests, and later examples.

## Residual Risk

Typai can enforce package boundaries and provide secure proxy examples, but the
embedder owns deployed backend security: authentication, session handling,
origin policy, provider credentials, rate limits, logging sinks, and production
monitoring.
