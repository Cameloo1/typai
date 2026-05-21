# typai Agent Brief

This is the canonical current-state instruction file for future coding agents.
Archived planning docs are historical context only.

## Project Summary

typai is an open-source embeddable writing intelligence layer. Codex is a future
flagship integration, not the root architecture.

Current phase checkpoint: Production Asset Unblock final hardening audit,
Prompt 139, complete for the blocked-host-provided branch.
Do not generate or bundle production assets unless
`packages/core/assets/production/MANIFEST.json` has
`review.status: "approved"`. Do not bypass source, license, attribution, hash,
size, quality, package, or review gates. V4.2 Provider + Public Beta Readiness,
Intelligence Quality Foundation, and Production Language Asset + Beta RC are
complete; beta publish workflow state is separate from this production asset
gate.

Package readiness is not the same as product intelligence. The public beta
package rails, provider proxy boundaries, and cross-surface completion
contracts are in place. The local spell engine now has delete-index
suggestions and an explicit common-typo autocorrect gate, but it is still not
production dictionary coverage until an approved dictionary/frequency asset and
source pipeline land. Prompt 106 quality gates now measure the current
non-production spell behavior and fail safety regressions. Prompt 107 records
the completion checkpoint in `docs/intelligence-quality-foundation-complete.md`.

V4.0 Remote Completion Prototype is complete. The V4 package is
`@typai/completion-remote`. It is a separate, opt-in remote
completion package with provider, scheduler, context, metrics, endpoint
provider, contenteditable controller, mocked demo, E2E coverage, package
readiness, and mocked benchmark coverage.

Contenteditable, textarea, React, and CodeMirror completion exist today.
CodeMirror completion supports ghost-text rendering, dismiss behavior, Tab
accept, completion transactions, and exact revert. Package dry-run, smoke
install, V4.1 E2E, browser benchmark gates, and the hardening audit cover these
surfaces.

V4.2 did not add new editor surfaces. It completed API stability labels,
source-level API export snapshot tests, provider endpoint contracts,
security/privacy baselines, server-side-only provider examples, env-gated
OpenAI Responses examples, consumer install docs, release dry-runs, beta API
boundaries, package secret scanning, public-beta smoke gates, and the
public-beta readiness CI workflow. Provider examples must keep private keys
server-side.

Production dictionary assets remain gated by source, license, attribution,
hash, size, quality, package, and review approval. Do not commit, pack, publish,
or claim production dictionary/frequency assets until an approved asset PR
includes source URLs, retrieval dates, notices, attribution, manifest counts,
hashes, deterministic transform commands, package proof, and review signoff.
Do not bundle unclear-license assets. Do not publish. Do not start a real Codex
adapter, grammar/style/tone/clarity work, local model inference, or next-edit
logging in this phase. Preserve correction/completion boundaries: `@typai/core`
stays local deterministic correction only, completion stays optional, valid
words and protected tokens are never autocorrected, delete-index candidates are
suggestions-only unless explicitly approved in the common typo table, accepted
completions are not blue correction marks, and browser package code must not
contain provider credentials.

Prompt 128 keeps the production asset gate blocked: ESDB/SCOWL `en_US` size 60
has a pinned source hash, Google Books Ngram `totalcounts-1` has a pinned hash,
but the 14 Google Ngram partition hashes, generated output metadata, final
notices, quality evidence, package proof, and review signoff are still missing.
Asset ingestion is still blocked until manifest, transform, hash, attribution,
size, quality, package, and review gates pass.

Prompt 131 adds the deterministic production transform pipeline. Fixture mode is
allowed and writes ignored output under `packages/core/assets/generated/`.
Production mode still fails closed while the manifest is blocked and requires
pinned local source paths, matching source hashes, approved redistribution,
license/attribution files, and non-blocked package inclusion before processing.

Prompt 132 executed the blocked-host-provided branch. No production asset was
generated. Host-provided Typai Dictionary Blob v1 bytes remain the mechanical
fallback path, loaded only during `createTypaiCore()` initialization. Scaled
mock output remains mock-only and must not be described as production coverage.

Prompt 133 keeps the branch blocked-host-provided and hardens the runtime load
path through TypeScript -> Rust/Wasm -> C++. Host-provided, fixture, and
scaled-mock Blob v1 bytes load only at initialization. Blocked production mode
and malformed host-provided loads must fail clearly without replacing a
previously loaded valid dictionary/delete-index state. `pnpm ffi:audit` must
continue to pass and must reject `std::string` in the extern C surface, C++
heap ownership transfer across FFI, Embind/Emscripten bindings, exported C++
classes, and full-document text pass-through patterns.

Prompt 134 selects host-provided-only language asset delivery for packages
while the manifest remains blocked. `@typai/core` tarballs must include only
`dist`, generated Wasm `pkg`, package metadata, and `README.md`; they must not
include `assets/`, raw language sources, generated production dictionary
binaries, frequency tables, tests, reports, debug dumps, provider examples,
`.env` files, or secrets. `pnpm pack:dry`, `pnpm package:size-report`,
`pnpm scan:package-secrets`, `pnpm smoke:install`, and
`pnpm smoke:public-beta` enforce the package decision.

Prompt 135 adds a structured production spell-quality corpus under
`tests/spell-quality/corpus`, a scalable direct-core evaluator, quality gates,
and generated review reports under `reports/spell-quality/`. The harness uses
an in-memory host-provided quality fixture to measure valid words, protected
tokens, domain terms, and suggestion recall without generating or packing a
production asset. `reports/spell-quality/latest.json` is generated/ignored;
`reports/spell-quality/latest.md` is the concise committed report.

Prompt 136 adds corpus-backed Playwright parity coverage for contenteditable,
textarea, React textarea, React contenteditable, and CodeMirror. The stable
matrix lives in `reports/spell-quality/surface-parity.md`. Contenteditable
marks now survive punctuation-triggered corrections followed by a space, and
`https:` is treated as an in-progress protected URL prefix to prevent stale red
marks while a URL is being typed.

Prompt 137 hardens release gates. `pnpm bench:language-asset` reads the
authoritative production `MANIFEST.json`, measures built-in, host-provided,
scaled mock, and approved production asset mode when available, and emits
`language-asset-benchmark-json`. `pnpm --filter @typai/core bench` emits
`core-benchmark-json`. `pnpm bench:browser` covers deterministic correction for
contenteditable, textarea, React textarea, and CodeMirror, separates mocked
completion thresholds, and emits `browser-benchmark-json`. `pnpm release:pack`
runs release check, language asset benchmark, package size report, spell-quality
benchmark, package secret scan, install smoke, public beta smoke, and local
tarball packing before reporting success.

Prompt 138 closed the remediation loop for the blocked-host-provided branch. It
fixed a Firefox contenteditable completion E2E harness race by waiting for the
remote completion state to return to `idle`, then reran the full gate stack.

Prompt 139 records the final Production Asset Unblock hardening audit in
`docs/production-asset-unblock-complete.md`. The final asset state remains
blocked / host-provided only. All hard validation gates passed for that state;
warning-level mocked completion p95 rows and demo/consumer Vite chunk-size
warnings remain documented.

Preserve no valid-word autocorrect, no protected-token writes, no local
inference, no next-edit logging, and no browser key path. No local model
inference or next-edit logging is active in this phase.

Use `docs/beta-release-candidate-plan.md`, `docs/beta-publish-complete.md`,
and `docs/beta-registry-smoke.md` only when explicitly working release
workflow history or remediation. Use `docs/production-asset-unblock.md`,
`docs/production-asset-gate-recap.md`,
`docs/dictionary-production-approval.md`, and
`packages/core/assets/production/MANIFEST.json` for the current production
asset status.

Next asset step: capture the missing Google Ngram partition SHA-256 values in
an external disposable workspace, then re-review the manifest. If the goal is
dogfooding or flagship integration instead, choose Real Codex Adapter as a
separate phase. Do not begin another feature phase without an explicit
selection.

Rich Editor Adapter Foundation is complete. Rich adapters remain local
deterministic correction adapters in this phase.

## Current Packages

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- Internal private `@typai/adapter-testkit`
- Required support package `@typai/ui`, unstable as an independent
  design-system API
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`
- Internal private `@typai/provider-proxy-testkit`
- Internal private `@typai/provider-proxy-example-utils`
- `examples/simple-demo-editor`
- `examples/provider-proxy-express`
- `examples/provider-proxy-next`
- `examples/provider-proxy-cloudflare-worker`
- consumer examples for contenteditable, textarea, React, CodeMirror, and
  completion with a proxy
- `tests/golden-corpus`

## V4 / V4.1 / V4.2 Remote Completion Boundary

- `@typai/core` must not import `@typai/completion-remote`.
- Existing adapters must still work without completion installed or configured.
- Existing correction adapters remain local correction adapters.
- `@typai/contenteditable` accepts a structural optional completion
  controller/interface without importing `@typai/completion-remote`.
- `@typai/completion-remote` owns provider, scheduler, context, metrics, and
  completion state.
- `@typai/completion-remote` is optional and package-ready, but not imported by
  `@typai/core`.
- Contenteditable completion exists and must be preserved.
- Textarea completion exists and must be preserved.
- React completion wrappers/components exist and must remain optional.
- CodeMirror completion exists and must keep accepted completions separate from
  blue correction marks.
- Mock providers are used in tests, demos, E2E, and browser benchmark smoke.
- API export snapshot tests must stay explicit when public exports change.
- Provider proxy examples must satisfy `@typai/provider-proxy-testkit`
  validation, safe-error, fixture, and contract-suite coverage before they are
  trusted.
- Endpoint providers require an embedder backend; browser code must not call
  model providers directly.
- Browser examples must not contain private provider API keys.
- Browser package code calls an embedder endpoint; the embedder endpoint calls
  the provider.
- V4.2 provider examples must be server-side only.
- V4.2 real-provider examples or scripts must be env-gated, manually invoked,
  and disabled in CI by default.
- Accepted completions are completion transactions, not blue correction marks.
- Ghost text is visual only until explicit Tab acceptance.
- Optional streaming is allowed only after non-streaming V4.1 surfaces are
  stable, behind a feature flag, and with mocked tests only.
- Browser benchmarks cover deterministic correction plus mocked completion for
  contenteditable, textarea, React textarea, and CodeMirror.
- `pnpm bench:spell-quality` covers the committed spell-quality corpus,
  autocorrect precision, suggestion recall, valid-word safety, protected-token
  safety, arbitrary delete-index autocorrect safety, direct core p95,
  suggestion p95, asset mode, and dictionary/delete-index stats.
- Package smoke verifies `@typai/completion-remote` imports, structural
  completion options, and `@typai/core` no-remote behavior.
- Public beta smoke verifies packed tarball imports, minimal correction, mock
  completion, endpoint mock proxy behavior, package artifact boundaries,
  browser-key-path absence, and consumer app builds.
- Public beta readiness CI covers build, test, lint, Chromium/Firefox E2E,
  accessibility checks, core and browser benchmarks, package dry-run,
  smoke install, public beta smoke, release dry-runs, package secret scan,
  provider proxy contract tests, and docs safety checks.
- Codex adapter integration remains out of scope.
- No browser extension.
- No local model inference.
- No next-edit logging.
- No grammar, style, tone, or clarity expansion in V4.2.
- No delete-index-only autocorrect or production dictionary asset in V4.2.
- No direct browser OpenAI/provider calls.
- No npm publish in V4.2 unless a later prompt explicitly opens publishing.

Deterministic correction runs first. Remote completion waits for debounce after
correction settles.

## Deterministic Correction Constraints

- C++ remains the deterministic correction engine.
- Rust owns the Wasm bridge.
- TypeScript owns package wrappers, storage state, protected-span helpers,
  editor adapters, marks, transactions, demos, and tests.
- No Emscripten.
- No Embind.
- No C++ classes crossing into JavaScript.
- No `std::string` across FFI.
- No C++-allocated memory that JS/Rust must free.
- No full document text passed into C++ token APIs.
- `createTypaiCore()` remains the async startup boundary.
- `checkCompletedToken()` and `suggestToken()` remain synchronous after
  initialization.
- No storage reads, network calls, server calls, local-service calls, or model
  calls inside the deterministic correction hot path.
- Valid words are never autocorrected.
- Edit-distance/delete-index candidates are suggestions only unless the token
  is explicitly listed in the audited common-typo table.
- Protected spans are hard write barriers.
- Stale writes are blocked with current token/range text and editor-version
  checks.
- IME composition and non-collapsed selections block autocorrection.
- Blue marks mean typai changed the word.
- Red marks mean unresolved spelling issue.
- Memory export/import must not become full-document telemetry.
- Do not log full prompt context by default.
- Do not add grammar/style/tone/clarity behavior without a new explicit phase.
- Do not add a server, daemon, localhost API, browser extension, or local
  service requirement to correction packages.
- Do not add remote completion to `@typai/core`.
- Do not make `@typai/completion-remote` a dependency of `@typai/core`.

## Current Non-Goals

- No delete-index-only autocorrect.
- No keyboard adjacency.
- No edit-distance autocorrect.
- No valid-word autocorrect.
- No production dictionary/frequency asset without all approval gates passing.
- No ProseMirror implementation.
- No Monaco implementation.
- Codex adapter integration remains out of scope.
- No real OpenAI/provider calls in browser examples, tests, E2E, or benchmarks.
- No next-edit logging.
- No private provider key in browser code.
- No local model inference.

## Intelligence Quality Foundation Reference

Use `docs/intelligence-quality-foundation.md` as the Prompt 99 scope lock.

Use `docs/intelligence-quality-foundation-complete.md` as the Prompt 107
hardening audit and phase checkpoint. It is the current proof document for the
source/license, engine/FFI, correction safety, surface parity, completion
boundary, metrics/privacy, and preserved non-goal audits.

Use `docs/spell-quality-baseline.md` as the current spell quality diagnosis.
It is a baseline report, not evidence that Typai has product-grade spell
coverage.

Use `docs/spell-quality-report.md` as the Prompt 106 stable quality report.
It now documents the Prompt 135 structured corpus harness, live safety gates,
false-positive review summary, and report outputs. It is not telemetry and
does not imply production dictionary coverage.

Use `docs/dictionary-source-selection.md`,
`docs/dictionary-asset-policy.md`, `docs/dictionary-production-approval.md`,
and `docs/dictionary-asset-blockers.md` for Prompt 100 source approval and
asset-ingestion gates.

Use `docs/production-language-asset-rc.md` as the current phase scope lock and
`docs/production-asset-gate-recap.md` as the current asset gate summary.
Use `docs/production-language-asset-rc-complete.md` as the final Production
Language Asset + Public Beta RC hardening checkpoint. Use
`docs/production-asset-unblock-complete.md` as the final Production Asset
Unblock hardening audit for the blocked-host-provided branch.

## V4 Scope Reference

Use `docs/v4-remote-completion.md` as the V4 Remote Completion Prototype scope
lock. It is the current boundary for completion planning.

Use `docs/v4-remote-completion-complete.md` as the V4.0 hardening audit and
completion checkpoint.

Use `docs/v4-1-completion-surface-expansion.md` as the V4.1 Completion Surface
Expansion scope lock. Do not add a real Codex adapter, ProseMirror/Monaco
completion, browser extension behavior, local model inference, next-edit
logging, private browser provider-key paths, real provider calls in tests or
demos, completion auto-accept, silent rewrite, or streaming outside the V4.1
feature-flag/mock-test gate.

Use `docs/v4-1-completion-surface-expansion-complete.md` as the V4.1 hardening
audit and completion checkpoint.

Use `docs/v4-2-provider-public-beta-readiness.md` as the V4.2 Provider + Public
Beta Readiness scope lock.

Use `docs/v4-2-provider-public-beta-readiness-complete.md` as the V4.2
hardening audit and completion checkpoint. Keep real provider calls out of
tests, demos, E2E, benchmarks, and CI unless explicitly env-gated for a manual
script.

Use `docs/api-stability.md` for public API labels. Use
`docs/provider-proxy-security-contract.md`, `docs/security-threat-model.md`, and
`docs/privacy-model.md` for V4.2 provider, security, and privacy boundaries.
