# Dictionary Production Approval

Status date: 2026-05-21.

Source approval status: **PARTIAL SOURCE PATH APPROVED**.

Asset ingestion status: **BLOCKED**.

Transform pipeline status: **PROMPT 131 DETERMINISTIC PIPELINE READY; FIXTURE
MODE VALIDATED**.

Package inclusion status: **BLOCKED; host-provided only**.

Prompt 132 branch: **blocked-host-provided**. The production build gate was
checked and failed closed while `reviewStatus` remained blocked.

This is the authoritative production language asset approval record. It
approves no bundled production dictionary or frequency asset. It records the
current source evidence and the exact blockers that keep production asset
generation closed.

Prompt 142 update: source blocker closure was attempted and remains blocked.
No external local source paths were provided, the 14 Google Ngram gzip
partition SHA-256 fields remain empty, final package-visible notices remain
placeholders, and no generated output metadata exists. The manifest review
status therefore remains `blocked`.

## Approval Record

```yaml
reviewStatus: blocked
reviewedAt: 2026-05-20
reviewer: manual-release-operator

dictionarySource:
  name: English Speller Database / SCOWL v2 generated Hunspell en_US dictionary
  url: https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip
  version: 2026.02.25 rel-2026.02.25 commit 7e99eda
  files:
    - hunspell-en_US-2026.02.25.zip
    - en_US.aff
    - en_US.dic
    - README_en_US.txt
  sha256: ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9
  license: ESDB/SCOWL notice license plus relevant Hunspell affix-file notice
  licenseFile: packages/core/assets/production/LICENSES/README.md
  attribution: English wordlist generated from the English Speller Database / SCOWL by Kevin Atkinson; affix-file notice required if affix-derived material is used.
  redistributionDecision: approved for transformed redistribution only with notices preserved

frequencySource:
  name: Google Books Ngram Viewer American English 2019 1-grams
  url: https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html
  version: googlebooks-eng-us-20200217 American English 2019
  files:
    - totalcounts-1
    - 1-00000-of-00014.gz
    - 1-00001-of-00014.gz
    - 1-00002-of-00014.gz
    - 1-00003-of-00014.gz
    - 1-00004-of-00014.gz
    - 1-00005-of-00014.gz
    - 1-00006-of-00014.gz
    - 1-00007-of-00014.gz
    - 1-00008-of-00014.gz
    - 1-00009-of-00014.gz
    - 1-00010-of-00014.gz
    - 1-00011-of-00014.gz
    - 1-00012-of-00014.gz
    - 1-00013-of-00014.gz
  sha256:
    totalcounts-1: 6ce99984774743b7142e2f7e95fc33bd676ea4485038081881e61e4456804d8a
    partitions: blocked; 14 gzip partition hashes missing
  license: Creative Commons Attribution 3.0 Unported
  licenseFile: packages/core/assets/production/LICENSES/README.md
  attribution: Google Books Ngram Viewer source, corpus/version, CC BY 3.0 license, and change notice required.
  redistributionDecision: blocked for production ingestion until every raw source hash and final attribution notice is present

packageInclusionDecision: blocked
rawSourcePolicy: never-commit

sizeBudget:
  sourceSizeLimit: external-only raw staging; current Google Ngram source set is 8,223,758,203 bytes by HEAD metadata
  generatedAssetWarningSize: 2 MiB
  generatedAssetFailSize: 8 MiB
  coreTarballWarningSize: 2 MiB package impact
  coreTarballFailSize: 4 MiB package impact

qualityGate:
  requiredSpellQualityBenchmarkTargets:
    - pnpm bench:spell-quality must pass
    - protected-token false writes must be 0
    - valid-word autocorrections must be 0
    - delete-index or edit-distance autocorrections outside the common typo table must be 0
    - reviewed false-positive autocorrections must be 0
    - approved common-typo correction corpus must pass
    - suggestions-only recall corpus must pass
  requiredFalsePositiveThresholds:
    - 0 protected-token writes
    - 0 valid-word autocorrections
    - 0 reviewed false-positive autocorrections

blockers:
  - Google Ngram partition SHA-256 values are missing.
  - Generated output hash is missing.
  - Generated word count and byte size are missing.
  - Final package-visible license and attribution bundle is missing.
  - Quality gates have not run against a generated production asset.
  - Package dry-run has not proven production asset inclusion/exclusion.
  - Final review signoff is still blocked.
```

Prompt 131 update:

- `packages/core/scripts/build-production-dictionary.mjs` now implements the
  deterministic transform pipeline for fixture and production modes.
- Fixture mode writes ignored output under `packages/core/assets/generated/`
  and verifies repeated binary SHA-256 determinism.
- Production mode fails closed while `reviewStatus` is blocked and requires
  pinned local source paths, matching SHA-256 values, package-visible license
  and attribution files, approved redistribution fields, and non-blocked
  package inclusion before processing.
- The current production approval record remains blocked; this update approves
  the pipeline machinery, not production source ingestion or package inclusion.

Prompt 132 update:

- Production asset generation was not run because `reviewStatus` remains
  blocked.
- `pnpm --filter @typai/core build:dictionary:production` fails closed with
  `review.status is blocked`.
- Host-provided Typai Dictionary Blob v1 loading remains the supported external
  fallback path.
- Scaled mock output remains mock-only and suitable only for loader and
  delete-index stress validation.

## Dictionary Source Verification

- Official source URL: `https://wordlist.aspell.net/`.
- Official project name: English Speller Database / SCOWL.
- Maintainer/project owner: Kevin Atkinson / English Speller Database.
- Exact release: `2026.02.25`, `rel-2026.02.25`, commit marker `7e99eda`.
- Exact file name: `hunspell-en_US-2026.02.25.zip`.
- Source archive SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.
- Source size: 187,271 bytes.
- Expected generated word count: unknown until transform; source `en_US.dic`
  header count is 47,551 before flag handling.
- Language/locale coverage: English, United States, ESDB size 60 generated
  Hunspell dictionary.
- Update cadence: active upstream releases; each update requires a new source
  review and hash capture.
- Redistribution allowed: yes for the selected source path if notices are
  preserved.
- Modification allowed: yes if notices are preserved.
- Commercial use allowed: yes if notices are preserved.
- Attribution required: yes.
- Generated derivative npm redistribution: source license appears compatible
  with a transformed npm asset only when full notices are package-visible.
- Raw source commit: blocked by project policy even if the upstream license
  would allow redistribution.

Risks:

- Stale data if pinned release is not refreshed.
- Affix-derived material has separate notice preservation requirements.
- Large/uncommon word acceptance could degrade Typai false-negative behavior.
- Generated output still needs quality and false-positive review.

## Frequency Source Verification

- Official source URL: `https://books.google.com/ngrams/info`.
- Export index:
  `https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html`.
- Exact corpus/version: American English 2019,
  `googlebooks-eng-us-20200217`.
- Exact source files: `totalcounts-1` plus `1-00000-of-00014.gz` through
  `1-00013-of-00014.gz`.
- License/terms: Creative Commons Attribution 3.0 Unported on the export page.
- Source size: 8,223,758,203 compressed bytes by HEAD metadata.
- Source hash status: `totalcounts-1` pinned; 14 gzip partition hashes missing.
- Expected generated data size: unknown until transform.
- Frequency normalization strategy: aggregate pinned unigram rows
  deterministically, filter to lowercase alphabetic Typai-accepted dictionary
  words, intersect with accepted dictionary output, and emit compact integer
  scores with output hash/count/size.
- Generated frequency table redistribution: blocked until complete source
  hashes, final attribution, generated metadata, quality evidence, and review
  signoff are present.
- Raw source commit: blocked by project policy and package-size constraints.

Risks:

- Raw source is very large.
- Missing partition hashes block reproducible transform.
- Generated-data provenance must be preserved in package-visible notices.
- Book corpus is not the same as modern editor/chat/code-adjacent prose.
- Package bloat risk remains unknown until generated size is measured.

## Current Runtime And Package Policy

- Production generated binary: not committed.
- Production prepack generation: disabled while `review.status` is blocked.
- `@typai/core` tarball: must continue excluding raw sources and generated
  production language assets.
- Default runtime mode: built-in deterministic correction.
- External asset path: host-provided Typai Dictionary Blob v1 bytes at
  `createTypaiCore()` initialization.

## Operator Summary

For this prompt:

- production dictionary binary: not generated
- production frequency table: not generated
- raw ESDB/SCOWL files: not committed
- raw Hunspell files: not committed
- raw Google Books Ngram files: not committed
- package inclusion: blocked
- fallback: host-provided only
