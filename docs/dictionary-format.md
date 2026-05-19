# Typai Dictionary Blob v1

Typai Dictionary Blob v1 is the compact dictionary/frequency fixture format for
Public Alpha Readiness loader work.

## Purpose

- TypeScript can fetch or read dictionary assets asynchronously.
- TypeScript passes compact binary data into Rust/Wasm.
- Rust passes a pointer and length to C++.
- C++ ingests the blob into internal dictionary, trie, and delete-index
  structures during initialization.

This format is for proving runtime loading architecture first. The current
checked-in asset is a generated mock fixture, not a production dictionary.
Prompt 101 also adds an ignored scaled mock generator for loader stress tests.

## Constraints

- No JavaScript string arrays cross the typing hot path.
- No full document text is passed into C++.
- No C++ memory is returned to JavaScript or Rust for them to free.
- C++ uses fixed internal storage during dictionary initialization and does not
  expose ownership across FFI.
- Do not use raw `new`, `malloc`, or `free` in the loader or delete-index FFI
  path.
- Frequency scores rank suggestions only.
- Frequency scores must not expand autocorrect triggers. Prompt 103
  autocorrection can only come from the audited common-typo table or user
  always-correct rules.

## Encoding

- Encoding is UTF-8.
- Words are lowercase ASCII alphabetic tokens in v1.
- Initial language is English `en-US` only.
- Initial mock data is ASCII-first.
- Integers are little-endian.

## Binary Layout

Header:

| Field | Type | Notes |
| --- | --- | --- |
| `magic` | 8 bytes | ASCII `TYPAIDIC` |
| `version` | `uint32` | Current value: `1` |
| `language_byte_len` | `uint16` | Byte length of the language code |
| `reserved` | `uint16` | Must be `0` |
| `word_count` | `uint32` | Number of entries |
| `string_table_byte_len` | `uint32` | Byte length of the concatenated word table |

Entries follow the header. Each entry is 14 bytes:

| Field | Type | Notes |
| --- | --- | --- |
| `word_offset` | `uint32` | Offset into the string table |
| `word_len` | `uint16` | Word byte length |
| `frequency` | `uint32` | Higher means more common |
| `flags` | `uint32` | Format-specific flags |

Payload:

1. String table: concatenated UTF-8 word bytes.
2. Language code: UTF-8 language code bytes.

## Frequency

- Higher integer frequency means the word is more common.
- Frequency is deterministic and used for stable suggestion ordering.
- Frequency must not be used to create new autocorrection triggers during Public
  Alpha Readiness.

## Delete-Index Suggestions

Prompt 102 adds a deterministic C++ delete index for suggestion candidate
generation. The index is built from the loaded dictionary asset and the tiny
built-in fallback word list. It is cleared and rebuilt with dictionary state,
and malformed dictionary blobs do not replace the existing loaded dictionary or
delete index.

Current delete-index limits:

- max edit distance: 2
- max indexed word length: 32 lowercase ASCII letters
- output still uses caller-owned suggestion and score buffers
- exposed stats are primitive counts and byte estimates only

The delete index improves suggestion recall and latency. It is not an
autocorrect source by itself. Prompt 103 can autocorrect a misspelling that is
also discoverable through the delete index only when that typo is explicitly
listed in `docs/common-typo-table.md`.

## Suggestion Ranking And Scores

When a runtime dictionary is loaded, C++ uses the delete index to find candidate
word IDs, verifies actual bounded Levenshtein distance, and ranks suggestions
by:

1. Lower edit distance.
2. Higher loaded or built-in frequency.
3. Alphabetical order for deterministic ties.

Returned suggestion scores are deterministic ranking signals, not autocorrect
confidence. The current score formula is:

```text
score = ((max_edit_distance + 1 - edit_distance) * 2)
      + (min(frequency, 1_000_000) / 1_000_000)
```

The distance component preserves edit-distance priority. The capped frequency
component ranks same-distance candidates. Scores must not be used to
auto-correct delete-index candidates.

Prompt 103 reason codes distinguish ranking and gates:

- `DELETE_INDEX_CANDIDATE` means a suggestion came through the delete-index
  candidate path.
- `FREQUENCY_RANKED` means frequency participated in suggestion ordering.
- `AUTOCORRECT_GATE_BLOCKED` means a non-word stayed a red unresolved spelling
  issue.
- `AUTOCORRECT_GATE_PASSED` means an explicit common-typo or user rule allowed
  a blue correction.

## Validation

Loaders must validate:

- Magic equals `TYPAIDIC`.
- Version is supported exactly.
- Reserved field is zero.
- Header, entry table, string table, and language code bounds are valid.
- Language is exactly `en-US` for v1.
- Entry word offsets and lengths stay inside the string table.
- Words are non-empty.
- Words are lowercase ASCII alphabetic tokens.
- UTF-8 is valid.
- Duplicate words are rejected.
- Sorted words are recommended for deterministic builds, but the format does not
  require sorted order.

Invalid UTF-8 rejects the blob. The Prompt 101 C++ loader also rejects
unsupported languages, protected-looking words, and duplicate entries without
replacing the previously loaded dictionary.

## Versioning

Future format versions must be rejected or handled explicitly. A loader must not
silently accept an unknown version.

## Mock Asset

The checked-in tiny mock asset lives at:

- `packages/core/assets/mock-en-us.dictionary.bin`
- `packages/core/assets/mock-en-us.dictionary.json`

Generate it with:

```sh
pnpm --filter @typai/core generate:mock-dictionary
```

The mock contains a tiny fixed word/frequency list for tests. It is not a real
dictionary, not a production corpus, and not a licensing decision.

## Scaled Mock Asset

Prompt 101 adds a generated scaled mock path for loader, benchmark, and
host-provided asset tests. It writes ignored local files under:

- `packages/core/assets/generated/scaled-mock-en-us.dictionary.bin`
- `packages/core/assets/generated/scaled-mock-en-us.dictionary.meta.json`

Generate it with:

```sh
pnpm --filter @typai/core build:dictionary
```

Validate it with:

```sh
pnpm --filter @typai/core validate:dictionary
```

The scaled mock defaults to 3,600 deterministic lowercase words and synthetic
frequency scores. Its metadata is explicitly `mockOnly: true` and
`production: false`. It is ignored by Git and must not be treated as a
production dictionary or frequency asset.

## Host-Provided Loading

Host applications may provide dictionary bytes at initialization through the
existing `createTypaiCore({ dictionary })` option:

- `dictionary.bytes`
- `dictionary.load`
- `dictionary.url`

The bytes still have to pass Typai Dictionary Blob v1 validation. Host-provided
assets are separate from user/personal dictionaries and must not loosen
protected-token, valid-word, or autocorrect gates.

Runtime stats are available through `@typai/core`:

- `getLoadedDictionaryWordCount()`
- `getDeleteIndexEntryCount()`
- `getDeleteIndexMemoryEstimateBytes()`
