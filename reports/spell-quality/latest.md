# Spell Quality Latest Report

Generated at: 2026-05-21T03:39:37.348Z

## Summary

- asset mode: host-provided-quality-fixture
- dictionary source kind: in-memory Typai Dictionary Blob v1 quality fixture
- total cases: 142
- core cases: 142
- adapter/E2E-designated cases: 0
- dictionary words: 71
- dictionary bytes: 1469
- delete-index entries: 1876
- delete-index memory estimate: 210720
- allowed autocorrect pass rate: 100.00% (29/29)
- autocorrect precision: 100.00% (29/29)
- suggestion recall@1: 100.00%
- suggestion recall@3: 100.00%
- suggestion recall@5: 100.00%
- valid-word false autocorrect count: 0
- protected-token false write count: 0
- arbitrary delete-index autocorrect count: 0
- domain-term false autocorrect count: 0

## Performance

- core check average: 0.0032 ms
- core check p50/p95/p99/max: 0.0023 ms / 0.0110 ms / 0.0162 ms / 0.2131 ms
- suggestion average: 0.0026 ms
- suggestion p50/p95/p99/max: 0.0019 ms / 0.0065 ms / 0.0086 ms / 0.4215 ms

## Category Counts

- allowed-autocorrect: 21
- suggestions-only: 14
- valid-word-traps: 20
- protected-terms: 18
- casing-punctuation: 12
- contractions: 9
- plural-ambiguity: 5
- domain-cybersecurity: 13
- domain-trading: 8
- markdown-code-contexts: 6
- names-proper-nouns: 11
- regression-bugs: 5

## Gates

- status: passed
- failures: none
- warnings: none

## False-Positive Review

No false-positive autocorrections.

## False-Negative Review

No approved autocorrect misses.

## Suggestion Recall Review

No suggestion recall misses at 5.

## Ambiguous And Rejected Autocorrect Cases

- contraction-dont-001: dont stayed mark_unresolved; expected suggestions ["don't"]
- contraction-dont-period-001: dont. stayed mark_unresolved; expected suggestions ["don't."]
- contraction-it-semicolon-001: it;s stayed mark_unresolved; expected suggestions ["it's"]
- plural-adresss-001: adresss stayed mark_unresolved; expected suggestions ["address","addresses"]
- plural-adressess-001: adressess stayed mark_unresolved; expected suggestions ["addresses"]
- plural-goverments-001: goverments stayed mark_unresolved; expected suggestions ["government"]
- plural-enviroments-001: enviroments stayed mark_unresolved; expected suggestions ["environment"]
- regression-delete-index-autocorrect-block-001: reciept stayed mark_unresolved; expected suggestions ["receipt"]
- suggest-reciept-001: reciept stayed mark_unresolved; expected suggestions ["receipt"]
- suggest-addres-001: addres stayed mark_unresolved; expected suggestions ["address"]
- suggest-separat-001: separat stayed mark_unresolved; expected suggestions ["separate"]
- suggest-tomorow-001: tomorow stayed mark_unresolved; expected suggestions ["tomorrow"]
- suggest-becaus-001: becaus stayed mark_unresolved; expected suggestions ["because"]
- suggest-calandar-001: calandar stayed mark_unresolved; expected suggestions ["calendar"]
- suggest-neccesary-001: neccesary stayed mark_unresolved; expected suggestions ["necessary"]
- suggest-definately-001: definately stayed mark_unresolved; expected suggestions ["definitely"]
- suggest-acommodate-001: acommodate stayed mark_unresolved; expected suggestions ["accommodate"]
- suggest-receve-001: receve stayed mark_unresolved; expected suggestions ["receive"]
- suggest-recieeve-001: recieeve stayed mark_unresolved; expected suggestions ["receive"]
- suggest-spelingg-001: spelingg stayed mark_unresolved; expected suggestions ["spelling"]
- suggest-definitelly-001: definitelly stayed mark_unresolved; expected suggestions ["definitely"]
- suggest-enviornment-001: enviornment stayed mark_unresolved; expected suggestions ["environment"]
- valid-theyre-001: theyre stayed mark_unresolved; expected suggestions ["there","their"]
