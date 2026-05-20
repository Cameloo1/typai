# Spell Quality Report

Status date: 2026-05-19.

This is the stable spell-quality report for the Production Language Asset RC
phase. It describes the committed quality gates and review tables;
machine-local timings should be read from `pnpm bench:spell-quality` and
`pnpm bench:browser` output for the run being evaluated. Asset load, memory,
and package-size timings are owned by `pnpm bench:language-asset` and
`pnpm package:size-report`.

Prompt 107 keeps the full Intelligence Quality Foundation audit in
`docs/intelligence-quality-foundation-complete.md`. Prompt 112 expands this
report and the committed corpus for production/host-provided asset readiness
while keeping production asset ingestion blocked.

Prompt 114 records the final public beta RC audit in
`docs/production-language-asset-rc-complete.md`.

## Quality Benchmark

Run:

```sh
pnpm bench:spell-quality
```

The benchmark uses the committed corpus categories below and prints:

- allowed autocorrect count
- autocorrect precision on the corpus
- suggestion recall on the corpus
- valid-word false autocorrect count
- protected-token false write count
- protected-token non-noop count
- reviewed false-positive autocorrect count
- suggestions-only count
- host-provided dictionary fixture behavior
- production dictionary mode blocked status
- average direct core latency
- p95 direct core latency
- a pointer to the separate browser correction p95 gate in
  `pnpm bench:browser`
- a pointer to the separate asset load, delete-index memory, and package-size
  gates in `pnpm bench:language-asset` and `pnpm package:size-report`

Hard failures:

| Gate | Failure condition |
| --- | --- |
| Allowed autocorrect coverage | any approved common-typo/casing case misses its expected replacement |
| Autocorrect precision | below 99% on the benchmark corpus |
| Valid-word false autocorrects | greater than 0 |
| Protected-token false writes | greater than 0 |
| Reviewed false-positive autocorrects | greater than 0 |
| Production dictionary mode | not blocked while package inclusion is blocked |
| Host-provided fixture behavior | fixture fails to load or fails known-word/suggestion checks |
| Direct core p95 | greater than 100 ms |
| Production asset/package contents | handled by `pnpm bench:language-asset` and `pnpm package:size-report`; blocked/raw assets in tarballs are failures |

Warnings:

| Gate | Warning condition |
| --- | --- |
| Suggestion recall | below 90% on the suggestion corpus |
| Direct core p95 | greater than 20 ms |
| Browser completion p95 | handled by `pnpm bench:browser`; warning target remains 800 ms |
| Asset load and memory | handled by `pnpm bench:language-asset` |

## Corpus Categories

| Category | Examples | Expected behavior |
| --- | --- | --- |
| Expanded common typos | `adress`, `speling`, `definitly`, `tommorow` | blue autocorrect from explicit table |
| Casing and punctuation | `Teh`, `TEH`, `teh,`, `Adress`, `definitly!` | blue autocorrect with case/punctuation preserved |
| Suggestions-only misspellings | `reciept`, `addres`, `separat`, `tomorow`, `calandar` | red unresolved mark with suggestion |
| Contractions | `dont`, `it;s` | red unresolved suggestion, no automatic expansion |
| Plural ambiguity | `adresss` | red unresolved suggestion, no automatic plural rewrite |
| Valid-word traps | `form`, `lead`, `to`, `its`, `there`, `their`, `from`, `too`, `led` | do nothing |
| Protected terms | email, URL, Unix path, home path, identifier, CVE-shaped tokens | do nothing |
| Technical terms | `nmap`, `sqlmap`, `ffuf`, `gobuster`, `kubectl`, `iptables` | do nothing |
| Acronyms | `XSS`, `CSRF`, `API`, `NASA`, `SQL`, `HTTP` | do nothing |
| Proper nouns reviewed | `Alice`, `Cameloo`, `Typai`, `OpenAI` | no autocorrect |
| Trading/domain terms | `BTC`, `ETH`, `SPY`, `NVDA` | do nothing |

## False-Positive Review

Typai's current autocorrection sources are intentionally narrow:

| Source | Examples | Automatic? | False-positive control |
| --- | --- | --- | --- |
| Original common typo table | `teh`, `adn`, `recieve`, `becuase`, `thier` | yes | exact table entry only |
| Expanded common typo table | `adress`, `seperate`, `neccessary` | yes | exact table entry after valid/protected gates |
| User always-correct rule | user-defined original/replacement | yes | explicit user memory only |
| Delete-index candidate | `reciept` to `receipt` | no | `AUTOCORRECT_GATE_BLOCKED` |
| Contraction suggestion | `dont` to `don't` | no | suggestions-only override |
| Plural ambiguity | `adresss` to `address` | no | suggestions-only override |
| Host-provided dictionary word | `receipt` | no | loaded as known word during initialization |

No next-edit logging exists. The local demos can show session-local debug rows,
reason codes, source kind, and revert actions, but they do not persist full
documents or user edit streams.

## Current Review Summary

- Common typo table entries: 21.
- Benchmark autocorrect cases: 27, including casing and punctuation variants.
- Suggestions-only cases: 12.
- Valid-word traps: 9.
- Protected structured terms: 8.
- Protected technical terms: 6.
- Acronym terms: 6.
- Proper-name false-positive candidates reviewed: 4.
- Trading/domain terms: 4.
- Suggestion recall in the Prompt 112 benchmark run: 12/12.
- Valid-word false autocorrect count: 0.
- Protected-token false write count: 0.
- Reviewed false-positive autocorrect count: 0.
- Host-provided fixture path: loads the mock Typai Dictionary Blob during
  initialization, keeps `receipt` as a known word, and recalls `reciept` to
  `receipt`.
- Production dictionary mode: blocked until package inclusion is approved.
- Reverted correction telemetry: none exists; local tests cover exact revert
  behavior without collecting user telemetry.
- Suppressed corrections are represented by reason codes such as
  `AUTOCORRECT_GATE_BLOCKED`, `VALID_WORD_BLOCK`, and
  `PROTECTED_TOKEN_BLOCK`.

## Cross-Surface Quality Report

`pnpm test:e2e` includes the Prompt 112 spell-quality parity matrix across:

- contenteditable
- textarea
- React textarea
- React contenteditable
- CodeMirror

The matrix covers expanded autocorrect, exact blue-mark revert,
suggestions-only behavior, chosen-suggestion correction transactions,
valid-word safety, protected-token safety, casing/punctuation, personal
dictionary, and always/never correction rules. CodeMirror also keeps Markdown
inline code and fenced code contexts protected while ordinary prose still uses
spelling behavior.

| Surface | Correction | Suggestions | Valid/protected safety | Completion coexistence |
| --- | --- | --- | --- | --- |
| contenteditable | covered | covered | covered | V4.1 E2E |
| textarea | covered | covered | covered | V4.1 E2E |
| React textarea | covered | covered | covered | V4.1 E2E |
| React contenteditable | covered | covered | covered | V4.1 E2E |
| CodeMirror | covered | covered | Markdown/code contexts covered | V4.1 E2E |

## Completion Quality Notes

The real-provider completion path is manual and proxy-routed. Automated tests,
E2E, browser benchmarks, smoke scripts, and CI continue to use mock providers
and mock proxy routes. `pnpm smoke:real-provider:manual` is expected to skip
unless the explicit real-provider environment gates are set.

`pnpm bench:browser` remains the source for browser correction and mocked
completion p95 timings. Completion warnings do not trigger provider calls.
Accepted completions are asserted to produce no blue correction mark. Visible
completion ghosts are asserted to dismiss when a correction transaction occurs.

## Prompt 107 Audit Summary

- Source/license: no production dictionary or frequency asset is bundled; the
  checked-in dictionary fixture is mock-only and generated production outputs
  remain blocked by policy gates.
- Engine/FFI: native correction and suggestion APIs use primitive returns and
  caller-owned buffers; no C++ heap ownership crosses into Rust or JavaScript.
- Correction safety: valid-word autocorrections, protected-token writes, and
  arbitrary delete-index autocorrections remain gated at zero.
- Surface parity: E2E covers contenteditable, textarea, React textarea, React
  contenteditable, and CodeMirror.
- Completion boundary: mock remains default, proxy mode is optional, and real
  provider use remains manual and server-side.
- Metrics/privacy: no next-edit logging or full-document spell-quality report
  is introduced.

## Known Limitations

- No production dictionary or frequency asset is bundled.
- The scaled mock dictionary is a loader stress fixture, not language quality.
- Delete-index suggestions improve recall but do not create autocorrect
  triggers by themselves.
- Proper nouns and domain terms are protected from autocorrect, but some may
  still be red spelling issues unless they are known by the built-in or loaded
  dictionary.
- Valid-word/context correction is still out of scope.
- Grammar, style, tone, clarity, local model inference, and next-edit logging
  are still out of scope.
