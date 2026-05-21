# Dictionary Asset Blockers

Status date: 2026-05-20.

Production language asset status: **blocked / host-provided only**.

Prompt 132 branch: **blocked-host-provided**. Production generation remains
closed; host-provided Typai Dictionary Blob v1 bytes remain the fallback.

The production manifest exists at
`packages/core/assets/production/MANIFEST.json`, but its review status remains
blocked. No production dictionary binary, frequency table, raw source file, or
generated production language blob is bundled.

## Blockers

### Production Manifest Blocked

- Source affected: ESDB/SCOWL dictionary and Google Books Ngram frequency.
- Blocker type: package policy.
- Evidence needed: manifest review status changed to `approved` only after all
  source hashes, generated output metadata, notices, size, quality, package,
  and review gates pass.
- Action required: keep `review.status: "blocked"` and
  `output.packageInclusion: "blocked"` until every downstream blocker is closed.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Google Ngram Partition Hashes Missing

- Source affected: Google Books Ngram American English 2019 1-grams.
- Blocker type: hash.
- Evidence needed: SHA-256 for `1-00000-of-00014.gz` through
  `1-00013-of-00014.gz`.
- Action required: fetch and hash the raw partitions in a disposable external
  workspace with explicit disk budget; do not commit the raw partitions.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Pinned Local Production Inputs Missing

- Source affected: ESDB/SCOWL dictionary archive and Google Books Ngram
  frequency files.
- Blocker type: hash.
- Evidence needed: external, pinned local paths for every production input that
  match the manifest SHA-256 values.
- Action required: stage raw source files in a disposable external workspace,
  update the manifest with local paths only for the approved generation run,
  and keep raw source files out of Git and package tarballs.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Generated Output Metadata Missing

- Source affected: combined production dictionary/frequency asset.
- Blocker type: hash.
- Evidence needed: generated output SHA-256, word count, byte size, transform
  command, and transform version.
- Action required: run the deterministic transform only after manifest review
  status is approved for generation.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Final License Bundle Missing

- Source affected: ESDB/SCOWL dictionary and Google Books Ngram frequency.
- Blocker type: license.
- Evidence needed: final package-visible notices for ESDB/SCOWL, any relevant
  Hunspell affix-file notice, Google Books Ngram Viewer attribution, CC BY 3.0
  link, and change notice.
- Action required: replace placeholders in
  `packages/core/assets/production/LICENSES/` only during the approval prompt.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Final Attribution Missing

- Source affected: ESDB/SCOWL dictionary and Google Books Ngram frequency.
- Blocker type: attribution.
- Evidence needed: exact attribution text that will be visible in the package
  shape that includes the generated asset.
- Action required: finalize `packages/core/assets/production/ATTRIBUTION.md`
  before package inclusion.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Quality Gate Not Run Against Production Asset

- Source affected: generated production dictionary/frequency asset.
- Blocker type: quality.
- Evidence needed: `pnpm bench:spell-quality` results against the generated
  asset with 0 protected-token writes, 0 valid-word autocorrections, 0 reviewed
  false-positive autocorrections, and passing correction/suggestion corpora.
- Action required: generate the asset only after source approval, then run and
  record quality evidence.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Package Inclusion Not Proven

- Source affected: generated production dictionary/frequency asset.
- Blocker type: size.
- Evidence needed: generated compressed/uncompressed sizes, core tarball size
  impact, dry-pack contents, install smoke, public-beta smoke, and secret scan.
- Action required: prove package contents exclude raw sources and include only
  the approved generated output if package inclusion changes from `blocked`.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

### Raw Source Policy

- Source affected: ESDB/SCOWL zip, Hunspell files, and Google Ngram partitions.
- Blocker type: package policy.
- Evidence needed: package dry-run and Git status showing raw source files are
  not committed or packed.
- Action required: keep raw sources external; use disposable workspaces for
  hashing and transform staging.
- Whether fallback remains host-provided-only: yes; fallback remains
  host-provided-only.

## Safe Work That Can Continue

- manifest validation
- gate-status reporting
- host-provided dictionary loading
- scaled mock and fixture validation
- deterministic fixture transform and dictionary inspection
- package scans that prove raw sources and generated production outputs are
  excluded

Host-provided assets must be loaded only during `createTypaiCore()`
initialization through `bytes`, `load`, or `url`. They must remain separate from
personal/project dictionary memory and must not weaken valid-word,
protected-token, or delete-index autocorrect gates.

No prompt should commit generated production assets unless the manifest, hash,
attribution, size, quality, package, and review gates all pass.
