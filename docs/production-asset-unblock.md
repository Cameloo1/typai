# Production Asset Unblock

Status date: 2026-05-21.

Phase name: Production Asset Unblock.

Current status: **blocked / host-provided only**.

Final audit checkpoint:
`docs/production-asset-unblock-complete.md`.

This phase pins the production language asset contract. It does not transform,
generate, commit, pack, publish, or claim a production dictionary/frequency
asset.

## What Remains True

- Production language assets remain blocked / host-provided only.
- Prompt 139 completed the final hardening audit for this blocked state.
- The scaled mock dictionary is not production language coverage.
- `createTypaiCore()` can load host-provided Typai Dictionary Blob v1 bytes at
  initialization.
- `dictionary.mode: "production"` remains unavailable while production package
  inclusion is blocked.
- ESDB/SCOWL v2 and Google Books Ngram American English 2019 were approved only
  as the policy-level source direction. The combined production asset has not
  been ingested.
- `@typai/core` remains local deterministic correction only and does not import
  `@typai/completion-remote`.
- Completion remains optional and mock provider behavior remains default.
- No browser-held private provider credential path, local model inference,
  next-edit logging, real Codex adapter, valid-word autocorrect,
  protected-token writes, or arbitrary delete-index autocorrect is introduced
  here.

## Source Verification Summary

### Dictionary

Source path: English Speller Database / SCOWL v2 generated Hunspell `en_US`
dictionary, release `2026.02.25`, tag `rel-2026.02.25`, commit marker
`7e99eda`.

- Official source URL: `https://wordlist.aspell.net/`.
- Official release asset:
  `https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip`.
- Official project owner: Kevin Atkinson / English Speller Database.
- Exact source file: `hunspell-en_US-2026.02.25.zip`.
- Expanded source files expected: `en_US.aff`, `en_US.dic`,
  `README_en_US.txt`.
- SHA-256: `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.
- Source size: 187,271 bytes.
- Expected source entry count: `en_US.dic` header count 47,551 before
  Hunspell flag handling.
- License: ESDB/SCOWL notice license plus the relevant Hunspell affix-file
  notice if affix-derived material is used.
- Redistribution: source license appears compatible with transformed npm
  redistribution only when the applicable notices are preserved.
- Raw source policy: external only; never commit raw source zips or unpacked
  `.aff` / `.dic` files into this repository.

Decision: approved as the dictionary source path, but not approved as a bundled
generated production asset.

### Frequency

Source path: Google Books Ngram Viewer American English 2019 1-grams,
`googlebooks-eng-us-20200217`.

- Official source URL: `https://books.google.com/ngrams/info`.
- Official export index:
  `https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html`.
- Exact corpus/version: American English 2019, export date path `20200217`.
- Exact source files: `totalcounts-1` plus `1-00000-of-00014.gz` through
  `1-00013-of-00014.gz`.
- License: Creative Commons Attribution 3.0 Unported.
- Attribution: package-visible Google Books Ngram Viewer source, corpus,
  license, and change notice required before package inclusion.
- Source size observed by HEAD metadata: 8,223,758,203 bytes total compressed
  source bytes including `totalcounts-1`.
- `totalcounts-1` SHA-256:
  `6ce99984774743b7142e2f7e95fc33bd676ea4485038081881e61e4456804d8a`.
- Missing SHA-256 values: all 14 gzip source partitions.
- Raw source policy: external only; never commit raw Ngram partitions.

Decision: license/source direction remains acceptable, but production asset
ingestion is blocked because the complete source-hash gate is not satisfied.

## Blocked Source Path

The combined production dictionary/frequency asset is blocked. The blocker is
not the ESDB dictionary hash; that hash is pinned. The blocker is the full
asset gate:

- Google Ngram partition SHA-256 values are missing.
- No generated output hash exists.
- No generated word count or byte size exists.
- No quality gate has run against a generated production asset.
- No final package-visible license/attribution bundle exists.
- No package dry-run proves the generated asset inclusion/exclusion behavior.
- No final approval signoff exists.

## Production Asset Gates

Production generation can run only when
`packages/core/assets/production/MANIFEST.json` has
`review.status: "approved"`.

Package inclusion can happen only when:

- source hashes are present for every raw input
- source hashes are checked before transform
- generated output hash is recorded
- generated output word count and byte size are recorded
- license and attribution files are package-visible
- package inclusion is not `blocked`
- raw source files are absent from Git and tarballs
- `pnpm bench:spell-quality`, package smoke, secret scan, docs, tests, build,
  lint, and dry pack pass

The current manifest keeps `review.status: "blocked"` and
`output.packageInclusion: "blocked"`.

## Package Inclusion Constraints

- Raw ESDB/SCOWL zips, Hunspell files, and Google Ngram files are never packed.
- Generated production output cannot be packed while review status is blocked.
- `@typai/core` must not include `assets/` through package `files` until a
  separate approved package-inclusion prompt changes that decision.
- Host-provided dictionary bytes remain the supported production fallback.
- If generated output exceeds the size budget, use host-provided assets or a
  separate optional language package instead of bundling in `@typai/core`.

## Next Implementation Prompts

1. Capture Google Ngram partition SHA-256 values in an external disposable
   workspace with explicit disk budget, without committing raw inputs.
2. Add final package-visible license and attribution notices and re-review the
   manifest.
3. Only after `review.status` becomes `approved`, run the deterministic
   transform, record output hash/count/size, and execute quality/package gates.

The final audit did not change the asset state. It verified that the blocked
manifest, transform, runtime loading, package, quality, E2E, and performance
gates pass without generating or bundling a production asset.

## Preserved Non-Goals

- No production asset generation.
- No raw source commit.
- No production dictionary binary commit.
- No C++/Rust/Wasm behavior change.
- No autocorrect rule change.
- No npm publish.
- No Codex adapter.
- No grammar/style layer.
- No local inference.
- No next-edit logging.
- No browser-held private provider credential path.
- No real provider calls.
