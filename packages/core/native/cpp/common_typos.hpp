#pragma once

namespace typai {

struct CommonTypo {
  const char* typo;
  unsigned int typo_len;
  const char* replacement;
  unsigned int replacement_len;
};

struct ReplacementView {
  const char* value;
  unsigned int len;
};

constexpr CommonTypo kCommonTypos[] = {
    {"teh", 3, "the", 3},
    {"adn", 3, "and", 3},
    {"recieve", 7, "receive", 7},
    {"becuase", 7, "because", 7},
    {"thier", 5, "their", 5},
};

inline ReplacementView common_typo_replacement(const char* token, unsigned int token_len) {
  for (const CommonTypo& entry : kCommonTypos) {
    if (token_equals(token, token_len, entry.typo, entry.typo_len)) {
      return {entry.replacement, entry.replacement_len};
    }
  }

  return {nullptr, 0};
}

}  // namespace typai
