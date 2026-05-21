# Spell Quality Surface Parity Report

Status date: 2026-05-21.

Branch taken: blocked-host-provided. Production language assets remain
unavailable unless a host supplies Typai Dictionary Blob v1 bytes during
`createTypaiCore()` initialization.

This report records the curated Playwright subset for Prompt 136. The full
spell-quality corpus remains the direct-core benchmark in
`tests/spell-quality/corpus`; browser E2E intentionally runs only
representative high-value rows.

## Matrix

| Surface | Approved autocorrect | Suggestions-only | Valid-word traps | Protected technical terms | Casing/punctuation | Personal dictionary | Always/never correct | Code/Markdown contexts | Completion coexistence | Stale/race/IME |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| contenteditable | pass | pass | pass | pass | pass | pass | pass | n/a | covered by V4.1 completion E2E | covered by adapter/completion E2E |
| textarea | pass | pass | pass | pass | pass | pass | pass | n/a | covered by V4.1 completion E2E | covered by adapter/completion E2E |
| React textarea | pass | pass | pass | pass | pass | pass | pass | n/a | covered by V4.1 completion E2E | covered by adapter/completion E2E |
| React contenteditable | pass | pass | pass | pass | pass | pass | pass | n/a | covered by V4.1 completion E2E | covered by adapter/completion E2E |
| CodeMirror | pass | pass | pass | pass | pass | pass | pass | pass | covered by V4.1 completion E2E | covered by adapter/completion E2E |

Browser matrix: Chromium and Firefox through `pnpm test:e2e`. WebKit remains
out of scope for this prompt.

## Corpus-Backed E2E Subset

Approved common typo autocorrect:

- `adress` -> `address`
- `speling` -> `spelling`
- `corection` -> `correction`
- `seperate` -> `separate`
- `definitly` -> `definitely`

Suggestions-only:

- `reciept` suggests `receipt`
- `separat` suggests `separate`
- `adresss` suggests `address`

Valid-word traps:

- `form`
- `from`
- `lead`
- `led`
- `to`
- `too`
- `its`
- `it's`
- `there`
- `their`

Protected technical terms:

- `user@example.com`
- `https://example.com`
- `/etc/passwd`
- `C:\Work\typai\project`
- `snake_case_identifier`
- `camelCaseIdentifier`
- `PascalCaseClass`
- `CVE-2024-1234`
- `@typai/core`
- `OPENAI_API_KEY`
- `nmap`
- `sqlmap`
- `kubectl`

Casing and punctuation:

- `Teh` -> `The`
- `TEH` -> `THE`
- `teh,` -> `the,`
- `teh.` -> `the.`
- `"teh"` remains a conservative protected/no-write token
- CodeMirror Markdown list prose preserves marker spacing: `- adress` -> `- address`

## Bugfixes From This Pass

- Contenteditable marks now validate by current text/range boundaries instead
  of requiring the original document version. This keeps punctuation-triggered
  blue marks visible after the user types the following space while preserving
  stale-range write checks.
- Contenteditable URL scheme prefixes such as `https:` are treated as protected
  in-progress structured tokens, preventing stale red marks on `https` before
  the full URL is typed.

## Safety Summary

- Protected-token writes: 0 in the committed corpus benchmark.
- Valid-word autocorrections: 0 in the committed corpus benchmark.
- Arbitrary delete-index autocorrections: 0 in the committed corpus benchmark.
- Accepted completions remain completion transactions, not blue correction
  marks.
- No real provider calls occur in the E2E or benchmark paths.
- No production dictionary or frequency asset was generated or bundled.
