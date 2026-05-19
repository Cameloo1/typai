# Dictionary Production Approval

Status date: 2026-05-19

Source approval status: **APPROVED**.

Asset ingestion status: **BLOCKED until manifest, transform, hash,
attribution, size, quality, and review gates pass**.

Prompt 100 approves the first production source path. It does not ingest,
commit, package, publish, or ship generated production assets.

## Approved Dictionary Source

- Source: English Speller Database / SCOWL v2.
- Official source URL: https://wordlist.aspell.net/
- Source repository: https://github.com/en-wl/wordlist
- License/notice URL: https://github.com/en-wl/wordlist/blob/v2/Copyright
- Maintainer/project: Kevin Atkinson / English Speller Database.
- Selected export: official non-Australian `en-US` wordlist at ESDB size 60.
- Source pin: release `2026.02.25`, readme timestamp
  `Wed Feb 25 15:37:24 2026 -0500`, commit marker `[7e99eda]`.
- Exact reason for approval: the official copyright notice permits use, copy,
  modification, distribution, and sale of ESDB or generated wordlists when the
  required notices are preserved. The official dictionary page maps default
  Hunspell dictionaries to ESDB size 60 and warns against larger variants for
  typo-prone uncommon words, which matches Typai's conservative starting point.
- Package inclusion plan: no generated dictionary is bundled yet. Future
  inclusion starts as `optional` or host-provided unless package size and
  quality gates prove `@typai/core` bundling is acceptable.

## Approved Frequency Source

- Source: Google Books Ngram Viewer data.
- Official source URL: https://books.google.com/ngrams/info
- Maintainer/project: Google Books Ngram Viewer team / Google Books.
- Selected corpus: American English 2019 unigrams.
- Source pin: shorthand `eng_us_2019`, persistent corpus identifier
  `googlebooks-eng-us-20200217`.
- Exact reason for approval: the official Ngram Viewer page says graphs and
  data may be used for any purpose and provides persistent corpus identifiers.
  Typai will still require acknowledgement, source URL, corpus identifier, raw
  input hashes, deterministic filtering, and generated-output hashes.
- Package inclusion plan: no raw Ngram files or generated frequency tables are
  bundled yet. Raw Ngram files must stay out of Git and package tarballs.
  Generated compact scores may be included only after manifest and size gates
  pass.

## Required Attribution Text

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
block is not enough by itself.

## Exact Source Pinning Required Next

Before any production output can enter the package, the asset PR must record:

- ESDB/SCOWL release URL and raw input SHA-256.
- Google Ngram raw file URLs and SHA-256 for every fetched 1-gram partition.
- Retrieval date for every raw source file.
- Transform script path and command.
- Generated output SHA-256.
- Word count, frequency row count, compressed size, and uncompressed size.
- Review status, reviewer, and review date.

## Next Implementation Branch

Branch A is selected for source approval: one dictionary source and one
frequency source are approved.

Asset ingestion remains blocked. Prompt 101 should implement the manifest-gated
pipeline and host-provided or scaled mock path first. It should not commit a
production binary or frequency table unless all gates in
`docs/dictionary-asset-policy.md` pass.
