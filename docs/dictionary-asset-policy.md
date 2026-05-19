# Dictionary Asset Policy

Production dictionary and frequency assets require explicit source, license,
manifest, and review approval before they can be bundled, transformed,
published, or distributed with Typai.

Prompt 100 approves a source path, not a generated asset. No production
dictionary or frequency binary is approved until the gates below pass in the
asset PR that introduces it.

## Required Approval Gates

Every production dictionary, frequency table, or combined asset must provide:

- Official source URL: canonical upstream URL for every input.
- Exact source version/hash: release tag, persistent corpus identifier, commit,
  retrieval date, and SHA-256 for every fetched raw source file.
- License file committed or linked: full license or notice text in a durable
  package/doc location, or a stable official license URL when the source does
  not publish a standalone file.
- Redistribution statement: explicit evidence that Typai may redistribute the
  raw or transformed data in its intended package shape.
- Commercial-use statement: explicit evidence that Typai may use the data in an
  npm package that can be used commercially.
- Modification statement: explicit evidence that deterministic filtering,
  normalization, and binary transformation are allowed.
- Attribution text: exact package-ready notice text, including source URLs and
  required copyright/license text.
- Deterministic transform script: checked-in script that fetches or reads pinned
  inputs and emits deterministic outputs from an empty cache.
- Manifest metadata: JSON manifest with source, license, transform, count, size,
  hash, package, and reviewer fields.
- Package inclusion policy: explicit decision for `none`, `optional`, or
  `bundled`.
- Size budget: compressed and uncompressed byte limits with measured output.
- Update process: repeatable steps for refreshing, reviewing, and comparing a
  new source version.
- Review signoff: named human/legal/product signoff recorded in the manifest or
  associated stable review document.

If any gate is missing or unclear, asset ingestion is blocked.

## Manifest Schema

Future manifests should live under `docs/asset-manifests/` until an asset is
approved for package inclusion. A production asset manifest must contain these
fields:

```json
{
  "schemaVersion": 1,
  "assetKind": "dictionary",
  "language": "en-US",
  "sourceName": "English Speller Database / SCOWL",
  "officialSourceUrl": "https://wordlist.aspell.net/",
  "sourceVersion": "2026.02.25",
  "sourceHash": "sha256-or-release-commit",
  "retrievedAt": "2026-05-19",
  "licenseName": "ESDB notice license",
  "licenseUrl": "https://github.com/en-wl/wordlist/blob/v2/Copyright",
  "redistributionAllowed": true,
  "commercialUseAllowed": true,
  "modificationAllowed": true,
  "attributionRequired": true,
  "attributionText": "Package-ready attribution text.",
  "transformScript": "scripts/build-production-dictionary.mjs",
  "outputFormat": "Typai Dictionary Blob v1",
  "wordCount": 0,
  "byteSize": 0,
  "sha256": "generated-output-sha256",
  "reviewStatus": "approved",
  "reviewedBy": "reviewer-name",
  "reviewedAt": "2026-05-19",
  "packageInclusion": "optional"
}
```

For combined assets, use `assetKind: "combined"` and include `sources` entries
with the same source/license fields for each input.

## Approved Source Defaults

The approved Prompt 100 source defaults are:

- Dictionary: English Speller Database / SCOWL v2, official non-Australian
  `en-US` size 60 wordlist, release `2026.02.25` / `[7e99eda]`.
- Frequency: Google Books Ngram Viewer American English 2019 unigrams,
  persistent corpus identifier `googlebooks-eng-us-20200217`.

These defaults do not approve a committed binary. They only define the sources a
future pipeline may target.

## Package Inclusion Policy

Default package inclusion is `none` until a production asset PR proves:

- generated output size stays within budget
- attribution is included in package-visible files
- package smoke proves the asset is present only where intended
- generated raw inputs stay out of package tarballs
- no provider, model, network, or telemetry behavior is added to `@typai/core`

Initial budget target:

- compressed package impact: <= 2 MiB
- uncompressed generated asset impact: <= 8 MiB

If the generated asset exceeds that budget, use an optional asset package or a
host-provided asset path instead of bundling it in `@typai/core`.

## Update Process

1. Open a source-review PR that updates `docs/dictionary-source-selection.md`
   and `docs/dictionary-production-approval.md`.
2. Pin official source URLs, release identifiers, retrieval dates, and raw input
   hashes.
3. Run the deterministic transform script from an empty cache.
4. Commit or attach the manifest and license/attribution files.
5. Run loader tests, package smoke, docs checks, and spell quality gates.
6. Review false-positive and valid-word behavior before package inclusion.
7. Record review signoff before generated production output is packaged.

## Mock And Host-Provided Assets

`packages/core/assets/mock-en-us.dictionary.bin` and its JSON companion are
generated fixtures only. They are not production dictionary or frequency
assets, and they do not represent a source/license decision.

A host-provided asset path may be implemented before production bundling if it
keeps provenance outside the package and still validates manifests before
loading. Host-provided assets must not weaken protected-token, valid-word, or
autocorrect gates.

## Current Status

See `docs/dictionary-source-selection.md` for source evidence,
`docs/dictionary-production-approval.md` for the current approval decision, and
`docs/dictionary-asset-blockers.md` for remaining ingestion blockers.
