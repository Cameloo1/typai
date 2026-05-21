# Production Asset Blocker Closure Attempt

Status date: 2026-05-21.

Outcome: **blocked / parked host-provided-only**.

Prompt 142 attempted to close the production language asset blockers without
generating or bundling a production asset. The attempt did not have the external
source evidence required to move the manifest to approved generation.

Prompt 143 may not generate the production asset from the current repo state.
It must continue to enforce host-provided-only behavior unless a future prompt
provides pinned external source paths, complete raw source hashes, final
notices, and review signoff.

## Gate Evidence

The current gates pass only because the manifest remains blocked and no
production output exists:

- `pnpm dictionary:check-production`: passed blocked-state validation.
- `pnpm dictionary:gate-status`: passed; frequency source has 1 of 15 source
  hashes pinned.
- `pnpm --filter @typai/core validate:dictionary:production`: passed blocked
  state and fixture validation.

The validation command reported these required inputs before a production build
can run:

- pinned local file path for the dictionary source archive
- pinned local file path for `totalcounts-1`
- pinned local file path and SHA-256 for each of the 14 Google Ngram gzip
  partitions
- aggregate/source-set SHA-256 for the frequency source set
- `review.status: "approved"`
- deterministic generated output hash, word count, and byte size
- quality and package-size evidence

## Source Path Check

No approved source paths were available in this attempt:

- the process environment had no `TYPAI`, `NGRAM`, `SCOWL`, or `DICTIONARY`
  source path variables
- no local dictionary/source/asset config file was present at the repo root
- the only root `.env`-style file was `.env.openai.local`; it is provider
  smoke configuration, ignored by Git, and was not read for this asset prompt
- manifest source entries do not contain `localPath`, `path`, or `file`
- raw source files are not present under
  `packages/core/assets/production/`
- generated fixture and scaled-mock files exist only under ignored generated
  asset paths and are not production sources

Raw production inputs therefore remain external-only and unstaged.

## Blocker Checklist

| Blocker | Status | Evidence | Action required |
| --- | --- | --- | --- |
| 14 Google Ngram gzip partition SHA-256 hashes | unresolved | manifest entries `1-00000-of-00014.gz` through `1-00013-of-00014.gz` still have empty `sha256` fields | stage the official gzip files externally, compute SHA-256, and record each hash only after provenance is trusted |
| External pinned local source paths | unresolved | manifest has no `localPath`, `path`, or `file` for dictionary or frequency sources | provide external paths outside the repo for every approved source file |
| ESDB/SCOWL dictionary source hash | partially resolved | manifest pins `hunspell-en_US-2026.02.25.zip` SHA-256, but no local archive path was provided for recomputation | provide the external archive path and verify the pinned hash before generation |
| Google `totalcounts-1` source hash | partially resolved | manifest pins `totalcounts-1` SHA-256, but no local file path was provided for recomputation | provide the external file path and verify the pinned hash before generation |
| Frequency aggregate/source-set hash | unresolved | manifest `frequency.sha256` remains empty | record the deterministic aggregate/source-set hash after every raw file hash is present |
| Generated production output hash | unresolved | manifest `output.sha256` remains empty | run the deterministic transform only after source gates pass |
| Generated word count and byte size | unresolved | manifest `output.wordCount` and `output.byteSize` remain `null` | record generated metadata only after approved generation |
| Final package-visible license notices | unresolved | `packages/core/assets/production/LICENSES/README.md` is still a blocked-state placeholder | replace placeholders with final package-visible notices only after review approval |
| Final package-visible attribution | unresolved | `packages/core/assets/production/ATTRIBUTION.md` is still a blocked-state placeholder | finalize exact attribution text before package inclusion |
| Spell-quality evidence against generated asset | unresolved | no generated production asset exists | run `pnpm bench:spell-quality` against the generated asset after approved generation |
| Package dry-run proof for included asset | unresolved | package inclusion is still `blocked` | prove tarball contents only after package inclusion policy changes |
| Final review signoff | unresolved | manifest `review.status` remains `blocked` | manual release operator must approve after every source, license, hash, quality, and package gate passes |

## Source Hash Status

Dictionary:

- `hunspell-en_US-2026.02.25.zip`
- pinned SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`
- byte size from manifest: 187,271 bytes
- recomputation status: not run because no external local file path was
  provided

Frequency:

- `totalcounts-1`
- pinned SHA-256:
  `6ce99984774743b7142e2f7e95fc33bd676ea4485038081881e61e4456804d8a`
- byte size from manifest: 11,516 bytes
- recomputation status: not run because no external local file path was
  provided
- gzip partitions: 14 unresolved hashes, 14 missing external paths
- aggregate/source-set SHA-256: missing

## License And Attribution Status

The source direction remains documented, but package-visible notices are not
final:

- ESDB/SCOWL notice requirements are recorded.
- Hunspell affix-file notice requirements are recorded if affix-derived
  material is used.
- Google Books Ngram Viewer CC BY 3.0 attribution requirements are recorded.
- `LICENSES/README.md` and `ATTRIBUTION.md` are blocked-state placeholders, not
  final approval files for a bundled generated asset.

## Final Review Status

Manifest status remains `blocked`.

Package inclusion remains `blocked`.

`dictionary.mode: "production"` must remain unavailable from package builds.

## App Continuation

App work can continue safely because:

- host-provided Typai Dictionary Blob v1 bytes remain the production-scale
  fallback path
- scaled mock remains test-only
- the built-in correction path remains tiny and deterministic
- no production raw sources or generated production asset are committed or
  bundled
- no unclear-license language asset entered the package

The production asset lane is parked until a future prompt provides complete
external source evidence and review approval.
