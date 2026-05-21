# Common Typo Table

Status date: 2026-05-20.

This table is the current project-owned autocorrect allowlist. It is deliberately
small. It is not a production dictionary, not a frequency model, and not a
general edit-distance autocorrect system.

## Policy

A typo may autocorrect only when:

- the typo is a non-word in Typai's supported English scope
- the correction is unambiguous without document context
- the entry is explicitly listed in this table
- valid-word traps are excluded
- names, proper nouns, technical terms, commands, paths, emails, URLs, and
  identifiers remain protected

Delete-index/edit-distance suggestions do not become autocorrections by
themselves.

## Current Autocorrect Entries

| Typo | Correction | Notes |
| --- | --- | --- |
| `teh` | `the` | original deterministic table |
| `adn` | `and` | original deterministic table |
| `recieve` | `receive` | original deterministic table |
| `becuase` | `because` | original deterministic table |
| `thier` | `their` | original deterministic table |
| `adress` | `address` | reviewed baseline |
| `speling` | `spelling` | reviewed baseline |
| `corection` | `correction` | reviewed baseline |
| `seperate` | `separate` | reviewed baseline |
| `definitly` | `definitely` | reviewed baseline |
| `accomodate` | `accommodate` | reviewed baseline |
| `occured` | `occurred` | reviewed baseline |
| `untill` | `until` | reviewed baseline |
| `tommorow` | `tomorrow` | reviewed baseline |
| `goverment` | `government` | reviewed baseline |
| `enviroment` | `environment` | reviewed baseline |
| `arguement` | `argument` | reviewed baseline |
| `calender` | `calendar` | reviewed baseline |
| `embarass` | `embarrass` | reviewed baseline |
| `publically` | `publicly` | reviewed baseline |
| `neccessary` | `necessary` | reviewed baseline |

## Suggestions-Only Cases

These may appear as suggestions, but they must not autocorrect automatically.

| Token | Suggestion | Reason |
| --- | --- | --- |
| `reciept` | `receipt` | delete-index candidate; left suggestion-only |
| `dont` | `don't` | contraction repair; no automatic expansion |
| `it;s` | `it's` | punctuation/contraction repair; no automatic rewrite |
| `adresss` | `address`, `addresses` | plural ambiguity |

## Valid-Word And Protected Examples

These are expected no-write cases:

- `form`
- `lead`
- `to`
- `its`
- `there`
- URLs
- emails
- file paths
- identifiers
- code-like spans

## Additions Gate

Future additions require:

1. one table row in this doc
2. a golden-corpus autocorrect case
3. false-positive coverage when the token resembles a valid word, name,
   identifier, command, or technical term
4. cross-surface E2E coverage when the behavior affects adapters
5. no reliance on frequency, edit distance, or delete-index rank as the only
   autocorrect gate

The next broad spelling-quality improvement should come from Production Asset
Unblock, not by casually growing this table.
