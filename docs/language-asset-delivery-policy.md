# Language Asset Delivery Policy

Status date: 2026-05-20.

Current branch: **blocked-host-provided**.

Selected delivery mode: **C. Production asset not bundled; host-provided
only**. Production mode itself remains **blocked** until
`packages/core/assets/production/MANIFEST.json` has `review.status:
"approved"` and the package inclusion decision changes away from `blocked`.

## Decision

`@typai/core` currently ships only:

- `dist`
- generated Wasm `pkg`
- package metadata
- `README.md`

It does not ship:

- generated production dictionary binaries
- generated production frequency tables
- raw ESDB/SCOWL, Hunspell, Google Books Ngram, or frequency source files
- production transform outputs
- tests, reports, debug dumps, or local benchmark artifacts
- provider proxy examples, `.env` files, or secrets

Host applications may still pass Typai Dictionary Blob v1 bytes during
`createTypaiCore()` initialization with `dictionary.bytes`, `dictionary.load`,
or `dictionary.url` and `mode: "host-provided"`. Those bytes are
embedder-owned and are not mixed with personal/project memory.

## Rationale

The production manifest is blocked. The ESDB/SCOWL dictionary source hash is
pinned and the Google Books Ngram `totalcounts-1` hash is pinned, but the
remaining Google Ngram partition hashes, generated output hash, generated
counts, generated size, final quality evidence, and package-visible notices are
not complete. A package cannot include production language data while any of
those gates are missing.

The built-in fallback stays intentionally tiny. The scaled mock asset is a
loader/delete-index stress fixture only and is not production language quality.

## Package Size Budget

`pnpm package:size-report` enforces the current package budget:

- blocked-state `@typai/core` tarball warning threshold: 256 KiB
- blocked-state `@typai/core` tarball failure threshold: 1 MiB
- general package tarball warning threshold: 512 KiB
- general package tarball failure threshold: 2 MiB
- target production generated asset package impact: 2 MiB
- production asset hard failure threshold: 8 MiB
- raw dictionary/frequency source files in packages: 0 bytes
- blocked production binaries in packages: 0 bytes
- `.env`, provider secrets, and private-key-looking payloads: 0

If a future approved production asset exceeds the target but stays under the
hard failure threshold, the size report must emit a warning and release review
must explicitly accept the impact.

## Tarball Policy

The package gates fail closed:

- `pnpm pack:dry` fails if `@typai/core` includes `assets/` while production
  review is blocked.
- `pnpm package:size-report` fails if a blocked production binary, raw source
  archive, raw dictionary file, raw frequency file, or missing approved notice
  appears in packed output.
- `pnpm scan:package-secrets` scans packed output for `.env` paths, provider
  secrets, private-key-looking strings, server/provider example code, raw
  language sources, and blocked production assets.
- `pnpm smoke:install` and `pnpm smoke:public-beta` verify the packed
  `@typai/core` host-provided dictionary path and the clear production-mode
  unavailable error.

## Future Modes

Bundling a production asset in `@typai/core` requires:

- approved manifest review status
- approved redistribution decisions
- source hashes for every source file
- generated output hash, word count, byte size, and metadata
- package-visible manifest, license, and attribution files
- package-size budget review
- loader and smoke validation from packed tarballs

Generating during `prepack` has the same requirements and additionally must be
deterministic, offline by default, hash-verified, and fail closed when approval
or source evidence is incomplete.

An optional future `@typai/language-en-us` package remains a valid design if
the production asset is too large for `@typai/core`, if license notices should
be isolated, or if language packs need independent versioning. That package is
not created in this prompt.

## Beta Implications

The beta package path remains conservative:

- built-in correction works without language assets
- host-provided Typai Dictionary Blob v1 bytes are supported at initialization
- `dictionary.mode: "production"` is unavailable while the manifest is blocked
- no raw or generated production language asset is packed
- package scans and smoke tests enforce the current decision
