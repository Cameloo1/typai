# Spell Quality Report

Status date: 2026-05-19.

This is the stable Prompt 106 quality report. It describes the committed
quality gates and review tables; machine-local timings should be read from
`pnpm bench:spell-quality` and `pnpm bench:browser` output for the run being
evaluated.

Prompt 107 keeps this report as the public quality summary and records the
full phase audit in `docs/intelligence-quality-foundation-complete.md`.

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
- suggestions-only count
- average direct core latency
- p95 direct core latency
- a pointer to the separate browser correction p95 gate in
  `pnpm bench:browser`

Hard failures:

| Gate | Failure condition |
| --- | --- |
| Allowed autocorrect coverage | any approved common-typo/casing case misses its expected replacement |
| Autocorrect precision | below 99% on the benchmark corpus |
| Valid-word false autocorrects | greater than 0 |
| Protected-token false writes | greater than 0 |
| Direct core p95 | greater than 100 ms |

Warnings:

| Gate | Warning condition |
| --- | --- |
| Suggestion recall | below 90% on the suggestion corpus |
| Direct core p95 | greater than 20 ms |
| Browser completion p95 | handled by `pnpm bench:browser`; warning target remains 800 ms |

## Corpus Categories

| Category | Examples | Expected behavior |
| --- | --- | --- |
| Expanded common typos | `adress`, `speling`, `definitly`, `tommorow` | blue autocorrect from explicit table |
| Casing and punctuation | `Teh`, `TEH`, `teh,` | blue autocorrect with case/punctuation preserved |
| Suggestions-only misspellings | `reciept`, `addres` | red unresolved mark with suggestion |
| Contractions | `dont`, `it;s` | red unresolved suggestion, no automatic expansion |
| Plural ambiguity | `adresss` | red unresolved suggestion, no automatic plural rewrite |
| Valid-word traps | `form`, `lead`, `to`, `its`, `there`, `their` | do nothing |
| Protected terms | email, URL, path, identifier, CVE-shaped tokens | do nothing |
| Technical terms | `nmap`, `sqlmap`, `kubectl` | do nothing |

## False-Positive Review

Typai's current autocorrection sources are intentionally narrow:

| Source | Examples | Automatic? | False-positive control |
| --- | --- | --- | --- |
| Original common typo table | `teh`, `adn`, `recieve`, `becuase`, `thier` | yes | exact table entry only |
| Expanded common typo table | `adress`, `seperate`, `neccessary` | yes | exact table entry after valid/protected gates |
| User always-correct rule | user-defined original/replacement | yes | explicit user memory only |
| Delete-index candidate | `reciept` -> `receipt` | no | `AUTOCORRECT_GATE_BLOCKED` |
| Contraction suggestion | `dont` -> `don't` | no | suggestions-only override |
| Plural ambiguity | `adresss` -> `address`, `addresses` | no | suggestions-only override |

No next-edit logging exists. The local demos can show session-local debug rows,
reason codes, source kind, and revert actions, but they do not persist full
documents or user edit streams.

## Current Review Summary

- Common typo table entries: 21.
- Benchmark autocorrect cases: 24, including casing and punctuation variants.
- Suggestions-only cases: 5.
- Valid-word traps: 6.
- Protected structured terms: 6.
- Protected technical terms: 3.
- Reverted correction telemetry: none exists; local tests cover exact revert
  behavior without collecting user telemetry.
- Suppressed corrections are represented by reason codes such as
  `AUTOCORRECT_GATE_BLOCKED`, `VALID_WORD_BLOCK`, and
  `PROTECTED_TOKEN_BLOCK`.

## Cross-Surface Quality Report

`pnpm test:e2e` includes the Prompt 104 spell-quality parity matrix across:

- contenteditable
- textarea
- React textarea
- React contenteditable
- CodeMirror

The matrix covers expanded autocorrect, suggestions-only behavior, valid-word
safety, protected-token safety, casing/punctuation, personal dictionary, and
always/never correction rules. CodeMirror also keeps Markdown code contexts
protected while ordinary prose still uses spelling behavior.

## Completion Quality Notes

The real-provider completion path is manual and proxy-routed. Automated tests,
E2E, browser benchmarks, smoke scripts, and CI continue to use mock providers
and mock proxy routes. `pnpm smoke:real-provider:manual` is expected to skip
unless the explicit real-provider environment gates are set.

`pnpm bench:browser` remains the source for browser correction and mocked
completion p95 timings. Completion warnings do not trigger provider calls.

## Prompt 107 Audit Summary

- Source/license: no production dictionary or frequency asset is bundled; the
  checked-in dictionary fixture is mock-only and generated production outputs
  remain blocked by policy gates.
- Engine/FFI: native correction and suggestion APIs use primitive returns and
  caller-owned buffers; no C++ heap ownership crosses into Rust or JavaScript.
- Correction safety: valid-word autocorrections, protected-token writes, and
  arbitrary delete-index autocorrections remain gated at zero.
- Surface parity: Prompt 104 E2E covers contenteditable, textarea, React
  textarea, React contenteditable, and CodeMirror.
- Completion boundary: mock remains default, proxy mode is optional, and real
  provider use remains manual and server-side.
- Metrics/privacy: no next-edit logging or full-document spell-quality report
  is introduced.

## Known Limitations

- No production dictionary or frequency asset is bundled.
- The scaled mock dictionary is a loader stress fixture, not language quality.
- Delete-index suggestions improve recall but do not create autocorrect
  triggers by themselves.
- Valid-word/context correction is still out of scope.
- Grammar, style, tone, clarity, local model inference, and next-edit logging
  are still out of scope.
