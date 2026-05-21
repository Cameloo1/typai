# Production Asset Unblock Remediation

Status: clean for final audit of the blocked-host-provided branch.
Reviewed at: 2026-05-21.
Phase: Production Asset Unblock remediation loop.

This remediation pass inspected the production language asset gate stack after
Prompts 128, 131, 132, 133, 134, 135, 136, and 137. The production source path
remains blocked by the authoritative manifest and approval record. That blocked
state is intentional for this branch: no production dictionary or frequency
asset is generated, packed, or bundled, and host-provided Typai Dictionary Blob
v1 bytes remain the available production-scale path.

## Outcome

- Full gate set: passed after one E2E harness fix and normal elevated execution
  for commands that need package-build, Wasm, npm-cache, or Playwright server
  filesystem access.
- Production asset status: blocked-host-provided.
- Package inclusion: blocked for production assets.
- Source/raw files: not packed.
- Production output binary: not present.
- Safety gates: no valid-word autocorrect, no protected-token write, no
  arbitrary delete-index autocorrect.
- Provider behavior: mock-only in automated gates; no real provider calls.

## Issue List

| Issue ID | Command/gate | Severity | Category | Failure text summary | Root cause | Fix attempted | Result | Remaining status | Evidence command |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | `pnpm bench:spell-quality`, `pnpm bench:language-asset`, `pnpm --filter @typai/core bench` | warning | CI | Initial sandbox run could not create/use Wasm toolchain temp/cache paths; `wasm-bindgen` fallback reported access denied. | Local execution sandbox restricted temp/cache access needed by the Wasm build tooling. | Reran the exact commands with approved elevated execution. | All affected benchmarks passed. | fixed for this audit environment | `pnpm bench:spell-quality`; `pnpm bench:language-asset`; `pnpm --filter @typai/core bench` |
| AUD-002 | `pnpm package:size-report`, `pnpm scan:package-secrets`, `pnpm pack:dry`, `pnpm smoke:install`, `pnpm release:check` | warning | package | Initial sandbox run could not resolve package build config or read parent paths during package prepack. | Local sandbox restricted package prepack build filesystem access. | Reran the exact commands with approved elevated execution. | Package gates passed with no package findings. | fixed for this audit environment | `pnpm package:size-report`; `pnpm scan:package-secrets`; `pnpm pack:dry`; `pnpm smoke:install`; `pnpm release:check` |
| AUD-003 | `pnpm bench:browser`, `pnpm test:e2e` | warning | E2E | Initial sandbox run could not start the Playwright web server because Vite config resolution was blocked. | Local sandbox restricted Vite/Playwright server filesystem access. | Reran browser gates with approved elevated execution. | Browser benchmark passed; full E2E exposed AUD-004 and passed after the focused fix. | fixed for this audit environment | `pnpm bench:browser`; `pnpm test:e2e` |
| AUD-004 | `pnpm test:e2e` | high | E2E | Firefox contenteditable completion case timed out waiting for `providerErrorCount >= 1`. | The E2E harness reset helper waited for empty content but not for async remote-controller reattachment to return to `idle` before arming the provider-error check. | Updated the contenteditable completion harness reset to wait for the remote debug state to be `idle`. | Focused Firefox rerun passed. | fixed | `pnpm exec playwright test tests/e2e/v4-1-completion.spec.ts --project=firefox -g "contenteditable completion.*stale response"` |
| AUD-005 | `pnpm bench:browser` | warning | performance | Mocked completion p95 exceeded the 800 ms target on several textarea/CodeMirror rows but stayed below the 2000 ms hard fail threshold. | Mocked completion includes debounce and browser scheduling overhead; correction thresholds are separate and passed. | No threshold change. Recorded as non-blocking warning. | Browser benchmark command passed. | deferred warning | `pnpm bench:browser` |
| AUD-006 | `pnpm build` | warning | performance | Vite reported chunks larger than 500 kB for demo/consumer bundles. | Demo and CodeMirror consumer bundles include large editor/demo dependencies. | No bundle policy change in this remediation prompt. | Build passed; warning remains below a hard release gate. | deferred warning | `pnpm build` |
| AUD-007 | `pnpm dictionary:gate-status`, `pnpm --filter @typai/core validate:dictionary:production` | blocker | source/license | Production generation remains blocked; Google Ngram partition hashes, aggregate source hash, generated output hash/counts/size, quality evidence, and final package notices are missing. | Production source approval and generated-output evidence are intentionally incomplete. | Preserved fail-closed manifest behavior and host-provided fallback. | Gate commands pass in blocked mode. | blocked for production generation; clean for blocked-host-provided branch | `pnpm dictionary:check-production`; `pnpm dictionary:gate-status`; `pnpm --filter @typai/core validate:dictionary:production` |

## Fixes Applied

- Tightened `tests/e2e/v4-1-completion.spec.ts` so the contenteditable
  completion reset path waits for the remote completion debug state to return to
  `idle` before the stale/provider-error scenario continues.

No source/license status, transform policy, runtime safety gate, package
threshold, or quality threshold was weakened.

## Final Gate Summary

Final full rerun status must remain attached to the commit that includes this
file. The expected clean state is:

- dictionary manifest and gate status pass in blocked mode.
- fixture transform is deterministic.
- production validate passes only because no generated production asset exists.
- FFI audit passes.
- spell-quality safety counts remain zero.
- language-asset, core, and browser benchmark hard gates pass.
- package size, package secret scan, dry pack, install smoke, public beta smoke,
  and release check pass.
- docs, build, lint, unit tests, and E2E pass.

## Next Action

Proceed to Prompt 139 final hardening audit against the blocked-host-provided
branch. Do not generate or bundle production language assets until the manifest
review status is approved and every source, license, attribution, hash, quality,
and package inclusion gate passes.
