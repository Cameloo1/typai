# Production Asset Status Report

Status date: 2026-05-21.

Branch taken: **blocked-host-provided**.

Prompt 132 did not generate a production asset. The production manifest remains
blocked and the correct execution path is the host-provided fallback.

## Manifest And Output Status

- Manifest: `packages/core/assets/production/MANIFEST.json`.
- Manifest review status: `blocked`.
- Package inclusion status: `blocked`.
- Prompt 134 delivery mode: host-provided-only for package tarballs;
  production mode remains blocked.
- Generated production output: none.
- Manifest `output.wordCount`: `null`.
- Manifest `output.byteSize`: `null`.
- Manifest `output.sha256`: empty.
- Manifest `output.assetPath`: empty.
- Raw source policy: `never-commit`; raw ESDB/SCOWL, Hunspell, Google Ngram,
  TSV, ZIP, and gzip production inputs remain external.

The production transform gate was checked and failed closed:

```text
pnpm --filter @typai/core build:dictionary:production
result: failed as expected
reason: Production dictionary build is blocked by packages/core/assets/production/MANIFEST.json: review.status is blocked.
```

## Fallback Status

Host-provided Typai Dictionary Blob v1 bytes remain mechanically ready:

- pass bytes directly with `createTypaiCore({ dictionary: { bytes } })`
- provide an async loader with `createTypaiCore({ dictionary: { load } })`
- provide a host URL with `createTypaiCore({ dictionary: { url } })`

Dictionary bytes load only during `createTypaiCore()` initialization. After
initialization, completed-token checks and suggestions remain synchronous and do
not fetch assets or perform hot-path loading.

The scaled mock remains a mock-only loader and delete-index stress asset. It is
generated under `packages/core/assets/generated/`, ignored by Git, marked
`mockOnly: true`, marked `production: false`, and not bundled as language
coverage.

Prompt 133 runtime hardening keeps all dynamic language asset loading on the
`createTypaiCore()` initialization boundary. Host-provided, fixture, and
scaled-mock Blob v1 bytes flow through TypeScript -> Rust/Wasm -> C++ and are
validated before replacing the current C++ dictionary/delete-index state.
Blocked production mode and malformed host-provided blobs fail clearly without
clearing a previously loaded valid asset. Default initialization and
`built-in` mode intentionally clear dynamic asset state and return to the tiny
deterministic built-in vocabulary.

Runtime stats exposed by `@typai/core` are primitive diagnostics:

- loaded dictionary word count
- loaded dictionary byte size
- delete-index entry count
- delete-index memory estimate

Current scaled mock runtime stats from Prompt 133:

```text
loaded dictionary bytes: 79192
delete-index entries: 58803
delete-index memory estimate: 3163735 bytes
```

Prompt 134 package policy enforcement:

- `@typai/core` package files remain `dist`, generated Wasm `pkg`, package
  metadata, and `README.md`.
- `pnpm pack:dry` rejects `assets/`, raw language source files, and generated
  production binaries while the manifest is blocked.
- `pnpm package:size-report` reports tarball sizes, Wasm size, production
  binary inclusion, raw-source inclusion, and notice inclusion.
- `pnpm smoke:install` and `pnpm smoke:public-beta` exercise host-provided
  dictionary bytes from packed tarballs and verify the blocked production-mode
  error.

## Current Source Summary

- Dictionary source path: ESDB/SCOWL v2 generated Hunspell `en_US`, release
  `2026.02.25`, archive SHA-256 pinned.
- Frequency source path: Google Books Ngram Viewer American English 2019
  unigrams, `totalcounts-1` SHA-256 pinned, 14 gzip partition SHA-256 values
  still missing.
- Generated output hash: missing because production generation is blocked.
- Quality evidence against generated production asset: missing because no
  generated production asset exists.
- Package proof for production asset inclusion: missing because package
  inclusion remains blocked.

Prompt 142 blocker closure result:

- external pinned source paths: missing
- Google Ngram gzip partition hashes: missing for all 14 partitions
- dictionary source archive hash: pinned in manifest, not recomputed because no
  external local archive path was provided
- Google `totalcounts-1` hash: pinned in manifest, not recomputed because no
  external local file path was provided
- final package-visible license/attribution notices: still placeholders
- generated output hash, word count, and byte size: missing
- final review signoff: blocked

The production asset lane is parked. Prompt 143 must not generate a production
asset unless a future manifest review provides complete source paths, hashes,
notices, quality evidence, package proof, and review approval.

## Command Summary

Prompt 132 validation commands:

```text
pnpm --filter @typai/core build:dictionary:fixture
result: passed
summary: fixture output words=8 bytes=185 sha256=34e58d10f5f96fb6a591c1a82dc971ad2638a9ed88accb9fb10887f2d41da5ac

pnpm --filter @typai/core build:dictionary:production
result: failed as expected while blocked

pnpm --filter @typai/core validate:dictionary:production
result: passed blocked-state validation

pnpm --filter @typai/core inspect:dictionary
result: passed, inspected ignored fixture output

pnpm dictionary:check-production
result: passed, blocked manifest accepted

pnpm dictionary:gate-status
result: passed, review status blocked, generated output none

pnpm --filter @typai/core test
result: passed, 214 Vitest tests plus native and Wasm smoke checks

pnpm --filter @typai/core bench
result: passed, production dictionary mode blocked, scaled mock load and delete-index stress completed

pnpm test
result: passed after sandbox escalation for Cargo/Wasm temp-file access

pnpm build
result: passed

pnpm lint
result: passed, Biome checked 269 files

pnpm docs:check
result: passed, 39 required docs and consumer examples verified

pnpm scan:package-secrets
result: passed after sandbox escalation for npm pack/prepack temp/cache access, 7 release packages scanned

pnpm ffi:audit
result: passed, C++ native files=4, C++ extern C declarations=18, Rust extern C blocks=1, TypeScript bridge files=3

pnpm --filter @typai/core test
Prompt 133 result: passed after sandbox escalation for Cargo/Wasm temp-file access, 221 Vitest tests plus 23 native FFI tests and Wasm smoke

pnpm --filter @typai/core bench
Prompt 133 result: passed after sandbox escalation for Cargo/Wasm temp-file access
summary: built-in check p95=0.0068 ms, host-provided mock check p95=0.0066 ms, scaled mock load p95=17.3027 ms, scaled mock check p95=0.0067 ms, scaled mock suggest p95=0.0066 ms
```

Normal sandbox runs for `pnpm test` and `pnpm scan:package-secrets` hit local
Windows sandbox path restrictions. The reruns above used the same project
commands with approval and passed.

## Next Required Steps

1. Capture SHA-256 for all 14 Google Ngram gzip partitions in a disposable
   external workspace.
2. Stage raw source files externally and record pinned local paths for the
   approved generation run.
3. Finalize package-visible license and attribution notices.
4. Change manifest `review.status` only after the source, license, hash,
   attribution, size, quality, package, and review gates pass.
5. Run the production transform and record generated word count, byte size,
   SHA-256, excluded counts, frequency coverage, and transform metadata.
6. Run quality and package proof before any package inclusion change.
