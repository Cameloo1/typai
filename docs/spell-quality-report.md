# Spell Quality Report

Status date: 2026-05-21.

This is the stable spell-quality report for the current production asset gate.
The live quality harness is corpus-driven and runs with:

```sh
pnpm bench:spell-quality
```

The benchmark loads structured JSONL fixtures from `tests/spell-quality/corpus`,
evaluates them through `@typai/core`, writes a concise markdown report to
`reports/spell-quality/latest.md`, and writes the larger machine-readable JSON
report to ignored local output at `reports/spell-quality/latest.json`.

The current run uses an in-memory host-provided Typai Dictionary Blob v1
quality fixture. That fixture exists only to make valid-word, proper-noun, and
domain-term safety measurable without generating, packing, or claiming a
production dictionary asset.

## Current Benchmark Summary

Latest committed report: `reports/spell-quality/latest.md`.
Surface parity report: `reports/spell-quality/surface-parity.md`.

Latest benchmark run:

- total cases: 142
- core cases: 142
- adapter/E2E-designated cases: 0
- dictionary mode: host-provided quality fixture
- dictionary words: 71
- dictionary bytes: 1469
- delete-index entries: 1875
- delete-index memory estimate: 210689 bytes
- allowed autocorrect pass rate: 100.00% (29/29)
- autocorrect precision: 100.00% (29/29)
- suggestion recall@1: 100.00%
- suggestion recall@3: 100.00%
- suggestion recall@5: 100.00%
- valid-word false autocorrect count: 0
- protected-token false write count: 0
- arbitrary delete-index autocorrect count: 0
- domain-term false autocorrect count: 0
- protected-token non-noop count: 0
- production dictionary mode while blocked: unavailable as expected

Performance from the same run:

- core check average: 0.0030 ms
- core check p50/p95/p99/max: 0.0023 ms / 0.0104 ms / 0.0153 ms / 0.2481 ms
- suggestion average: 0.0024 ms
- suggestion p50/p95/p99/max: 0.0019 ms / 0.0061 ms / 0.0078 ms / 0.1693 ms

Machine-local timings can vary. The hard gate is the command result, not the
exact numbers above.

## Corpus Categories

| Category | Rows | Expected behavior |
| --- | ---: | --- |
| allowed-autocorrect | 21 | explicit common typo table entries auto-correct exactly |
| suggestions-only | 14 | broad misspellings suggest without automatic rewrite |
| valid-word-traps | 20 | valid words and explicit real-word traps do nothing |
| protected-terms | 18 | URLs, emails, paths, commands, identifiers, keys, hashes, package names do nothing |
| casing-punctuation | 12 | approved corrections preserve case/punctuation; protected fragments stay untouched |
| contractions | 9 | contraction-like misspellings suggest only unless explicitly approved |
| plural-ambiguity | 5 | ambiguous plural/inflection cases suggest only |
| domain-cybersecurity | 13 | security tools and acronyms do not get unwanted autocorrect |
| domain-trading | 8 | trading abbreviations and terms do not get unwanted autocorrect |
| markdown-code-contexts | 6 | inline code, fenced code, links, shell/import snippets stay protected |
| names-proper-nouns | 11 | proper nouns and technical names are protected or dictionary-known |
| regression-bugs | 5 | prior safety bugs remain pinned as critical regression rows |

## Quality Gates

Hard failures:

| Gate | Failure condition |
| --- | --- |
| Corpus schema | malformed JSONL row, unknown category, duplicate id, or missing required field |
| Approved autocorrect | any approved common-typo case misses exact replacement or reason code |
| Autocorrect precision | below 99% on the evaluated corpus |
| Valid-word safety | valid-word false autocorrect count greater than 0 |
| Protected-token safety | protected-token false write count greater than 0 |
| Delete-index safety | arbitrary delete-index autocorrect count greater than 0 |
| Domain-term safety | domain/proper noun false autocorrect count greater than 0 |
| Core latency | core check p95 greater than 100 ms |
| Suggestion latency | suggestion p95 greater than 100 ms |

Warnings:

| Gate | Warning condition |
| --- | --- |
| Suggestion recall | recall@3 below 90% |
| Category coverage | any configured category has fewer than the required rows |
| Core latency | core check p95 greater than 20 ms |
| Suggestion latency | suggestion p95 greater than 20 ms |

## Tiered Evaluation Model

Tier 1 is the core corpus in `tests/spell-quality`. It is designed to scale to
thousands of rows and runs direct synchronous `checkCompletedToken()` and
`suggestToken()` checks without browser work.

Tier 2 is adapter conformance. Existing cross-surface tests cover selected
representative rows across contenteditable, textarea, React, and CodeMirror.

Tier 3 is browser smoke and latency. `pnpm test:e2e` and `pnpm bench:browser`
remain the browser-level proof paths.

Prompt 136 adds a corpus-backed Playwright subset for contenteditable,
textarea, React textarea, React contenteditable, and CodeMirror. It covers
approved common typos, suggestions-only misspellings, valid-word traps,
protected technical terms, casing/punctuation preservation, personal
dictionary behavior, always/never correction rules, CodeMirror Markdown/code
protection, and completion coexistence through the existing V4.1 completion
E2E. The matrix is recorded in
`reports/spell-quality/surface-parity.md`.

Tier 4 is manual review. `reports/spell-quality/latest.md` lists every
false-positive autocorrect, approved autocorrect miss, suggestion recall miss,
and suggestions-only case that remains intentionally rejected from automatic
correction.

## False-Positive Review

Latest result:

- false-positive autocorrections: none
- approved autocorrect misses: none
- suggestion recall misses at 5: none
- valid-word false autocorrect count: 0
- protected-token false write count: 0
- arbitrary delete-index autocorrect count: 0

Suggestions-only rows such as `reciept`, `addres`, `dont`, `adresss`, and
`theyre` remain rejected from autocorrect unless a later reviewed prompt adds
an exact explicit table entry. Delete-index candidates do not become
autocorrect triggers by themselves.

## Current Limits

- No production dictionary or frequency asset is bundled.
- The host-provided quality fixture is test-only and not production language
  coverage.
- The scaled mock dictionary is a loader stress fixture, not spell quality.
- Valid-word/context autocorrection remains out of scope.
- Grammar, style, tone, clarity, local model inference, and next-edit logging
  remain out of scope.
- No real provider calls occur in this benchmark.

## Prompt 136 Surface Parity Notes

- Browser E2E uses representative corpus rows instead of running the entire
  corpus through Playwright.
- Quoted `"teh"` is currently a conservative protected/no-write token rather
  than a quote-preserving autocorrection.
- Contenteditable now preserves punctuation-triggered blue marks after a
  following space.
- Contenteditable now treats `https:` as an in-progress protected URL prefix,
  preventing stale red marks while a URL is being typed.
- Corpus package tests now rely on the Turbo dependency graph for shared
  `@typai/core` builds, avoiding concurrent Wasm rebuild races in `pnpm test`.

## Prompt 137 Benchmark Hardening Notes

- `pnpm bench:browser` now includes deterministic React textarea correction in
  addition to contenteditable, textarea, and CodeMirror correction paths.
- Browser benchmark output now emits parseable `browser-benchmark-json` lines
  and keeps correction thresholds separate from mocked completion thresholds.
- `pnpm bench:language-asset` and `pnpm --filter @typai/core bench` emit
  parseable JSON summaries for release gate consumers.

## Prompt 139 Final Audit Notes

- The final Production Asset Unblock audit reran `pnpm bench:spell-quality`
  and kept all hard safety counts at zero.
- The quality harness remains fixture-backed, not a claim that production
  dictionary coverage is bundled.
- The final asset state remains blocked / host-provided only; production
  quality evidence must be rerun after any approved generated asset exists.
