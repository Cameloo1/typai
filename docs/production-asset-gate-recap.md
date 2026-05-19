# Production Asset Gate Recap

Status date: 2026-05-19.

This recap summarizes the current production dictionary and frequency asset
state from:

- `docs/dictionary-source-selection.md`
- `docs/dictionary-asset-policy.md`
- `docs/dictionary-production-approval.md`
- `docs/dictionary-asset-blockers.md`
- `docs/intelligence-quality-foundation-complete.md`

## Current Decision

Source approval status: **APPROVED** for the first source path.

Asset ingestion status: **BLOCKED until manifest, transform, hash,
attribution, size, quality, and review gates pass**.

No production dictionary, frequency table, raw corpus, or generated production
language asset is bundled in this repository state.

## Approved Source Path

The currently approved source path is:

- Dictionary: English Speller Database / SCOWL v2, official non-Australian
  `en-US` size 60 output, release `2026.02.25` / `[7e99eda]`.
- Frequency: Google Books Ngram Viewer American English 2019 unigrams,
  persistent corpus identifier `googlebooks-eng-us-20200217`.

This approval selects sources only. It does not approve a generated binary,
frequency table, package asset, or npm release.

## Unresolved Blockers

Production bundling remains blocked because the repository does not yet have:

- production asset manifest under `docs/asset-manifests/`
- deterministic production transform script and command
- raw ESDB/SCOWL input SHA-256
- raw Google Ngram input URLs and SHA-256 values
- generated output SHA-256
- package-visible attribution and full applicable notices
- compressed and uncompressed production output size evidence
- quality gate results against the generated production asset
- package dry-run proof that raw inputs are excluded
- named review signoff with review date

## What Cannot Be Bundled Yet

The following must not be committed, packed, published, or claimed as shipped:

- generated ESDB/SCOWL production dictionary output
- generated Google Ngram-derived frequency table
- combined production dictionary/frequency blob
- raw Google Ngram input partitions
- raw or transformed unclear-license downstream dictionary assets
- any asset with missing attribution, source hash, transform, size, or review
  evidence

Package inclusion remains `none` until these gates pass.

## Scaled Mock Status

The scaled mock path is active only as a deterministic loader, bounds,
frequency-ranking, and performance stress fixture.

- Generated path: `packages/core/assets/generated/`
- Git status: generated binary and metadata files are ignored
- Required labels: `mockOnly: true` and `production: false`
- Production status: not a production dictionary or frequency asset
- Package status: must not be bundled as a production language asset

The checked-in mock fixture under `packages/core/assets/` is also mock-only.

## Host-Provided Asset Path Status

The host-provided asset path exists through `createTypaiCore({ dictionary })`.
It can load validated Typai Dictionary Blob v1 bytes through the existing
C++/Rust/Wasm boundary.

Host-provided assets still need provenance and manifest validation before they
are trusted. This path must not weaken protected-token, valid-word, personal
dictionary, or autocorrect gates.

## Exact Gates Required Before Production Bundling

Before any production asset can move from `none` to `optional` or `bundled`,
the asset PR must provide:

1. Official source URL for every input.
2. Exact source version, corpus identifier, release tag, commit, or durable
   pin.
3. Retrieval date and SHA-256 for every raw source file.
4. Full license or durable official notice link.
5. Explicit redistribution, commercial-use, and modification evidence.
6. Package-ready attribution text and required notice files.
7. Deterministic transform script and command.
8. Generated output format, count metadata, byte sizes, and SHA-256.
9. Package inclusion decision: `none`, `optional`, or `bundled`.
10. Package dry-run proof that raw source files are excluded.
11. Spell quality, protected-token, valid-word, latency, and false-positive
    evidence against the generated asset.
12. Named review signoff and review date.

If any gate is missing or unclear, production bundling remains blocked.
