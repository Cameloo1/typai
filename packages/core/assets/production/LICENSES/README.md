# Production Asset License Placeholder

Status: blocked. This directory intentionally contains no approved production
license bundle yet because no production dictionary or frequency asset is
generated or bundled.

## Dictionary Candidate

- Source: English Speller Database / SCOWL v2 generated Hunspell `en_US`.
- Official project: English Speller Database / SCOWL by Kevin Atkinson.
- Release: `2026.02.25`, tag `rel-2026.02.25`, commit `7e99eda`.
- Official source file:
  `https://github.com/en-wl/wordlist/releases/download/rel-2026.02.25/hunspell-en_US-2026.02.25.zip`.
- Candidate ZIP SHA-256:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`.
- Candidate ZIP size: 187,271 bytes.
- Notice URL:
  `https://raw.githubusercontent.com/en-wl/wordlist/v2/Copyright`.

The checked upstream notice permits use, copy, modification, distribution, and
sale of ESDB/SCOWL or word lists created from it when the copyright and
permission notices are preserved. Official non-Australian speller dictionaries
do not require the extra Australian, UKACD, or WordNet notice blocks according
to the same upstream notice. If future transform logic uses affix-derived
material, the en_US Hunspell affix-file notice must also be preserved.

## Frequency Candidate

- Source: Google Books Ngram Viewer American English 2019 1-grams.
- Version: `googlebooks-eng-us-20200217`.
- Export index:
  `https://storage.googleapis.com/books/ngrams/books/20200217/eng-us/eng-us-1-ngrams_exports.html`.
- License: Creative Commons Attribution 3.0 Unported.
- License URL: `https://creativecommons.org/licenses/by/3.0/`.
- Pinned hash status: `totalcounts-1` is pinned, but the 14 gzip partition
  SHA-256 values are not captured.

The export page identifies the compilation as CC BY 3.0. The final production
asset prompt must include package-visible attribution, license link, change
notice, source hashes for every raw partition, generated output hash, generated
size evidence, and review signoff before generated frequency output can be
packed.

## Current Package Rule

This placeholder does not imply license approval for a bundled asset. Raw
source files and generated production language assets remain excluded from Git
and package tarballs while the production manifest review status is blocked.
