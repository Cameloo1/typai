# Dictionary Production Approval

Status date: 2026-05-20.

Source approval status: **APPROVED for the candidate source path**.

Asset ingestion status: **BLOCKED**.

Transform pipeline status: **AVAILABLE in gated fixture mode**.

Package inclusion status: **EXCLUDED FROM `@typai/core`; host-provided only**.

Prompt 109 verifies and pins the first production source path. It does not
ingest, commit, package, publish, or ship generated production assets.
Prompt 110 adds the deterministic transform entrypoint, but production mode
still refuses to run while the manifest review status is blocked.
Prompt 111 wires the runtime/package policy for the blocked state: packaged
production assets remain unavailable, `dictionary.mode: "production"` throws a
clear initialization error, and host-provided assets remain the supported
external asset path.
Prompt 112 expands the production-RC spell-quality corpus and confirms the
blocked production mode plus host-provided fixture behavior in
`pnpm bench:spell-quality`.

## Approved Dictionary Source

- Source: English Speller Database / SCOWL v2 generated Hunspell `en_US`
  dictionary.
- Official source URL: https://wordlist.aspell.net/
- Source repository: https://github.com/en-wl/wordlist
- License/notice URL: https://github.com/en-wl/wordlist/blob/v2/Copyright
- Maintainer/project: Kevin Atkinson / English Speller Database.
- Selected export: official non-Australian `en_US` Hunspell dictionary at ESDB
  size 60.
- Exact source file:
  https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip
- Source pin: release `2026.02.25`, readme timestamp
  `Wed Feb 25 15:37:24 2026 -0500`, commit marker `[7e99eda]`.
- Source SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.
- Source ZIP size: 187,271 bytes.
- Expanded files observed locally for verification: `en_US.aff` 3,240 bytes,
  `en_US.dic` 508,614 bytes, `README_en_US.txt` 6,976 bytes.
- Dictionary entry count in `en_US.dic`: 47,551 header count before Hunspell
  flag stripping.
- Notice SHA-256:
  `71bffd4b74ad47fff01c8b3c666e77da92737854e568850d8728024e0a53f304`.
- License summary: the official notice permits use, copy, modification,
  distribution, and sale of ESDB/SCOWL or word lists created from it when the
  copyright and permission notices are preserved. The `en_US` Hunspell README
  also includes a BSD-style affix-file notice that must be preserved if the
  affix-derived source path is used.
- Transform compatibility: compatible after an explicit deterministic transform
  strips or models Hunspell flags, applies Typai token policy, records output
  counts, and emits Typai Dictionary Blob v1.
- Redistribution in npm package: source appears eligible for transformed npm
  redistribution only if the package includes the full applicable ESDB/SCOWL
  and affix-file notices. Generated output is still blocked until the transform,
  generated hash, generated size, quality, and review gates pass.
- Package inclusion plan: no generated dictionary is bundled yet. Future
  inclusion starts as `optional` or host-provided unless package size and
  quality gates prove `@typai/core` bundling is acceptable.

## Approved Frequency Source

- Source: Google Books Ngram Viewer data.
- Official source URL: https://books.google.com/ngrams/info
- Dataset index:
  https://storage.googleapis.com/books/ngrams/books/datasetsv3.html
- American English 2019 1-gram export index:
  https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html
- Maintainer/project: Google Books Ngram Viewer team / Google Books.
- Selected corpus: American English 2019 unigrams.
- Source pin: version `20200217`, American English 2019, path segment
  `eng-us`.
- Exact source files: `totalcounts-1` plus `1-00000-of-00014.gz` through
  `1-00013-of-00014.gz` from the American English 1-gram export index.
- Export index size observed locally: 4,662 bytes.
- Raw source SHA-256 status: not captured for `totalcounts-1` or the 14 gzip
  partitions.
- License summary: the official export page states the compilation is licensed
  under Creative Commons Attribution 3.0 Unported.
- Attribution requirement: package-visible attribution to Google Books Ngram
  Viewer, source URL, corpus/version, and license is required before generated
  frequency output can be included.
- Transform compatibility: compatible after an explicit deterministic transform
  fetches pinned 1-gram files, records raw hashes, filters to Typai-accepted
  lowercase alphabetic dictionary words, aggregates frequencies
  deterministically, and emits compact integer scores.
- Redistribution in npm package: plausible for transformed frequency scores
  under CC BY 3.0 only with attribution, but production inclusion remains
  blocked until raw source hashes, output hashes, generated size evidence, and
  final review signoff exist.
- Package inclusion plan: no raw Ngram files or generated frequency tables are
  bundled yet. Raw Ngram files must stay out of Git and package tarballs.
  Generated compact scores may be included only after manifest and size gates
  pass.

## Required Attribution Text

Current placeholder attribution is recorded in
`packages/core/assets/production/ATTRIBUTION.md`.

Future package-visible attribution must include at least:

```text
This product includes an English wordlist generated from the English Speller
Database / SCOWL by Kevin Atkinson.
Source: https://wordlist.aspell.net/ and https://github.com/en-wl/wordlist
Copyright 2000-2026 by Kevin Atkinson.
The applicable permission notice is included with this package.

This product includes frequency scores derived from Google Books Ngram Viewer
data.
Source: https://books.google.com/ngrams
Corpus: American English 2019, googlebooks-eng-us-20200217.
Google Books Ngram Viewer is acknowledged as the source.
```

The final asset PR must include full applicable license/notice text. This short
block and the current placeholder are not enough by themselves.

## Manifest Status

The current production manifest is blocked and lives at:

- `packages/core/assets/production/MANIFEST.template.json`

It records:

- dictionary source hash and size for
  `hunspell-en_US-2026.02.25.zip`
- Google Ngram American English 2019 exact source file URLs
- missing raw frequency hashes as `null`
- missing generated output counts and byte size as `null`
- `output.packageInclusion: "blocked"`
- `review.status: "blocked"`
- transform script path:
  `packages/core/scripts/build-production-dictionary.mjs`

The placeholder license and attribution files are:

- `packages/core/assets/production/LICENSES/README.md`
- `packages/core/assets/production/ATTRIBUTION.md`

## Runtime And Package Policy

Current package inclusion decision:

- Production generated binary: not committed.
- Production prepack generation: disabled while `review.status` is blocked.
- `@typai/core` tarball: excludes `assets/`, raw source files, production
  manifest/license placeholders, generated production binaries, and generated
  frequency tables.
- Default runtime mode: built-in deterministic correction with no dynamic asset.
- External asset path: host-provided Typai Dictionary Blob v1 bytes during
  `createTypaiCore()` initialization.
- Future path: optional language pack or explicit packaged production asset
  only after size, license, attribution, quality, and review gates pass.

Runtime dictionary modes:

- `built-in`: no dynamic dictionary is loaded.
- `host-provided`: `bytes`, `load`, or `url` is resolved during
  initialization, then token checking and suggestions stay synchronous.
- `production`: reserved for a future approved asset and currently unavailable.

Current Prompt 112 quality coverage:

- Approved autocorrection corpus: 27/27 expected corrections.
- Suggestions-only recall corpus: 12/12 expected suggestions.
- Valid-word false autocorrect count: 0.
- Protected-token false write count: 0.
- Reviewed false-positive autocorrect count: 0.
- Host-provided fixture path: loads during initialization and keeps the hot
  path synchronous after initialization.
- Production dictionary mode: still blocked while package inclusion is blocked.

## Transform Pipeline Status

The Prompt 110 transform command is:

```sh
pnpm --filter @typai/core build:dictionary:production
```

Current behavior:

- Reads the production manifest.
- Fails immediately when `review.status` is `blocked`.
- Does not download sources or make network calls by default.
- Requires pinned local input files and SHA-256 hashes before processing.
- Verifies source hashes before reading dictionary or frequency rows.
- Normalizes lowercase ASCII alphabetic words.
- Strips Hunspell-style flags when present.
- Excludes protected-looking URL, email, path, identifier, numeric, hyphenated,
  and non-alpha tokens.
- Deduplicates words, aggregates frequency rows, sorts deterministically, and
  emits Typai Dictionary Blob v1 plus metadata.

The validation command:

```sh
pnpm --filter @typai/core validate:dictionary:production
```

passes in the blocked state by confirming the production build is gated and by
running the same transform path against repo-local fixtures. Fixture outputs are
written under ignored `packages/core/assets/generated/` paths and are not
production assets.

## Exact Source Pinning Required Next

Before any production output can enter the package, the asset PR must record:

- Google Ngram raw file SHA-256 for `totalcounts-1` and every fetched 1-gram
  partition.
- Pinned local source file paths for the ESDB/SCOWL input and each Google Ngram
  input.
- Retrieval date for every raw source file.
- Transform command output from
  `pnpm --filter @typai/core build:dictionary:production`.
- Generated output SHA-256.
- Word count, frequency row count, compressed size, and uncompressed size.
- Review status, reviewer, and review date.

## Current Blockers

Source path approval is not package inclusion approval. Asset ingestion remains
blocked because:

- Google Ngram raw source hashes are not captured.
- The production manifest is still `MANIFEST.template.json` with
  `review.status: "blocked"`.
- Pinned local production source file paths are not recorded.
- No generated output hash exists.
- No generated word count, frequency row count, compressed size, or
  uncompressed byte size exists.
- No quality gate run has been performed against a generated production asset.
- No final review signoff exists.

Scaled mock and host-provided asset loading remain the fallback paths.

## Operator Summary

For the published beta:

- production dictionary binary: not bundled
- production frequency table: not bundled
- raw ESDB/SCOWL files: not bundled
- raw Hunspell files: not bundled
- raw Google Books Ngram files: not bundled
- `dictionary.mode: "production"`: unavailable
- host-provided Typai Dictionary Blob v1: supported external path

This approval record is source/path approval, not package inclusion approval.

## What Can Proceed Next

Production Asset Unblock may proceed only as a separate explicit phase. That
phase must:

1. capture every missing Google Ngram raw source hash
2. pin local input paths outside package output
3. run the deterministic transform
4. record generated output hash, counts, and size
5. run quality, false-positive, protected-token, and latency gates against the
   generated asset
6. add final attribution and notice files
7. record named review signoff
8. prove package tarballs exclude raw sources

Until then, the beta remains blocked / host-provided only.
