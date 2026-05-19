# Dictionary Asset Blockers

Status date: 2026-05-19

Prompt 100 approves the source path for the first production dictionary and
frequency pipeline:

- Dictionary source: English Speller Database / SCOWL v2, official
  non-Australian `en-US` size 60 output, release `2026.02.25` / `[7e99eda]`.
- Frequency source: Google Books Ngram Viewer American English 2019 unigrams,
  persistent corpus identifier `googlebooks-eng-us-20200217`.

No production asset is bundled in this checkpoint. The only runtime dictionary
asset in the repository remains the generated mock fixture:

- `packages/core/assets/mock-en-us.dictionary.bin`
- `packages/core/assets/mock-en-us.dictionary.json`

Use `pnpm --filter @typai/core generate:mock-dictionary` to regenerate the mock
fixture.

## Remaining Blockers

### Production Manifest Missing

- Source affected: ESDB/SCOWL and Google Books Ngram.
- Evidence needed: `docs/asset-manifests/*.json` entry with required source,
  license, transform, count, size, hash, package-inclusion, and review fields.
- Owner/action: Prompt 101 or later asset-pipeline implementer.
- Can pipeline proceed with scaled mock or host-provided asset? Yes. Loader and
  manifest validation work can proceed without committing a production asset.

### Deterministic Transform Script Missing

- Source affected: ESDB/SCOWL and Google Books Ngram.
- Evidence needed: checked-in script that fetches or reads pinned inputs,
  normalizes them deterministically, intersects frequency with accepted
  dictionary words, and emits Typai Dictionary Blob v1 plus manifest.
- Owner/action: Prompt 101 pipeline work.
- Can pipeline proceed with scaled mock or host-provided asset? Yes. Prompt 101
  should harden the loader and host-provided path first.

### Raw Source Hashes Not Captured

- Source affected: ESDB/SCOWL release files and Google Ngram 1-gram source
  files.
- Evidence needed: SHA-256 for each raw input and generated output.
- Owner/action: asset-pipeline PR.
- Can pipeline proceed with scaled mock or host-provided asset? Yes.

### Attribution File Not Committed

- Source affected: ESDB/SCOWL and Google Books Ngram.
- Evidence needed: package-visible attribution text with ESDB notice, source
  URLs, Google Ngram acknowledgement, and corpus identifier.
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
