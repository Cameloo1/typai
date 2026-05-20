# Production Language Asset + Beta Release Candidate

Status date: 2026-05-19.

Completion status: started. This phase prepares Typai for a production language
asset release candidate and public beta candidate without publishing to npm.

## Current Foundation State

The Intelligence Quality Foundation is complete. Typai currently has:

- local deterministic correction in `@typai/core`
- optional remote completion in `@typai/completion-remote`
- contenteditable, textarea, React, and CodeMirror surfaces
- safe expanded common-typo autocorrect gates
- delete-index candidate suggestions
- cross-surface spell-quality coverage
- quality benchmark gates for protected-token writes, valid-word safety,
  autocorrect precision, suggestion recall, and direct core latency
- scaled mock and host-provided asset loading paths
- expanded Prompt 112 spell-quality corpus for common typos,
  suggestions-only misspellings, valid-word traps, protected technical tokens,
  acronyms, proper nouns, domain terms, and completion coexistence
- cross-surface E2E parity across contenteditable, textarea, React textarea,
  React contenteditable, and CodeMirror for the production/host-provided asset
  path boundaries
- a deterministic production dictionary transform entrypoint that currently
  runs only against repo-local fixtures while production approval is blocked
- manual/env-gated real-provider demo support through a secure proxy

The current implementation does not bundle a production dictionary or frequency
asset. The scaled mock asset remains a loader and performance stress fixture,
not language coverage.

## What Remains Blocked

Production asset ingestion remains blocked until the asset PR proves:

- exact upstream source pins and retrieval dates
- raw input SHA-256 hashes
- pinned local source file paths for every production input
- generated output SHA-256 hashes
- full license and redistribution evidence
- package-visible attribution
- deterministic transform commands
- manifest counts, sizes, and package-inclusion decision
- package-size and performance evidence
- spell quality and false-positive evidence against the generated asset
- named review signoff

No generated production dictionary, frequency table, raw corpus, or derived
asset may be committed, packed, published, or claimed as shipped until those
gates pass.

The Prompt 110 transform pipeline exists at
`packages/core/scripts/build-production-dictionary.mjs`. In the current blocked
state, `pnpm --filter @typai/core build:dictionary:production` fails before
processing and `pnpm --filter @typai/core validate:dictionary:production`
validates the fixture/mock path only.

Prompt 111 keeps package inclusion as **excluded from `@typai/core` and
host-provided only** while production approval is blocked. The package does not
include `packages/core/assets/production/`, raw source files, generated
production binaries, or generated frequency tables. `dictionary.mode:
"production"` is reserved for a future approved asset and currently throws a
clear unavailable error during `createTypaiCore()` initialization.

## Phase Scope

This phase covers:

- production dictionary and frequency source pinning
- asset manifest and attribution files
- deterministic transform pipeline
- production asset generation or explicit continued blocked-state docs
- C++/Rust/Wasm loading with the production asset after gates pass
- package inclusion policy for `none`, `optional`, or `bundled`
- cross-surface spell quality expansion
- package-size, memory, and performance gates
- public beta RC docs and version plan
- final production asset and beta RC hardening audit

## Non-Goals

- no npm publish
- no real Codex adapter
- no grammar, style, tone, or clarity engine
- no local model inference
- no next-edit logging
- no browser extension
- no ProseMirror or Monaco implementation
- no valid-word autocorrect
- no real-word or context autocorrect
- no arbitrary delete-index or SymSpell autocorrect
- no unclear-license asset bundling
- no browser-held provider credential path
- no real provider calls in tests, demos, E2E, smoke, or CI
- no weakening of current safety gates

## Hard Boundaries

- `@typai/core` remains local deterministic correction only.
- `@typai/core` must not import `@typai/completion-remote`.
- Completion remains optional.
- Mock provider behavior remains default.
- Valid words are never autocorrected.
- Protected tokens are never autocorrected.
- Delete-index candidates remain suggestions-only unless explicitly listed in
  the approved common typo table.
- Blue marks mean Typai changed text through correction.
- Accepted completions are not blue correction marks.
- Static language assets stay separate from personal, user, and project
  dictionary memory.
- Dictionary assets load only during `createTypaiCore()` initialization. Token
  checking and suggestions stay synchronous after initialization.
- A production asset cannot be bundled unless license, redistribution,
  attribution, manifest, source hash, transform, size, quality, and review
  gates pass.

## Asset Approval Gates

Every production dictionary, frequency, or combined asset must include:

- official source URL for every input
- exact source version, corpus identifier, release tag, commit, or durable pin
- retrieval date and SHA-256 for every raw source file
- full license or durable official notice link
- explicit redistribution, commercial-use, and modification evidence
- package-ready attribution text and any required notice file
- deterministic transform script and command
- generated output format and SHA-256
- word count, frequency row count, compressed size, and uncompressed size
- package inclusion policy: `none`, `optional`, or `bundled`
- update and rollback process
- reviewer, review date, and review status

If any gate is missing, unclear, or contradictory, package inclusion remains
`none`.

## Implementation Sequence

1. Preserve the current correction and completion boundaries before touching
   asset code.
2. Refresh the production asset recap and gate-status check.
3. Reconfirm the approved ESDB/SCOWL and Google Books Ngram source pins before
   any generated output is promoted.
4. Use the deterministic transform pipeline to process only approved pinned
   local inputs. While blocked, keep the fixture transform as the only runnable
   path.
5. Emit manifest and attribution artifacts for review before package inclusion.
6. Load the generated asset through the existing C++/Rust/Wasm dictionary blob
   boundary and keep malformed-load recovery intact.
7. Decide package inclusion using measured compressed and uncompressed size.
   Current blocked-state decision is `none`: do not include assets in
   `@typai/core`; use host-provided assets only.
8. Keep the Prompt 112 spell-quality and false-positive corpora passing. When
   a generated production asset exists, re-run the same corpus against that
   asset before any package inclusion change.
9. Run package dry-run, smoke install, public beta smoke, docs, lint, test, and
   build gates.
10. Record the version plan and public beta RC docs without publishing.
11. Finish with a hardening audit covering asset provenance, package contents,
    quality behavior, completion boundaries, privacy, and release risk.

## Acceptance Gates

This phase cannot be called RC-ready until:

- production asset manifest and attribution exist, or blocked state is
  explicitly recorded
- generated production outputs are absent unless all approval gates pass
- raw upstream corpus files are absent from Git and package tarballs
- `@typai/core` still has no dependency on `@typai/completion-remote`
- mock providers remain the automated default
- valid-word and protected-token autocorrections remain zero
- arbitrary delete-index candidates remain suggestions-only
- accepted completions do not create blue correction marks
- C++/Rust/Wasm asset loading passes malformed, duplicate, unsupported,
  protected-looking, and clear/reload tests
- package smoke proves asset inclusion matches the package policy
- docs describe only verified behavior
- no npm publish has occurred

## Package-Size And Performance Targets

Initial package-size targets:

- compressed package impact: <= 2 MiB
- uncompressed generated asset impact: <= 8 MiB
- raw Google Ngram inputs in Git/package tarballs: 0 bytes

Initial performance targets:

- direct core token p95 warning threshold: 20 ms
- direct core token p95 failure threshold: 100 ms
- protected-token writes: 0
- valid-word autocorrections: 0
- autocorrect precision: at least 99% on the committed corpus
- suggestion recall: warn below 90%
- browser correction and completion smoke thresholds do not regress from the
  current benchmark gates

Memory evidence must include inspectable dictionary word count, delete-index
entry count, generated asset byte size, and package dry-run contents.

## RC Readiness Definition

The beta release candidate is ready only when:

- source, license, transform, attribution, manifest, size, quality, and review
  gates are either passed or explicitly blocked
- package inclusion policy is recorded and verified by dry-run contents
- all requested verification commands pass locally
- public docs distinguish mock, host-provided, optional, and bundled asset
  states without overclaiming
- release/version docs identify the next publish step but do not publish
- the final hardening audit confirms preserved correction/completion/privacy
  boundaries
