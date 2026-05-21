# Dictionary And Frequency Source Selection

Research date: 2026-05-20.

This document records the current source-selection state for Typai production
dictionary and frequency assets. It is not legal advice. No production
dictionary binary, frequency table, raw corpus, or generated production language
blob is bundled by this review.

## Current Decision

Dictionary source path: **approved** for English Speller Database / SCOWL v2
generated Hunspell `en_US` size 60, release `2026.02.25`.

Frequency source path: **blocked for ingestion** until all Google Books Ngram
American English 2019 raw partition SHA-256 values are captured and the final
manifest/notice/quality/package gates pass.

Combined production asset status: **blocked / host-provided only**.

## Candidate Table

| Candidate name | Type | Official source URL | Version | License | Redistribution status | Attribution status | Source hash status | Package suitability | Decision | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| English Speller Database / SCOWL v2 generated Hunspell `en_US` | dictionary | `https://wordlist.aspell.net/`; `https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip` | `2026.02.25`, `rel-2026.02.25`, `7e99eda` | ESDB/SCOWL notice license plus relevant Hunspell affix-file notice | Approved for transformed redistribution if notices are preserved | Required; package-visible Kevin Atkinson and affix-file notices | SHA-256 pinned: `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9` | Suitable as dictionary source only after transform, generated hash, quality, and package gates | approved | Maintained upstream, direct source path, permissive notice terms, conservative en-US size 60 start |
| Google Books Ngram Viewer American English 2019 1-grams | frequency | `https://books.google.com/ngrams/info`; `https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html` | `googlebooks-eng-us-20200217` | Creative Commons Attribution 3.0 Unported | Source license path appears compatible with attribution, but production ingestion is blocked | Required; Google Books Ngram Viewer, corpus/version, CC BY 3.0, and change notice | Partial: `totalcounts-1` pinned; 14 gzip partition SHA-256 values missing | Not suitable for package inclusion until hashes, transform output, notices, size, and quality gates pass | blocked | The source corpus is official and versioned, but the raw source hash gate is incomplete and the source set is 8,223,758,203 bytes |
| 12dicts 6.0.2 | combined | `https://wordlist.aspell.net/12dicts-readme/`; `https://sourceforge.net/projects/wordlist/files/12Dicts/6.0/12dicts-6.0.2.zip/download` | `6.0.2` | Most lists public domain by author statement; AGID-derived lists carry inherited constraints | Public-domain lists are reusable; AGID-derived lists need separate filtering/review | Acknowledgment requested; inherited AGID notices may apply | SHA-256 pinned for zip: `64ac1d35acb66b550c7ebc56e080b62e0bad8f5984d72059dc2e05ac48780e52` | Fallback/test-corpus only; not a primary modern production dictionary/frequency source | fallback-only | Useful historical permissive list, but stale, partially constrained by AGID lineage, and not better than ESDB for the first production source |
| wordfreq | frequency | `https://github.com/rspeer/wordfreq`; `https://pypi.org/project/wordfreq/` | `3.1.1` | Code/package Apache-2.0; redistributed data documented under Creative Commons Attribution-ShareAlike 4.0 with source-specific obligations | Blocked for first Typai asset due ShareAlike and multi-source provenance complexity | Required and multi-source | No Typai source hash selected | Not suitable for first production npm frequency table | blocked | Convenient frequency package, but data-license obligations are heavier than Typai needs for the first asset |
| Wordnik wordlist | dictionary | `https://github.com/wordnik/wordlist` | no release selected; main list dated `20210729` in prior review | MIT | Allowed with MIT notice | MIT notice required | No release/source hash selected | Not suitable as primary production spellcheck dictionary | rejected | Word-game oriented, no frequency data, no release pin, weaker source process than ESDB |
| Apache OpenOffice / Mozilla English dictionary variants | dictionary | `https://extensions.openoffice.org/en/project/english-dictionaries-apache-openoffice`; `https://addons.mozilla.org/en-US/firefox/addon/us-english-dictionary/`; `https://github.com/marcoagpinto/aoo-mozilla-en-dict` | no Typai source pin selected | downstream packages include LGPL/GPL-family obligations depending on package/file | Not selected; downstream provenance and obligations are heavier than ESDB upstream | Required if used | No Typai source hash selected | Not suitable for first production asset | rejected | Downstream browser/office package path is less direct and more complex than ESDB upstream |

## Frequency Normalization Strategy

If the Google Ngram source path later passes the hash gate, the transform must:

1. Read only pinned local source files from an external workspace.
2. Verify SHA-256 for every raw input before parsing.
3. Stream gzip unigram partitions line by line.
4. Aggregate unigram counts deterministically.
5. Normalize to lowercase ASCII alphabetic words accepted by Typai policy.
6. Intersect frequency rows with the approved dictionary output.
7. Emit compact integer scores in Typai Dictionary Blob v1.
8. Record generated word count, byte size, SHA-256, excluded counts, and
   frequency coverage in the manifest metadata.

No network fetch is allowed inside the default transform path.

## Final Recommendation

Keep ESDB/SCOWL v2 as the first dictionary source path. Keep Google Books Ngram
American English 2019 as the first frequency source direction only after the
raw partition hash gate is completed.

Do not select a weaker fallback merely to proceed. The correct current result
is production asset **blocked / host-provided only**.
