# Dictionary And Frequency Source Selection

Research date: 2026-05-19

This document records the Prompt 100 source review for Typai's future
production English dictionary and frequency assets. It is not legal advice. No
production dictionary or frequency asset is bundled by this review.

## Decision

Approved dictionary source: **English Speller Database / SCOWL v2**, using an
official generated non-Australian `en-US` wordlist at ESDB size 60 first.

Approved frequency source: **Google Books Ngram Viewer unigram data**, using the
American English 2019 corpus identifier `googlebooks-eng-us-20200217` first.

Asset ingestion status: **blocked until the asset PR includes the required
manifest, deterministic transform script, exact source hashes, attribution, size
evidence, and review signoff**.

This means Prompt 101 may implement the approved source pipeline and host-
provided or scaled mock loading path, but it must not commit, pack, publish, or
ship generated production assets unless every gate in
`docs/dictionary-asset-policy.md` passes.

## Candidate Evaluation

### 1. English Speller Database / SCOWL v2

- Name: English Speller Database, previously SCOWLv2 / SCOWL.
- Official source URL: https://wordlist.aspell.net/ and
  https://github.com/en-wl/wordlist
- Maintainer/project: Kevin Atkinson / `en-wl/wordlist`.
- Asset type: dictionary source database, plain wordlists, Aspell dictionaries,
  Hunspell dictionaries; includes commonness/size metadata.
- License: MIT-like notice license for ESDB/SCOWL v2 and generated wordlists.
  Official non-Australian speller dictionaries need the primary notice; AU,
  UKACD, and WordNet notices may apply for other variants or database-derived
  outputs.
- Redistribution allowed: yes for official non-Australian generated speller
  wordlists, with required notice preservation.
- Commercial use allowed: yes, the source grants use, copy, modify, distribute,
  and sell rights with notice preservation.
- Modification allowed: yes, with notices preserved.
- Attribution required: yes. Include the Kevin Atkinson copyright and permission
  notice, plus any other applicable notice if the selected export is not the
  conservative non-Australian official speller wordlist.
- Current maintenance status/date: active. Official dictionary page lists latest
  Hunspell release `2026.02.25`.
- Source version or release hash: `2026.02.25`, readme timestamp
  `Wed Feb 25 15:37:24 2026 -0500`, commit marker `[7e99eda]`.
- Data size: configurable by dialect, size, and variant. Default Hunspell
  dictionaries correspond to ESDB size 60; large dictionaries correspond to size
  70.
- Language coverage: English dialects, including American, Canadian,
  Australian, British variants, and plain wordlists.
- Frequency included: no exact corpus frequency. ESDB commonness/size metadata
  is a coarse acceptance prior, not a frequency corpus.
- Deterministic transform/build script possible: yes. A future script can fetch
  the pinned official release, select `en-US` size 60, strip unsupported
  annotations or Hunspell flags, normalize case according to Typai policy, and
  emit Typai Dictionary Blob v1 with manifest counts and hashes.
- Risks:
  - ESDB database/API is still described as work in progress.
  - Large size 70 includes more uncommon valid words and can increase
    false-negative typo behavior.
  - Non-`en-US` and large exports may trigger extra notice obligations.
  - New upstream words may use LLM screening as one signal, so each update needs
    provenance and quality review.
- Recommendation: **accept** as the production dictionary source, with asset
  ingestion still gated by manifest, transform, attribution, size, and review
  signoff.

### 2. ESDB-Generated Hunspell English Dictionaries

- Name: ESDB/SCOWL-generated Hunspell English dictionaries.
- Official source URL: https://wordlist.aspell.net/dicts/ and
  https://github.com/en-wl/wordlist/releases
- Maintainer/project: Kevin Atkinson / English Speller Database.
- Asset type: Hunspell `.aff` / `.dic`.
- License: ESDB/SCOWL notice license for dictionaries plus affix-file lineage
  notices.
- Redistribution allowed: yes, with notices.
- Commercial use allowed: yes, with notices.
- Modification allowed: yes.
- Attribution required: yes, same notice obligations as the exact ESDB export
  and affix-file lineage.
- Current maintenance status/date: active; latest Hunspell release is
  `2026.02.25`.
- Source version or release hash: `2026.02.25`, readme timestamp
  `Wed Feb 25 15:37:24 2026 -0500`, commit marker `[7e99eda]`.
- Data size: default dictionaries are size 60; large dictionaries are size 70.
- Language coverage: en_US, en_CA, en_AU, British variants, and large variants.
- Frequency included: no exact frequency data; Hunspell flags are morphology and
  suggestion metadata, not Typai ranking frequency.
- Deterministic transform/build script possible: yes, but the script must strip
  or explicitly model flags and must not import Hunspell runtime semantics into
  the current deterministic engine.
- Risks:
  - `.aff` morphology is richer than Typai's current token engine.
  - `.dic` entries include flags that must be stripped or modeled.
  - Large variants can admit uncommon words that Typai should keep conservative.
- Recommendation: **maybe**. Use only as an extraction fallback if plain ESDB
  export is less stable than the official generated Hunspell release.

### 3. LibreOffice English Hunspell Dictionaries

- Name: LibreOffice bundled English dictionaries.
- Official source URL: https://github.com/LibreOffice/dictionaries/tree/master/en
  and https://raw.githubusercontent.com/LibreOffice/dictionaries/master/en/license.txt
- Maintainer/project: LibreOffice dictionaries / The Document Foundation.
- Asset type: Hunspell `.aff` / `.dic`.
- License: mixed downstream package metadata; the checked `en/license.txt`
  contains GPL-2.0 text.
- Redistribution allowed: blocked for Typai until a specific file-level source
  path is proven permissive and preferable to ESDB upstream.
- Commercial use allowed: blocked for Typai because the downstream package
  license is not the cleanest source for broad npm redistribution.
- Modification allowed: blocked for Typai pending exact file-level review.
- Attribution required: yes if used.
- Current maintenance status/date: repository is active, but the English
  dictionary lineage in this downstream package is not a better source than ESDB
  upstream for Typai.
- Source version or release hash: none selected.
- Data size: Hunspell dictionary files; exact size depends on selected locale.
- Language coverage: many languages; English variants under `en/`.
- Frequency included: no.
- Deterministic transform/build script possible: yes technically, but not
  selected.
- Risks:
  - GPL/copyleft compatibility risk for a transformed npm-distributed data
    asset.
  - Downstream packaging makes provenance harder than using ESDB directly.
  - No frequency metadata.
- Recommendation: **reject** for the first Typai production asset.

### 4. Apache OpenOffice / Mozilla English Dictionary Variants

- Name: Marco A.G.Pinto / aoo-mozilla-en-dict and Firefox dictionary packages.
- Official source URL: https://extensions.openoffice.org/en/project/english-dictionaries-apache-openoffice,
  https://addons.mozilla.org/en-US/firefox/addon/us-english-dictionary/, and
  https://github.com/marcoagpinto/aoo-mozilla-en-dict
- Maintainer/project: Marco A.G.Pinto and downstream Firefox/OpenOffice package
  maintainers.
- Asset type: Hunspell dictionaries and browser/office extensions.
- License: Firefox add-on page lists `GNU Lesser General Public License v3.0
  only`; OpenOffice extension packaging adds downstream review complexity.
- Redistribution allowed: likely under LGPL terms for the add-on package, but
  not selected for Typai.
- Commercial use allowed: likely under LGPL terms, with obligations that Typai
  does not need for the first production asset.
- Modification allowed: yes under applicable license.
- Attribution required: yes if used.
- Current maintenance status/date: active. Firefox add-on version `2026.5.1`
  was last updated May 9, 2026 and is listed at 465.94 KB.
- Source version or release hash: Firefox add-on `2026.5.1`; no Typai source
  pin selected.
- Data size: extension package around hundreds of KB for the Firefox en-US
  package; varies by bundled language set.
- Language coverage: English variants for office/browser spellchecking.
- Frequency included: no.
- Deterministic transform/build script possible: technically yes, but not
  recommended.
- Risks:
  - LGPL-3.0-only package status is heavier than Typai needs.
  - Downstream browser/office packaging is not the canonical source.
  - No frequency metadata.
- Recommendation: **reject** for the first Typai production asset.

### 5. Google Books Ngram Viewer Data

- Name: Google Books Ngram Viewer data.
- Official source URL: https://books.google.com/ngrams/info
- Maintainer/project: Google Books Ngram Viewer team / Google Books.
- Asset type: n-gram corpus data; Typai would derive a compact unigram
  frequency table.
- License: official Ngram Viewer terms state that graphs and data may be freely
  used for any purpose, with acknowledgement and a source link appreciated.
- Redistribution allowed: yes, based on the official reuse statement.
- Commercial use allowed: yes, based on the official reuse statement.
- Modification allowed: yes for transformed frequency extraction, based on the
  same reuse statement.
- Attribution required: acknowledgement is described as appreciated; Typai will
  require attribution anyway.
- Current maintenance status/date: official documentation lists 2009, 2012,
  2019, and quarterly released corpora. Corpus identifiers are stable and
  versioned by date.
- Source version or release hash: start with American English 2019
  `eng_us_2019` / `googlebooks-eng-us-20200217`; every fetched raw file and
  generated output must still record SHA-256 in the asset manifest.
- Data size: very large, partitioned by starting character and n-gram size.
  Typai must transform only pinned unigram inputs into a compact top-N table.
- Language coverage: multiple corpora including English, American English,
  British English, English Fiction, and others.
- Frequency included: yes, via n-gram counts/time series.
- Deterministic transform/build script possible: yes. A future script can fetch
  pinned 1-gram files, filter to alphabetic lowercase tokens, aggregate selected
  years, intersect with the approved dictionary source, normalize into compact
  integer scores, and emit Typai Dictionary Blob v1 metadata.
- Risks:
  - Book corpus is not the same as modern editor, chat, or code-adjacent prose.
  - OCR, tokenization, metadata, and part-of-speech errors are documented risks.
  - The raw corpus is huge and must stay out of Git and package tarballs.
  - Attribution should be included even though the official page phrases it as
    appreciated.
- Recommendation: **accept** as the first production frequency source, with
  actual asset ingestion blocked until exact file hashes, transform script,
  attribution, size evidence, and review signoff exist.

### 6. wordfreq

- Name: `wordfreq`.
- Official source URL: https://pypi.org/project/wordfreq/ and
  https://github.com/rspeer/wordfreq
- Maintainer/project: Robyn Speer / `rspeer/wordfreq`.
- Asset type: multi-source frequency package.
- License: PyPI metadata lists Apache-2.0 for the package. Project
  documentation says included data files may be redistributed under Creative
  Commons Attribution-ShareAlike 4.0 and include multiple source-specific
  attribution obligations.
- Redistribution allowed: yes under documented obligations, but not selected for
  Typai's first bundled/transformed frequency asset.
- Commercial use allowed: likely yes under Apache-2.0 and CC BY-SA 4.0, but
  ShareAlike and source-specific terms require legal/product review.
- Modification allowed: yes under relevant licenses, with ShareAlike concerns
  for adapted redistributed data.
- Attribution required: yes, including wordfreq and its source corpora.
- Current maintenance status/date: PyPI latest version `3.1.1`, released
  November 21, 2023. README says data is a snapshot through about 2021 and is
  unlikely to be updated again.
- Source version or release hash: none selected.
- Data size: small and large wordlists; English large covers lower-frequency
  words than the small list.
- Language coverage: over 40 languages; English supported.
- Frequency included: yes.
- Deterministic transform/build script possible: yes technically, but the
  project explicitly discourages CSV-style extraction without bundled
  attribution/license context.
- Risks:
  - CC BY-SA obligations and multi-source provenance are too complex for the
    first Typai npm asset.
  - Source mix includes Wikipedia, subtitles, news, books, web, Twitter, Reddit,
    and other domains.
  - Transforming out a standalone table could lose attribution/license context.
- Recommendation: **blocked pending legal/license review**; do not use as the
  first production frequency source.

### 7. wordfreq-en-25000 Dump

- Name: `aparrish/wordfreq-en-25000`.
- Official source URL: https://github.com/aparrish/wordfreq-en-25000
- Maintainer/project: Allison Parrish.
- Asset type: frequency list exported from `wordfreq`.
- License: README says the data is CC BY-SA 4.0 according to wordfreq's
  license; helper script is public domain.
- Redistribution allowed: yes under CC BY-SA 4.0.
- Commercial use allowed: yes under CC BY-SA 4.0, with ShareAlike obligations.
- Modification allowed: yes under CC BY-SA 4.0.
- Attribution required: yes.
- Current maintenance status/date: one-commit convenience dump; no releases.
- Source version or release hash: none selected.
- Data size: 25,000 English words plus log frequency values.
- Language coverage: English only.
- Frequency included: yes.
- Deterministic transform/build script possible: yes technically, but it is a
  derivative dump, not an authoritative maintained asset pipeline.
- Risks:
  - Inherits wordfreq provenance and ShareAlike complexity.
  - Not actively maintained as a source pipeline.
  - README says no filtering was done for offensive or inappropriate words.
- Recommendation: **reject** for Typai production assets.

### 8. 12dicts

- Name: 12dicts word lists.
- Official source URL: https://wordlist.aspell.net/12dicts-readme/
- Maintainer/project: Alan Beale, mirrored/documented through the ESDB site.
- Asset type: word lists, including common-word and frequency-oriented lists.
- License: primary lists are explicitly released to the public domain with
  requested acknowledgement; some inflected/lemmatized lists inherit AGID/source
  constraints.
- Redistribution allowed: yes for public-domain lists; inherited-source lists
  need separate review.
- Commercial use allowed: yes for public-domain lists.
- Modification allowed: yes for public-domain lists.
- Attribution required: acknowledgement requested.
- Current maintenance status/date: release 6.0.2 from June 2016; mostly stable
  rather than actively maintained.
- Source version or release hash: `6.0.2`; no Typai source pin selected.
- Data size: varies by list, from small common lists to larger inflected lists.
- Language coverage: English, with American and international variants depending
  on list.
- Frequency included: limited; some lemmatized/frequency-oriented lists exist
  but are not a modern broad frequency source.
- Deterministic transform/build script possible: yes.
- Risks:
  - Stale compared with ESDB, which already incorporates 12dicts lineage.
  - Some lists inherit AGID/source obligations and are not public domain.
  - Not sufficient as Typai's primary production speller or frequency source.
- Recommendation: **maybe** as a future supplemental test corpus, **reject** as
  the first production source because ESDB is the maintained upstream choice.

### 9. Wordnik Wordlist

- Name: Wordnik Wordlist.
- Official source URL: https://github.com/wordnik/wordlist
- Maintainer/project: Wordnik.
- Asset type: word list.
- License: MIT.
- Redistribution allowed: yes, with MIT notice.
- Commercial use allowed: yes, with MIT notice.
- Modification allowed: yes, with MIT notice.
- Attribution required: yes, preserve the MIT notice.
- Current maintenance status/date: repository has no published releases; main
  word list file is dated `20210729`.
- Source version or release hash: no release selected.
- Data size: one word list text file; full Wordnik data with definitions,
  frequency, and labels is a paid dataset, not this open list.
- Language coverage: English words commonly used in word games.
- Frequency included: no in the open wordlist.
- Deterministic transform/build script possible: yes.
- Risks:
  - Word-game scope is not a production spellcheck dictionary.
  - No frequency data in the open repository.
  - No releases or strong source-version process.
- Recommendation: **maybe** for tests or examples, **reject** for first
  production dictionary/frequency source.

### 10. Open English WordNet

- Name: Open English WordNet.
- Official source URL: https://en-word.net/ and
  https://github.com/globalwordnet/english-wordnet
- Maintainer/project: Global WordNet Association / Open English WordNet team.
- Asset type: lexical network.
- License: CC BY 4.0.
- Redistribution allowed: yes with attribution.
- Commercial use allowed: yes with attribution.
- Modification allowed: yes with attribution.
- Attribution required: yes.
- Current maintenance status/date: active. GitHub lists 2025 Edition released
  December 31, 2025.
- Source version or release hash: 2025 Edition if ever used; no Typai source pin
  selected.
- Data size: 2025 core reports 135,969 words and 107,519 synsets; 2025+ reports
  161,875 words and 120,564 synsets.
- Language coverage: English lexical network.
- Frequency included: no.
- Deterministic transform/build script possible: yes, but it is not a spelling
  wordlist.
- Risks:
  - Lemma/synset resource, not optimized for spelling acceptance.
  - May omit inflected forms Typai needs or include lemmas that are poor
    spellcheck-valid tokens.
  - No frequency data.
- Recommendation: **reject** as a primary V1 speller/frequency asset; maybe as
  a future supplemental lexical source.

## Approved Source Attribution Drafts

If ESDB/SCOWL output is bundled after manifest signoff, include at least:

```text
This product includes an English wordlist generated from the English Speller
Database / SCOWL by Kevin Atkinson.
Source: https://wordlist.aspell.net/ and https://github.com/en-wl/wordlist
Copyright 2000-2026 by Kevin Atkinson.
The applicable permission notice is included with this package.
```

If Google Books Ngram-derived frequencies are bundled after manifest signoff,
include at least:

```text
This product includes frequency scores derived from Google Books Ngram Viewer
data.
Source: https://books.google.com/ngrams
Corpus: American English 2019, googlebooks-eng-us-20200217.
Google Books Ngram Viewer is acknowledged as the source.
```

The final attribution file must include full applicable notices, not only these
short drafts.

## Final Recommendation

Use **ESDB/SCOWL v2** as the production dictionary source and **Google Books
Ngram Viewer American English 2019 unigrams** as the first production frequency
source.

Do not bundle generated assets yet. Prompt 101 should implement the manifest-
gated pipeline and host-provided or scaled mock loading path first. The first
asset ingestion PR must prove source pins, hashes, attribution, deterministic
transforms, size budget, and quality gates before any production binary or
frequency table enters the package.
