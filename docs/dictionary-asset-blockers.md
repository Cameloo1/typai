# Dictionary Asset Blockers

Status date: 2026-05-19

Prompt 109 verifies and pins the source path for the first production
dictionary and frequency pipeline:

- Dictionary source: English Speller Database / SCOWL v2 generated Hunspell
  `en_US` size 60 output, release `2026.02.25` / `[7e99eda]`.
- Dictionary source file:
  `https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip`.
- Dictionary source SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.
- Frequency source: Google Books Ngram Viewer American English 2019 1-grams,
  version `20200217`, path segment `eng-us`.
- Frequency source index:
  `https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html`.

No production asset is bundled in this checkpoint. The only runtime dictionary
asset in the repository remains the generated mock fixture:

- `packages/core/assets/mock-en-us.dictionary.bin`
- `packages/core/assets/mock-en-us.dictionary.json`

Use `pnpm --filter @typai/core generate:mock-dictionary` to regenerate the mock
fixture.

## Remaining Blockers

### Production Manifest Blocked

- Source affected: ESDB/SCOWL and Google Books Ngram.
- Evidence present: blocked template at
  `packages/core/assets/production/MANIFEST.template.json`.
- Evidence still needed: approved manifest with complete frequency source
  hashes, transform, generated output counts, generated output size, output
  hash, package-inclusion decision, and review signoff.
- Owner/action: production asset pipeline implementer.
- Can pipeline proceed with scaled mock or host-provided asset? Yes. Loader and
  manifest validation work can proceed without committing a production asset.

### Deterministic Transform Script Missing

- Source affected: ESDB/SCOWL and Google Books Ngram.
- Evidence needed: checked-in script that fetches or reads pinned inputs,
  verifies raw SHA-256 values, normalizes them deterministically, intersects
  frequency with accepted dictionary words, and emits Typai Dictionary Blob v1
  plus manifest.
- Owner/action: production asset pipeline work.
- Can pipeline proceed with scaled mock or host-provided asset? Yes. Prompt 101
  should harden the loader and host-provided path first.

### Frequency Raw Source Hashes Not Captured

- Source affected: Google Ngram `totalcounts-1` and `1-00000-of-00014.gz`
  through `1-00013-of-00014.gz`.
- Evidence present: exact frequency source URLs in
  `packages/core/assets/production/MANIFEST.template.json`.
- Evidence needed: SHA-256 for each raw frequency input and generated output.
- Owner/action: asset-pipeline PR.
- Can pipeline proceed with scaled mock or host-provided asset? Yes.

### Attribution File Placeholder Only

- Source affected: ESDB/SCOWL and Google Books Ngram.
- Evidence present: placeholder attribution at
  `packages/core/assets/production/ATTRIBUTION.md`.
- Evidence needed: final package-visible attribution text with full applicable
  ESDB/SCOWL notice, affix-file notice, source URLs, Google Ngram
  acknowledgement, CC BY 3.0 reference, and corpus/version identifier.
- Owner/action: asset-pipeline PR plus review signoff.
- Can pipeline proceed with scaled mock or host-provided asset? Yes.

### License Files Placeholder Only

- Source affected: ESDB/SCOWL Hunspell `en_US` and Google Books Ngram.
- Evidence present: placeholder license summary at
  `packages/core/assets/production/LICENSES/README.md`.
- Evidence needed: final package-visible full applicable notice text for
  ESDB/SCOWL, the Hunspell affix-file BSD-style notice, and Google Ngram CC BY
  3.0 attribution/license reference.
- Owner/action: asset-pipeline PR plus review signoff.
- Can pipeline proceed with scaled mock or host-provided asset? Yes.

### Package Size Budget Not Proven

- Source affected: generated production dictionary/frequency asset.
- Evidence needed: compressed and uncompressed byte sizes, package dry-run
  evidence, and package contents check proving raw source files are excluded.
- Owner/action: asset-pipeline PR.
- Can pipeline proceed with scaled mock or host-provided asset? Yes.

### Quality Gates Not Run Against Generated Asset

- Source affected: generated production dictionary/frequency asset.
- Evidence needed: protected-token writes = 0, valid-word autocorrections = 0,
  edit-distance/SymSpell autocorrects = 0 outside explicit common-typo gates,
  broad misspelling suggestion coverage, false-positive review, direct core p95,
  browser correction p95, and completion smoke thresholds.
- Owner/action: quality-gate prompts after pipeline generation.
- Can pipeline proceed with scaled mock or host-provided asset? Yes, but package
  inclusion cannot.

### Raw Corpus Inclusion Must Stay Blocked

- Source affected: Google Books Ngram.
- Evidence needed: package scan proving raw Ngram files are not committed or
  packed.
- Owner/action: asset-pipeline PR and release smoke.
- Can pipeline proceed with scaled mock or host-provided asset? Yes.

### Downstream Dictionary Sources Rejected

- Source affected: LibreOffice, OpenOffice, Mozilla dictionary packages.
- Evidence needed to revisit: exact file-level license, redistribution
  statement, and reason they are preferable to ESDB upstream.
- Owner/action: no action for Prompt 101.
- Can pipeline proceed with scaled mock or host-provided asset? Yes. These are
  not needed for the approved source path.

### wordfreq And Derived Dumps Blocked

- Source affected: `wordfreq`, `wordfreq-en-25000`, and derived convenience
  exports.
- Evidence needed to revisit: legal/product acceptance of CC BY-SA and
  source-specific attribution obligations for a transformed npm asset.
- Owner/action: no action for Prompt 101.
- Can pipeline proceed with scaled mock or host-provided asset? Yes. Google
  Ngram is the approved first frequency source.

## Current Safe Path

Prompt 101 should implement or harden:

- manifest validation
- deterministic transform scaffolding
- host-provided dictionary loading
- scaled mock asset generation for performance and loader tests
- package scans that exclude raw source files and generated production outputs

Prompt 101 should not commit generated production assets unless the manifest,
hash, attribution, size, quality, and review gates all pass.
