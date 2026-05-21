# Dictionary Asset Policy

Production dictionary and frequency assets require explicit source, license,
manifest, hash, attribution, size, quality, package, and review approval before
they can be generated, bundled, packed, published, or distributed with Typai.

Source approval is not package inclusion approval.

## Fail-Closed Rules

- Production asset build cannot run unless
  `packages/core/assets/production/MANIFEST.json` has
  `review.status: "approved"`.
- Generated asset output cannot be packed unless
  `manifest.output.packageInclusion` is one of
  `generated-during-prepack` or `committed-generated-binary`.
- `manifest.output.packageInclusion: "blocked"` means no generated production
  output can be packed.
- Raw source files cannot be packed unless a later policy explicitly allows
  that exact source path. Current policy is `never-commit`.
- Source hashes must be checked before transform.
- Generated output hashes must be recorded after transform.
- License and attribution files must be package-visible before packaging.
- Missing, unknown, or unclear redistribution evidence blocks ingestion.
- No network fetch is allowed in the default production transform path.
- Production transform source files must be pinned local files whose SHA-256
  values match before parsing starts.
- Blocked validation may run the repo-local fixture transform, but it must not
  write or reference generated production output.

## Required Approval Gates

Every production dictionary, frequency table, or combined asset must provide:

- Official source URL for every input.
- Exact source version, release, commit, corpus identifier, and retrieval date.
- SHA-256 for every fetched raw source file.
- Full license or notice text, or a stable official license URL when the source
  does not publish a standalone file.
- Explicit redistribution, commercial-use, and modification evidence.
- Package-ready attribution text.
- Deterministic transform script that reads pinned local inputs and verifies
  hashes before processing.
- Manifest metadata for source, license, transform, output count, output size,
  generated hash, package inclusion, reviewer, and review date.
- Size budget and measured package impact.
- Quality evidence against the generated asset.
- Package dry-run proof that raw source files are excluded.
- Named review signoff.

If any gate is missing or unclear, asset ingestion is blocked.

## Manifest Contract

The production manifest lives at:

```text
packages/core/assets/production/MANIFEST.json
```

It uses:

- `review.status: "blocked" | "approved"`
- `dictionary.redistribution: "approved" | "blocked" | "unknown"`
- `frequency.redistribution: "approved" | "blocked" | "unknown"`
- `output.packageInclusion: "blocked" | "host-provided-only" |
  "generated-during-prepack" | "committed-generated-binary"`

When blocked, `output.assetPath` and `output.sha256` must be empty and
`output.wordCount` / `output.byteSize` must be `null`.

When approved, every source hash, generated hash, generated count, generated
size, final license file, final attribution file, and package inclusion
decision must be present.

## Approved Source Defaults

The current source defaults are:

- Dictionary: English Speller Database / SCOWL v2, official `en_US` size 60
  generated Hunspell dictionary, release `2026.02.25`, commit marker `7e99eda`.
- Frequency: Google Books Ngram Viewer American English 2019 unigrams,
  `googlebooks-eng-us-20200217`.

These defaults do not approve a committed binary.

## Package Inclusion Policy

Default package inclusion is `blocked`. Prompt 134 selects
host-provided-only delivery while manifest review remains blocked; see
`docs/language-asset-delivery-policy.md`.

Initial budget target:

- blocked-state `@typai/core` tarball warning/fail: 256 KiB / 1 MiB
- general package tarball warning/fail: 512 KiB / 2 MiB
- target production generated asset package impact: <= 2 MiB
- generated production asset fail: > 8 MiB
- raw source files in package tarballs: 0 bytes
- blocked production binaries in package tarballs: 0 bytes

If the generated asset exceeds budget, use host-provided assets or an optional
language package instead of bundling it in `@typai/core`.

## Update Process

1. Update `docs/dictionary-source-selection.md` and this policy only with
   current verified source facts.
2. Pin source URLs, release identifiers, retrieval dates, and SHA-256 values.
3. Update `packages/core/assets/production/MANIFEST.json`.
4. Keep raw source files outside the repository.
5. Run `pnpm dictionary:check-production` and `pnpm dictionary:gate-status`.
6. Approve generation only after source/license/hash/attribution gates pass.
7. Run the deterministic transform from pinned local inputs with:
   `pnpm --filter @typai/core build:dictionary:production`.
8. Record generated output count, size, hash, frequency coverage, excluded
   counts, transform version, and attribution reference.
9. Run quality, package, smoke, secret, docs, test, build, and lint gates.
10. Record final review signoff before package inclusion.

## Mock And Host-Provided Assets

`packages/core/assets/mock-en-us.dictionary.bin` and its JSON companion are
mock fixtures only. They are not production dictionary or frequency assets.

Generated scaled mock and production-transform fixture outputs live under
ignored generated paths. They are not production language assets.

Prompt 131 fixture validation uses:

```sh
pnpm --filter @typai/core build:dictionary:fixture
pnpm --filter @typai/core validate:dictionary:production
pnpm --filter @typai/core inspect:dictionary
```

The fixture command proves normalization, filtering, frequency merge,
deduplication, sorting, Blob v1 encoding, metadata generation, and output hash
determinism without ingesting production sources.

Host-provided Typai Dictionary Blob v1 bytes may be loaded during
`createTypaiCore()` initialization. Host-provided assets must not weaken
protected-token, valid-word, personal dictionary, or autocorrect gates.

Host-provided loading is initialization-time only. The correction hot path must
not fetch, stream, parse, or replace dictionary assets. Embedder-provided bytes
must already be Typai Dictionary Blob v1 and must pass the same loader
validation as repo fixtures.

Scaled mock output is mock-only. It can be used for loader and delete-index
stress checks, but it is not production coverage and must remain ignored,
unpacked, and labeled `mockOnly: true` / `production: false`.

## Current Status

Production asset status is blocked / host-provided only. See:

- `docs/production-asset-unblock.md`
- `docs/production-asset-status-report.md`
- `docs/dictionary-source-selection.md`
- `docs/dictionary-production-approval.md`
- `docs/dictionary-asset-blockers.md`
