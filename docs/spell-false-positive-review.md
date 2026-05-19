# Spell False-Positive Review

Status date: 2026-05-19.

This is a stable public review table for Prompt 103. It records the conservative
autocorrect gate and the local debug-table fields that should be watched during
manual demos. It is not telemetry and it is not a raw event export.

## Review Table

| Category | Examples | Source | Expected result | False-positive control |
| --- | --- | --- | --- | --- |
| Original common typos | `teh`, `adn`, `recieve` | common typo table | blue correction | exact table entry only |
| Expanded common typos | `adress`, `definitly`, `tommorow` | expanded common typo table | blue correction | valid-word/protected-token gates run first |
| Delete-index-only misspellings | `reciept`, `addres` | suggestion engine | red unresolved mark | `AUTOCORRECT_GATE_BLOCKED` |
| Contraction repairs | `dont`, `it;s` | suggestions-only override | red unresolved mark | no automatic contraction expansion |
| Plural ambiguity | `adresss` | suggestions-only override | red unresolved mark | ambiguous singular/plural candidate stays manual |
| Valid-word traps | `form`, `lead`, `to`, `its`, `there`, `their` | valid-word guard | do nothing | `VALID_WORD_BLOCK` |
| Protected technical tokens | `nmap`, `sqlmap`, `kubectl` | protected-token gate | do nothing | `PROTECTED_TOKEN_BLOCK` |
| Protected structured tokens | email, URL, paths, identifiers, CVE IDs | protected-token gate | do nothing | `PROTECTED_TOKEN_BLOCK` |
| User never-correct | `adress` -> `address` after saved never rule | user memory | red unresolved mark | `NEVER_CORRECT_RULE` suppresses table autocorrect |
| User always-correct | user-defined `omw` -> `on my way` | user memory | blue correction | explicit user rule only |

## Local Debug Table

The simple demo's local event table now records:

- action
- source
- original
- replacement or first suggestion
- result
- reason codes

The source column distinguishes:

- `common_typo_table`
- `expanded_common_typo_table`
- `delete_index_suggestion_engine`
- `suppressed_autocorrect_gate`
- `protected_token_gate`
- `user_always_rule`
- `user_never_rule`

This is intentionally session-local UI state. It must not become full-document
logging, next-edit logging, or provider telemetry.
