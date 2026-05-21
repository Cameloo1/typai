# Production Asset Transform Design

Phase name: Production Asset Unblock.

Status date: 2026-05-20.

Status: deterministic transform pipeline implemented and validated through
repo-local fixtures. Production asset generation remains blocked by
`packages/core/assets/production/MANIFEST.json`.

## Inputs

Production mode reads only pinned local source files named by the production
manifest. The current intended source path remains:

- Dictionary: ESDB/SCOWL v2 generated Hunspell `en_US`, release
  `2026.02.25`, archive SHA-256 pinned in the manifest.
- Frequency: Google Books Ngram Viewer American English 2019 unigrams,
  `googlebooks-eng-us-20200217`, with `totalcounts-1` pinned and the 14 gzip
  partition hashes still missing.

Fixture mode reads:

- `packages/core/assets/fixtures/production-transform/dictionary.fixture.txt`
- `packages/core/assets/fixtures/production-transform/frequency.fixture.tsv`
- `packages/core/assets/fixtures/production-transform/MANIFEST.fixture.json`

Fixture output is ignored under `packages/core/assets/generated/`.

## Manifest Gate

`pnpm --filter @typai/core build:dictionary:production` reads
`packages/core/assets/production/MANIFEST.json` by default and fails before
processing unless `review.status` is `approved`.

Production mode also requires:

- `dictionary.redistribution` and `frequency.redistribution` set to `approved`
- every source file has a pinned local path and SHA-256
- source-set hashes are present
- package-visible license and attribution files exist
- `transform.networkFetchAllowed` is `false`
- `output.packageInclusion` is not `blocked`

Blocked mode is a valid validation result only when no production output path,
word count, byte size, or output hash is claimed and blockers are documented.

## Source Hash Validation

The transform computes SHA-256 from the local file bytes before parsing any
source. Large gzip frequency sources are hashed and parsed with streams. A hash
mismatch stops the run before dictionary or frequency rows are accepted.

No network call happens in the default path. There is no silent download mode.
A future explicit fetch mode would need an environment approval gate, official
manifest URL matching, post-fetch SHA-256 verification, and external raw-source
staging.

## Dictionary Parser

The dictionary parser accepts plain text `.dic`-style files and ZIP archives
containing selected `.dic` entries. ZIP parsing is local and deterministic; it
supports stored and deflated entries and rejects malformed archives.

For Hunspell-style dictionary rows, the first row count is skipped when present
and simple affix suffixes such as `word/AB` are stripped before normalization.
Affix expansion is not implemented in this prompt.

## Frequency Parser

The frequency parser accepts fixture TSV rows and Google Books Ngram 1-gram
rows. `totalcounts-1` is verified as source metadata but is not parsed as a
word-frequency table. Gzip partitions are streamed line by line.

Rows with too few fields or invalid counts are skipped with explicit excluded
counts. Valid frequency rows that are absent from the accepted dictionary are
counted and not emitted.

## Normalization Policy

- trim whitespace
- screen protected-looking tokens before lowercasing
- strip simple Hunspell flags in dictionary mode
- use Unicode NFKC normalization before ASCII validation
- lowercase with `en-US` locale
- allow only ASCII `a-z`
- minimum length: 1
- maximum length: 32
- apostrophes are excluded
- hyphens are excluded as protected-looking hyphenated tokens
- trailing sentence punctuation is excluded, not stripped
- URLs, emails, paths, identifiers, numeric tokens, and camelCase/snake_case
  tokens are excluded
- no casing metadata is emitted in Blob v1

Uppercase and title-case alphabetic source words normalize to lowercase.
Acronyms normalize to lowercase if they otherwise pass the policy.

## Deduplication And Frequency Merge

Dictionary duplicates are resolved deterministically by keeping the first
accepted normalized word from source order and counting later duplicates as
excluded. Frequency duplicates are summed as unsigned integer counts and then
clamped to Blob v1 `uint32`.

Missing frequencies default to `0`. Frequency-only words are counted as
excluded and are not emitted.

## Output Sorting And Format

Accepted words are sorted by ASCII lexicographic order before encoding. The
output target is Typai Dictionary Blob v1:

- lowercase ASCII words
- `en-US`
- uint32 frequency
- flags set to `0` by this transform

Blob v1 is sufficient for Prompt 131 because the transform emits only lowercase
ASCII words and compact integer frequencies. No Blob v2 is introduced.

## Metadata And Hash Strategy

Generated metadata records:

- schema version
- language
- dictionary and frequency source hashes
- manifest hash
- transform script version and SHA-256
- generated timestamp
- word count
- byte size
- output SHA-256
- excluded counts by reason
- frequency coverage percentage
- package inclusion policy
- attribution reference

Fixture builds use a fixed timestamp by default and perform a second build in a
temporary directory to prove the binary SHA-256 is deterministic.

## Modes

Fixture mode:

```sh
pnpm --filter @typai/core build:dictionary:fixture
```

Production mode:

```sh
pnpm --filter @typai/core build:dictionary:production
```

Validation and inspection:

```sh
pnpm --filter @typai/core validate:dictionary:production
pnpm --filter @typai/core inspect:dictionary
```

When the production manifest remains blocked, validation runs the fixture
pipeline and prints the missing production gates.

## Raw Source Policy

Raw ESDB/SCOWL, Hunspell, Google Ngram, TSV, ZIP, and gzip production sources
stay external. The transform refuses raw production source staging under
`packages/core/assets/production/`. Generated fixture files stay under the
ignored generated asset directory.

Static language assets remain separate from user, personal, and project
dictionary memory.
