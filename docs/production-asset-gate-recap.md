# Production Asset Gate Recap

Status date: 2026-05-20.

Typai beta is published, but production language assets are still blocked. This
is intentional. The npm packages do not include a production dictionary,
frequency table, raw corpus, or generated production language blob.

## Current Decision

| Area | State |
| --- | --- |
| Dictionary source direction | approved candidate source path |
| Frequency source direction | approved candidate source path |
| Generated production asset | blocked |
| Package inclusion | none |
| Runtime production mode | unavailable |
| Supported external path | host-provided Typai Dictionary Blob v1 |

Source approval is not package inclusion approval.

## Approved Source Direction

Dictionary candidate:

- English Speller Database / SCOWL v2.
- Official non-Australian `en-US` size 60 output first.
- Release `2026.02.25`, commit marker `[7e99eda]`.

Frequency candidate:

- Google Books Ngram Viewer American English 2019 unigrams.
- Corpus identifier `googlebooks-eng-us-20200217`.

These sources are selected for a future asset pipeline. They are not bundled in
the beta.

## Why Bundling Is Blocked

The repository still lacks:

- Google Ngram raw source SHA-256 values
- pinned local production input paths
- generated output SHA-256
- generated word/frequency counts
- compressed and uncompressed size evidence
- final package-visible attribution and notices
- quality gate results against the generated asset
- package dry-run proof that raw inputs are excluded
- named reviewer and review date

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
  attribution, and review signoff

## Current Runtime Behavior

`createTypaiCore()` supports:

- built-in deterministic correction
- host-provided dictionary bytes, loader, or URL

`dictionary.mode: "production"` throws a clear unavailable error while the
manifest review status is blocked.

Host-provided assets still need provenance controlled by the host app. They must
not weaken protected-token, valid-word, personal dictionary, or autocorrect
gates.

## Mock And Fixture Status

Scaled mock and fixture assets exist for loader, transform, performance, and
quality tests. They are labeled mock/fixture only and are not production
coverage.

Generated fixture output belongs under ignored generated paths and must not be
promoted into package output as production data.

## Exact Gates Before Unblock

Before production package inclusion can move from `none` to `optional` or
`bundled`, the asset PR must provide:

1. Official source URL for every input.
2. Exact source version, corpus identifier, release tag, commit, or durable pin.
3. Retrieval date and SHA-256 for every raw source file.
4. Full license text or durable official notice link.
5. Explicit redistribution, commercial-use, and modification evidence.
6. Package-ready attribution text and notice files.
7. Deterministic transform command and script.
8. Generated output format, counts, byte sizes, and SHA-256.
9. Package inclusion decision: `none`, `optional`, or `bundled`.
10. Package dry-run proof that raw source files are excluded.
11. Spell quality, protected-token, valid-word, latency, and false-positive
    evidence against the generated asset.
12. Named review signoff and review date.

Future work should prioritize this path only if production spell coverage is
more important than integration/dogfooding work.
