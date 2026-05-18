#pragma once

namespace typai {

struct DictionaryEntry {
  const char* word;
  unsigned int len;
};

constexpr DictionaryEntry kKnownValidWords[] = {
    {"the", 3},
    {"and", 3},
    {"receipt", 7},
    {"recipe", 6},
    {"receive", 7},
    {"address", 7},
    {"spelling", 8},
    {"correction", 10},
    {"correct", 7},
    {"because", 7},
    {"their", 5},
    {"there", 5},
    {"form", 4},
    {"from", 4},
    {"lead", 4},
    {"led", 3},
    {"to", 2},
    {"too", 3},
    {"its", 3},
    {"it's", 4},
    {"hello", 5},
    {"world", 5},
    {"typing", 6},
    {"test", 4},
    {"message", 7},
    {"prompt", 6},
    {"code", 4},
    {"this", 4},
    {"is", 2},
    {"a", 1},
    {"simple", 6},
    {"word", 4},
    {"user", 4},
    {"home", 4},
    {"nmap", 4},
    {"sqlmap", 6},
    {"cve", 3},
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
