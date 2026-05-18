# Dictionary And Frequency Source Selection

Research date: 2026-05-17

This document records the Public Alpha Readiness source review for Typai's
future production English dictionary and frequency assets. It is not legal
advice. No production dictionary or frequency asset is bundled by this review.

## Decision

Preferred dictionary candidate: **English Speller Database / SCOWL v2**, using a
generated `en-US` speller wordlist at ESDB size 60 first, with size 70 considered
only after false-positive testing.

Preferred frequency candidate: **Google Books Ngram unigram data**, transformed
into compact per-word scores only after an attribution file and deterministic
build script are reviewed.

Production asset integration status: **blocked pending final license and
attribution review**. The candidates look usable enough to plan against, but no
production asset should be committed, packaged, published, or shipped until the
asset PR includes:

- pinned source URLs and retrieval dates
- copied license/notice files
- exact attribution text
- deterministic transform script
- generated manifest with source version, filters, counts, and hashes

## Candidate Evaluation

### 1. English Speller Database / SCOWL v2

- Name: English Speller Database, previously SCOWLv2 / SCOWL.
- Official source URL: https://wordlist.aspell.net/ and
  https://github.com/en-wl/wordlist
- Maintainer/project: Kevin Atkinson / `en-wl/wordlist`.
- Asset type: dictionary source database, plain wordlists, Aspell dictionaries,
  Hunspell dictionaries; includes commonness/size metadata.
- License: MIT-like notice license for ESDB/SCOWLv2 and generated wordlists,
  with special copyright sections for Australian spelling, UKACD-derived words,
  and WordNet-derived POS assignment depending on what is distributed.
- Redistribution allowed: yes, with required copyright and permission notices.
- Commercial use allowed: yes, source grants use, copy, modify, distribute, and
  sell with notice preservation.
- Attribution required: yes, preserve Kevin Atkinson copyright and permission
  notice; include any applicable AU, UKACD, and WordNet notices if those portions
  are used.
- Modification allowed: yes, with notices preserved.
- Current maintenance status/date: active. The speller dictionary page lists
  latest release `2026.02.25`; ESDB itself is described as still stabilizing, so
  generated dictionaries are safer than relying on unstable internal schema.
- Data size: configurable by dialect, size, and variant. Default Hunspell
  dictionaries correspond to ESDB size 60; large dictionaries correspond to size
  70.
- Language coverage: English dialects, including American, Canadian, Australian,
  British variants, and plain wordlists.
- Frequency included: not exact corpus frequency. ESDB has word commonness/size
  metadata that can be used as a coarse prior but should not be treated as a
  frequency corpus.
- Transformation/build script possible: yes. Use official tooling to export an
  `en-US` wordlist such as size 60 with selected variant policy, then compile it
  to Typai Dictionary Blob v1.
- Risks:
  - ESDB database/API is still described as work in progress.
  - COCA 3-gram data appears in provenance; keep notices and legal review
    attached.
  - Large size 70 includes more uncommon valid words and can increase
    false-negative typo behavior.
  - New word screening may use LLMs as one input upstream, so future updates
    should be reviewed for provenance-sensitive changes.
- Recommendation: **accept as preferred dictionary source, blocked pending final
  asset PR review**.

### 2. ESDB-Generated Hunspell English Dictionaries

- Name: ESDB/SCOWL-generated Hunspell English dictionaries.
- Official source URL: https://wordlist.aspell.net/dicts/ and
  https://github.com/en-wl/wordlist/releases
- Maintainer/project: Kevin Atkinson / English Speller Database.
- Asset type: Hunspell `.aff` / `.dic`.
- License: ESDB/SCOWL notice license for dictionaries plus affix-file lineage
  from Ispell/BSD-style sources.
- Redistribution allowed: yes, with notices.
- Commercial use allowed: yes, with notices.
- Attribution required: yes, same notice obligations as ESDB/SCOWL and affix
  file credits.
- Modification allowed: yes.
- Current maintenance status/date: active; latest Hunspell release listed as
  `2026.02.25`.
- Data size: default dictionaries are size 60; large dictionaries are size 70.
- Language coverage: en_US, en_CA, en_AU, British variants, large variants.
- Frequency included: no exact frequency data; Hunspell flags are morphology and
  suggestion metadata, not Typai ranking frequency.
- Transformation/build script possible: yes, but Typai does not need Hunspell
  runtime behavior. A build script could parse `.dic` entries if direct ESDB
  export is inconvenient.
- Risks:
  - `.aff` morphology is richer than Typai's current token engine and could
    introduce scope creep.
  - `.dic` entries include flags that must be stripped or explicitly modeled.
  - Large variants can admit uncommon words that Typai should keep conservative.
- Recommendation: **maybe**. Useful fallback if direct ESDB export is not stable,
  but not preferred over direct ESDB/plain wordlist export.

### 3. LibreOffice English Hunspell Dictionaries

- Name: LibreOffice bundled English dictionaries.
- Official source URL: https://github.com/LibreOffice/dictionaries/tree/master/en
  and https://www.libreoffice.org/licenses/
- Maintainer/project: LibreOffice dictionaries / The Document Foundation.
- Asset type: Hunspell `.aff` / `.dic` bundled for LibreOffice.
- License: mixed. LibreOffice itself is MPL-2.0, but bundled assets vary. The
  current `en/license.txt` in the LibreOffice dictionary tree is GPL text, while
  the English README says the English dictionaries derive from SCOWL and include
  Ispell/BSD lineage.
- Redistribution allowed: likely, but exact per-file licensing must be resolved.
- Commercial use allowed: likely under open-source terms, but the mixed package
  licensing is a compatibility risk for broad npm distribution.
- Attribution required: yes.
- Modification allowed: yes under applicable source licenses.
- Current maintenance status/date: repository is active, but the `en_US` README
  checked in the LibreOffice tree reports version `2020.12.07`.
- Data size: Hunspell dictionary files; exact size depends on selected locale.
- Language coverage: many languages; English variants under `en/`.
- Frequency included: no.
- Transformation/build script possible: yes, but not attractive for Typai because
  the source is a downstream packaged dictionary.
- Risks:
  - Mixed licenses inside LibreOffice distribution.
  - Potential GPL/copyleft compatibility risk if the exact file license is taken
    from LibreOffice's packaged `license.txt`.
  - Not a frequency source.
- Recommendation: **reject for production Typai asset** unless legal review
  proves a specific English file path is permissive and preferable to ESDB
  upstream. Use ESDB upstream instead.

### 4. Apache OpenOffice / Mozilla English Dictionary Variants

- Name: Marco A.G.Pinto / aoo-mozilla-en-dict and Firefox dictionary packages.
- Official source URL: https://extensions.openoffice.org/en/project/english-dictionaries-apache-openoffice,
  https://addons.mozilla.org/en-US/firefox/addon/us-english-dictionary/, and
  https://github.com/marcoagpinto/aoo-mozilla-en-dict
- Maintainer/project: Marco A.G.Pinto and downstream Firefox/OpenOffice package
  maintainers.
- Asset type: Hunspell dictionaries and browser/office extensions.
- License: current Firefox add-on page lists LGPL-3.0-only. OpenOffice extension
  page lists active dictionary releases but does not make a clean npm-friendly
  asset license obvious from the listing.
- Redistribution allowed: likely under LGPL terms for that add-on package.
- Commercial use allowed: likely under LGPL terms, but obligations are not ideal
  for embedding transformed data in a broad npm package without legal review.
- Attribution required: yes.
- Modification allowed: yes under applicable license.
- Current maintenance status/date: active. Firefox add-on version `2026.5.1` was
  last updated May 9, 2026; OpenOffice extension page lists 2025 releases and
  says some dictionaries will be maintained in 2026.
- Data size: extension package around hundreds of KB for the Firefox en-US
  package; varies by bundled language set.
- Language coverage: English variants for office/browser spellchecking.
- Frequency included: no.
- Transformation/build script possible: technically yes, but not recommended.
- Risks:
  - LGPL-3.0-only package status is heavier than Typai needs.
  - Downstream browser/office extension packaging is not the canonical source for
    Typai's deterministic engine.
  - No frequency metadata.
- Recommendation: **reject for production Typai asset**. Useful reference for
  user expectations and coverage, not as bundled data.

### 5. wordfreq

- Name: `wordfreq`.
- Official source URL: https://pypi.org/project/wordfreq/ and
  https://github.com/rspeer/wordfreq
- Maintainer/project: Robyn Speer / `rspeer/wordfreq`.
- Asset type: frequency package; multi-source word frequency estimates.
- License: package metadata says Apache-2.0, but project documentation says data
  files may be redistributed under CC BY-SA 4.0 and includes multiple attributed
  data sources.
- Redistribution allowed: yes with license and attribution obligations.
- Commercial use allowed: Apache-2.0 and CC BY-SA permit commercial use, but
  ShareAlike obligations require legal/product review for an npm-distributed
  transformed asset.
- Attribution required: yes; includes wordfreq, Google Books Ngrams, Wikipedia,
  Leeds Internet Corpus, ParaCrawl, OpenSubtitles, SUBTLEX authors, and other
  cited sources as applicable.
- Modification allowed: yes under the relevant licenses; ShareAlike may apply to
  redistributed adapted data.
- Current maintenance status/date: latest PyPI version `3.1.1`, released
  November 21, 2023.
- Data size: provides small and large wordlists; large lists cover words down to
  lower frequency thresholds for supported languages.
- Language coverage: over 40 languages; English supported.
- Frequency included: yes, Zipf/frequency scores and ranked APIs.
- Transformation/build script possible: yes, but pulling transformed data out of
  the package would need a precise attribution and ShareAlike compliance plan.
- Risks:
  - CC BY-SA data obligations may be incompatible with Typai's desired npm
    package simplicity.
  - Multi-source provenance is complex.
  - Twitter/OpenSubtitles/SUBTLEX provenance requires careful attribution review.
- Recommendation: **blocked pending legal/license review**. Strong quality
  candidate, but not selected as the first production bundled frequency source.

### 6. wordfreq-en-25000 Dump

- Name: `aparrish/wordfreq-en-25000`.
- Official source URL: https://github.com/aparrish/wordfreq-en-25000
- Maintainer/project: Allison Parrish.
- Asset type: frequency list exported from `wordfreq`.
- License: README says the data is CC BY-SA 4.0 in accordance with wordfreq's
  license; helper script is public domain.
- Redistribution allowed: yes under CC BY-SA 4.0.
- Commercial use allowed: yes under CC BY-SA 4.0, with ShareAlike obligations.
- Attribution required: yes.
- Modification allowed: yes under CC BY-SA 4.0.
- Current maintenance status/date: one-commit convenience dump; no releases.
- Data size: 25,000 English words plus log frequency values.
- Language coverage: English only.
- Frequency included: yes.
- Transformation/build script possible: yes, but it is a derivative convenience
  dump, not an authoritative source pipeline.
- Risks:
  - Inherits wordfreq's provenance and ShareAlike complexity.
  - Small, informal, and not actively maintained.
  - README explicitly says no filtering was done for offensive/inappropriate
    words.
- Recommendation: **reject**. Do not use as a production asset.

### 7. Google Books Ngram

- Name: Google Books Ngram Viewer data.
- Official source URL: https://books.google.com/ngrams/info
- Maintainer/project: Google Books Ngram Viewer team.
- Asset type: n-gram corpus data; can be transformed into unigram frequency
  scores.
- License: official page says Ngram Viewer graphs and data may be freely used
  for any purpose, with acknowledgement and link appreciated.
- Redistribution allowed: appears allowed by the official Ngram Viewer terms.
- Commercial use allowed: appears allowed by the official Ngram Viewer terms.
- Attribution required: acknowledgement is described as appreciated; Typai
  should still include attribution.
- Modification allowed: transformed frequency extraction appears allowed by the
  same reuse language.
- Current maintenance status/date: official documentation lists 2009, 2012,
  2019, and quarterly released corpora; persistent identifiers are available for
  the 2009, 2012, and 2019 English corpora.
- Data size: very large; files are partitioned by starting letter and n-gram
  size. Typai should transform only English unigrams into a compact top-N score
  table.
- Language coverage: multiple corpora including English, American English,
  British English, English Fiction, and others.
- Frequency included: yes, via n-gram counts/time series; Typai must aggregate
  and normalize deterministically.
- Transformation/build script possible: yes. A production script can fetch
  pinned unigram files, filter to alphabetic lowercase tokens, optionally combine
  years/corpora, intersect with ESDB accepted words, and emit Typai Dictionary
  Blob v1 frequencies.
- Risks:
  - Book corpus is not the same as modern editor/chat/code-adjacent writing.
  - OCR and metadata issues exist, especially older texts.
  - Dataset is huge and needs careful caching/build infrastructure.
  - Attribution should be included even if phrased as appreciated.
- Recommendation: **accept as preferred initial frequency source, blocked
  pending final attribution and transform-script review**.

### 8. Wikipedia Word Frequency Generator

- Name: `IlyaSemenov/wikipedia-word-frequency`.
- Official source URL: https://github.com/IlyaSemenov/wikipedia-word-frequency
- Maintainer/project: Ilya Semenov.
- Asset type: frequency generator and pre-generated frequency lists from
  Wikipedia dumps.
- License: repository is MIT, but generated data is derived from English
  Wikipedia dumps, whose upstream text licensing must be handled separately.
- Redistribution allowed: blocked until upstream Wikipedia-derived-data
  obligations are analyzed.
- Commercial use allowed: blocked pending license review.
- Attribution required: likely, because Wikipedia content is not MIT simply
  because a script repository is MIT.
- Modification allowed: blocked pending upstream license review.
- Current maintenance status/date: README says April 2023 enwiki processing and
  reports 2,747,823 English unique words in the pre-generated output; no GitHub
  releases.
- Data size: large; English output is millions of unique words.
- Language coverage: multiple Wikipedia languages.
- Frequency included: yes.
- Transformation/build script possible: yes, but requires Wikimedia dump
  attribution/license handling and heavy processing.
- Risks:
  - Repository license may cover code, not generated Wikipedia-derived data.
  - Wikipedia style is encyclopedic and proper-noun heavy.
  - Very large vocabulary would need aggressive filtering to avoid valid-word
    autocorrection regressions.
- Recommendation: **blocked/reject for first production frequency asset**.

### 9. Open English WordNet

- Name: Open English WordNet.
- Official source URL: https://github.com/globalwordnet/english-wordnet and
  https://en-word.net/
- Maintainer/project: Global WordNet Association / Open English WordNet team.
- Asset type: lexical network; dictionary-like vocabulary with synsets and
  relations.
- License: CC BY 4.0.
- Redistribution allowed: yes with attribution.
- Commercial use allowed: yes with attribution.
- Attribution required: yes.
- Modification allowed: yes under CC BY 4.0.
- Current maintenance status/date: active; README lists 2025 Edition released
  December 31, 2025.
- Data size: 2025 core reports 135,969 words and 107,519 synsets; 2025+ reports
  161,875 words and 120,564 synsets.
- Language coverage: English lexical network.
- Frequency included: no.
- Transformation/build script possible: yes, but it is not a spelling wordlist.
- Risks:
  - Lemma/synset resource, not optimized for spellchecking.
  - May omit inflected forms Typai needs or include terms that are poor
    spellcheck-valid words.
  - No frequency data.
- Recommendation: **maybe as future supplemental lexical source, reject for V1
  production speller/frequency asset**.

## Attribution Drafts

If ESDB/SCOWL is bundled, include an attribution file with at least:

```text
This product includes an English wordlist generated from the English Speller
Database / SCOWL by Kevin Atkinson.
Source: https://wordlist.aspell.net/ and https://github.com/en-wl/wordlist
Copyright 2000-2026 by Kevin Atkinson.
Permission notice and applicable source notices are included with this package.
```

If Google Books Ngram-derived frequencies are bundled, include at least:

```text
This product includes frequency scores derived from Google Books Ngram Viewer
data.
Source: https://books.google.com/ngrams
Google Books Ngram Viewer data is acknowledged as the source.
```

The final attribution file must include the full applicable notices, not only
these short drafts.

## Final Recommendation

Use **ESDB/SCOWL v2** as the production dictionary source candidate and
**Google Books Ngram unigram data** as the first production frequency source
candidate.

Do not bundle either yet. The next implementation prompt should create a
license-gated asset pipeline that can build a local generated asset and emit a
manifest, while keeping the production asset itself out of Git until the final
license/attribution review is accepted.
