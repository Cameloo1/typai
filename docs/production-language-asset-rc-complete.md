# Production Language Asset + Public Beta RC Complete

Status date: 2026-05-19.

Completion status: complete for a blocked-production-asset public beta release
candidate. No npm publish occurred.

## What Was Added

Prompts 108 through 114 completed the Production Language Asset + Public Beta
RC checkpoint:

- phase scope and asset gate recap docs
- source pinning and manifest placeholder structure
- deterministic production transform pipeline in gated fixture mode
- host-provided production-asset loading policy
- production-RC spell-quality corpus and cross-surface E2E
- language asset benchmark and package size report
- CI/release gates for language asset and package size checks
- public beta release candidate plan
- changelog draft
- final source/license, engine/FFI, correction, surface, completion, package,
  and release dry-run audit

## Dictionary And Asset Status

Dictionary source path status: approved as a candidate source path.

Frequency source path status: approved as a candidate source path.

Asset ingestion status: blocked.

Package inclusion status: host-provided only.

The ESDB/SCOWL dictionary path and Google Books Ngram American English 2019
path are documented in `docs/dictionary-production-approval.md`, but production
asset ingestion remains blocked because Google Ngram raw file hashes, pinned
local source file paths, generated output hash, generated size, quality run
against generated output, and final review signoff are still missing.

No generated production dictionary binary, generated frequency table, raw
dictionary source, or raw frequency source is bundled. The scaled mock asset is
mock-only and generated under ignored paths.

## Transform Pipeline Status

The deterministic transform entrypoint exists at
`packages/core/scripts/build-production-dictionary.mjs`.

Current behavior:

- production build fails while manifest review status is blocked
- validation passes in fixture/mock mode
- no network fetch happens by default
- source hashes are required before production processing
- protected-looking URL, email, path, identifier, numeric, hyphenated, and
  non-alpha tokens are excluded
- output uses Typai Dictionary Blob v1 when generation is allowed

## Package Inclusion Status

`@typai/core` currently packs:

- `dist`
- generated Wasm `pkg`
- package metadata
- `README.md`

`@typai/core` currently excludes:

- `assets/`
- production manifest/license placeholders
- raw source files
- generated production dictionary binaries
- generated production frequency tables

`dictionary.mode: "production"` is reserved and unavailable while the manifest
is blocked. `dictionary.mode: "host-provided"` remains the supported external
asset path during initialization.

## Quality Corpus Status

The Prompt 112 corpus is the current production-RC spell-quality corpus. It
covers:

- approved common typo autocorrections
- suggestions-only misspellings
- valid-word traps
- protected structured, technical, and security terms
- URLs, emails, and paths
- Markdown/code protected contexts
- names, acronyms, mixed case, punctuation, contractions, plural ambiguity,
  trading/domain terms, and completion coexistence cases

Required safety outcomes remain:

- protected-token writes: 0
- valid-word autocorrections: 0
- arbitrary delete-index autocorrections: 0
- reviewed false-positive autocorrections: 0

## Benchmark And Package-Size Status

The current gate set includes:

- `pnpm bench:spell-quality`
- `pnpm bench:language-asset`
- `pnpm --filter @typai/core bench`
- `pnpm bench:browser`
- `pnpm package:size-report`

Language asset benchmark status:

- production manifest blocked
- production runtime mode blocked
- host-provided mock fixture measured
- scaled mock fixture measured
- `@typai/core` package impact measured
- no blocked/raw production asset present in the core tarball

Package-size status:

- release package tarballs are below configured failure thresholds
- blocked `@typai/core` tarball is below the blocked-state failure threshold
- production/raw asset files are absent from package output
- package secret scan passes

## Beta RC Version Plan

The default beta target is `0.0.0-beta.0` with proposed npm dist-tag `beta` and
proposed Git tag `v0.0.0-beta.0`, after explicit manual approval.

Release packages:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`
- `@typai/ui` as required support package

`docs/beta-release-candidate-plan.md` owns the detailed version, rollback, and
manual approval plan.

## Release Dry-Run Status

Prompt 114 release dry-runs were non-mutating:

- `pnpm release:check` verifies package metadata and boundaries.
- `pnpm release:version:dry` prints the `0.0.0-dev` to `0.0.0-beta.0` plan and
  changes no files.
- `pnpm release:pack` creates local tarballs only.
- `pnpm release:publish:dry` runs release checks and package secret scan, then
  prints publish order without executing registry publish.

## Source And License Audit Summary

Source/license audit result: pass for blocked-state beta RC.

- Candidate dictionary and frequency source evidence is documented.
- Production asset ingestion remains blocked.
- No unclear-license production asset is bundled.
- Raw source files are excluded from Git and tarballs.
- Production notice placeholders remain outside packed `@typai/core` output
  while inclusion is blocked.
- Host-provided asset behavior is documented as the current external path.

## Engine And FFI Audit Summary

Engine/FFI audit result: pass.

- C++ exposes a narrow `extern "C"` ABI.
- No C++ class crosses into JavaScript.
- No `std::string` crosses FFI.
- Caller-owned buffers are used for replacements and suggestions.
- Rust owns Wasm bindings and converts primitive ABI results into JS values.
- Full document text is not passed into C++ token APIs.
- Dictionary and delete-index state are internally owned.
- Malformed assets are rejected without replacing the existing loaded state.
- Dictionary/index clear and rebuild paths are tested.
- Token checks and suggestions remain synchronous after initialization.

## Correction Safety Audit Summary

Correction safety audit result: pass.

- Valid words are never autocorrected.
- Protected tokens are never autocorrected.
- Delete-index candidates remain suggestions-only unless explicitly approved in
  the common typo table.
- Expanded common typo autocorrections are explicit and test-covered.
- User never-correct overrides the common typo table.
- Personal dictionary entries block correction.
- Always-correct rules still work.
- Casing and punctuation are preserved by tests.
- Contraction and plural ambiguity cases stay suggestions-only.

## Surface Audit Summary

Surface audit result: pass.

Cross-surface coverage includes:

- contenteditable
- textarea
- React textarea
- React contenteditable
- CodeMirror

The E2E matrix covers approved typo correction, suggestions-only behavior,
protected-token safety, valid-word safety, exact revert, CodeMirror protected
code/Markdown contexts, personal dictionary and always/never correction
behavior, and completion/correction coexistence.

## Completion Boundary Audit Summary

Completion boundary audit result: pass.

- Mock providers remain the automated default.
- Real-provider behavior remains manual and environment-gated.
- Browser packages do not own provider secrets.
- Automated tests, demos, E2E, smoke, benchmarks, and CI stay on mock paths.
- Provider proxy examples keep provider credentials server-side.
- Completion benchmarks remain below hard failure thresholds.
- Accepted completions are not blue correction marks.
- Visible completion ghosts dismiss on correction transactions where covered by
  E2E.

## Known Limitations

- Production dictionary/frequency output is still blocked.
- Spell coverage remains limited until a production asset is generated and
  approved.
- WebKit E2E is not part of the current public beta readiness gate.
- Package publishing has not happened.
- Real provider smoke is manual-only.

## Preserved Non-Goals

- no npm publish
- no real Codex adapter
- no grammar/style/tone/clarity behavior
- no local model inference
- no next-edit logging
- no browser extension
- no ProseMirror or Monaco implementation
- no valid-word autocorrect
- no real-word/context autocorrect
- no arbitrary delete-index or SymSpell autocorrect
- no unclear-license asset bundling
- no weakening of current safety gates

## Next Recommended Phase Options

- Actual npm beta publish after explicit manual approval.
- Production asset resolution if the Google Ngram hash and review blockers are
  closed.
- Apple-style personalization for user/project vocabulary, repeated rejection
  suppression, and safer adaptive memory.
- Grammar/style async editor layer with separate marks and no silent rewrite.
- Real Codex adapter after the reusable product architecture remains stable.
- Path B local completion research, kept separate from deterministic
  correction and from this beta package line.
