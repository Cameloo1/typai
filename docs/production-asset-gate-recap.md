# Production Asset Gate Recap

Status date: 2026-05-20.

Production language assets are still blocked. The packages do not include a
production dictionary, frequency table, raw corpus, or generated production
language blob. This gate is independent of any beta-release workflow.

## Current Decision

| Area | State |
| --- | --- |
| Source approval status | **APPROVED** for ESDB/SCOWL dictionary source path; **BLOCKED** for frequency ingestion until all raw hashes are captured |
| Asset ingestion status | **BLOCKED** |
| Dictionary source direction | ESDB/SCOWL v2 generated Hunspell `en_US` size 60 |
| Frequency source direction | Google Books Ngram American English 2019, hash gate incomplete |
| Generated production asset | blocked |
| Package inclusion | none / blocked |
| Runtime production mode | unavailable |
| Supported external path | host-provided asset path |

Package inclusion remains `none` while the production manifest is blocked.
Source approval is not package inclusion approval.

## Pinned Source Evidence

Dictionary candidate:

- English Speller Database / SCOWL v2.
- Official `en_US` Hunspell dictionary, ESDB size 60.
- Release `2026.02.25`, tag `rel-2026.02.25`, commit marker `7e99eda`.
- Source SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.

Frequency candidate:

- Google Books Ngram Viewer American English 2019 unigrams.
- Corpus identifier `googlebooks-eng-us-20200217`.
- `totalcounts-1` SHA-256:
  `6ce99984774743b7142e2f7e95fc33bd676ea4485038081881e61e4456804d8a`.
- The 14 gzip partition SHA-256 values are not captured, so ingestion remains
  blocked.

## Why Bundling Is Blocked

The repository still lacks:

- Google Ngram raw source SHA-256 values for the 14 gzip partitions
- generated output SHA-256
- generated word/frequency counts
- compressed and uncompressed size evidence
- final package-visible attribution and notices
- quality gate results against the generated asset
- package dry-run proof that raw inputs are excluded
- final review signoff

If any item is missing, package inclusion remains blocked.

## What Must Not Ship Yet

Do not commit, pack, publish, or claim:

- generated ESDB/SCOWL production dictionary output
- generated Google Ngram-derived frequency table
- combined production dictionary/frequency blob
- raw Google Ngram partitions
- raw Hunspell files
- raw or unclear-license downstream dictionary assets
- any asset without source hashes, transform evidence, size evidence,
  attribution, quality evidence, and review signoff

## Current Runtime Behavior

`createTypaiCore()` supports:

- built-in deterministic correction
- host-provided Typai Dictionary Blob v1 bytes, loader, or URL

`dictionary.mode: "production"` remains unavailable while the manifest review
status is blocked.

Host-provided assets still need provenance controlled by the host app. They must
not weaken protected-token, valid-word, personal dictionary, or autocorrect
gates.

## Mock And Fixture Status

Scaled mock and fixture assets exist for loader, transform, performance, and
quality tests. They are labeled `mockOnly: true` and `production: false` where
applicable. They are not production coverage.

Generated fixture output belongs under ignored generated paths and must not be
promoted into package output as production data.

## Exact Gates Before Unblock

Before production package inclusion can move away from blocked, the asset PR
must provide:

1. Official source URL for every input.
2. Exact source version, corpus identifier, release tag, commit, or durable pin.
3. Retrieval date and SHA-256 for every raw source file.
4. Full license text or durable official notice link.
5. Explicit redistribution, commercial-use, and modification evidence.
6. Package-ready attribution text and notice files.
7. Deterministic transform command and script.
8. Generated output format, counts, byte sizes, and SHA-256.
9. Package inclusion decision.
10. Package dry-run proof that raw source files are excluded.
11. Spell quality, protected-token, valid-word, latency, and false-positive
    evidence against the generated asset.
12. Review signoff and review date.

Future work should prioritize this path only if production spell coverage is
more important than integration/dogfooding work.
