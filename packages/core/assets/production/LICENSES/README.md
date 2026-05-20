# Production Asset License Placeholders

Status: blocked. No production dictionary or frequency asset is bundled here.

## Dictionary Candidate

- Source: English Speller Database / SCOWL v2 generated Hunspell `en_US`.
- Release: `2026.02.25` / `[7e99eda]`.
- Official file:
  `https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip`.
- Notice URL: `https://raw.githubusercontent.com/en-wl/wordlist/v2/Copyright`.
- Candidate ZIP SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.

The checked official notice permits use, copy, modification, distribution, and
sale of ESDB/SCOWL or word lists created from it when the copyright and
permission notice are preserved. The `en_US` Hunspell README also includes a
BSD-style notice for the affix file. The final production asset PR must commit
the full applicable package-visible notice text before package inclusion.

## Frequency Candidate

- Source: Google Books Ngram Viewer American English 2019 1-grams.
- Version: `20200217`.
- Export index:
  `https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html`.
- License: Creative Commons Attribution 3.0 Unported.
- License URL: `https://creativecommons.org/licenses/by/3.0/`.

Raw frequency partition SHA-256 values are not captured yet. The final
production asset PR must fetch the exact 1-gram partitions and `totalcounts-1`,
record SHA-256 for every raw input, and commit the final attribution and notice
text before any generated frequency output can be packaged.
