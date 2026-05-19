#pragma once

namespace typai {

struct DictionaryEntry {
  const char* word;
  unsigned int len;
  unsigned int frequency;
};

constexpr DictionaryEntry kKnownValidWords[] = {
    {"the", 3, 1000000},
    {"and", 3, 900000},
    {"to", 2, 850000},
    {"a", 1, 840000},
    {"is", 2, 820000},
    {"this", 4, 810000},
    {"from", 4, 800000},
    {"form", 4, 700000},
    {"because", 7, 250000},
    {"their", 5, 240000},
    {"there", 5, 230000},
    {"its", 3, 220000},
    {"it's", 4, 210000},
    {"lead", 4, 100000},
    {"led", 3, 90000},
    {"too", 3, 85000},
    {"receive", 7, 50000},
    {"receipt", 7, 45000},
    {"address", 7, 40000},
    {"addresses", 9, 39000},
    {"correction", 10, 35000},
    {"correct", 7, 34000},
    {"recipe", 6, 30000},
    {"spelling", 8, 30000},
    {"separate", 8, 28000},
    {"tomorrow", 8, 27000},
    {"definitely", 10, 26000},
    {"accommodate", 11, 25000},
    {"occurred", 8, 24000},
    {"until", 5, 23000},
    {"government", 10, 22000},
    {"environment", 11, 21000},
    {"argument", 8, 20000},
    {"calendar", 8, 19000},
    {"embarrass", 9, 18000},
    {"publicly", 8, 17000},
    {"necessary", 9, 16000},
    {"typing", 6, 20000},
    {"test", 4, 20000},
    {"message", 7, 20000},
    {"prompt", 6, 15000},
    {"code", 4, 14000},
    {"hello", 5, 12000},
    {"world", 5, 11000},
    {"simple", 6, 10000},
    {"word", 4, 9000},
    {"user", 4, 8000},
    {"home", 4, 7000},
    {"nmap", 4, 1000},
    {"sqlmap", 6, 900},
    {"kubectl", 7, 800},
    {"cve", 3, 500},
};

constexpr unsigned int kKnownValidWordsCount =
    sizeof(kKnownValidWords) / sizeof(kKnownValidWords[0]);

inline bool token_equals(const char* token, unsigned int token_len, const char* word, unsigned int word_len) {
  if (token_len != word_len) {
    return false;
  }

  for (unsigned int index = 0; index < token_len; ++index) {
    if (token[index] != word[index]) {
      return false;
    }
  }

  return true;
}

inline bool is_known_valid_word(const char* token, unsigned int token_len) {
  for (const DictionaryEntry& entry : kKnownValidWords) {
    if (token_equals(token, token_len, entry.word, entry.len)) {
      return true;
    }
  }

  return false;
}

}  // namespace typai
