#pragma once

namespace typai {

struct CommonTypo {
  const char* typo;
  unsigned int typo_len;
  const char* replacement;
  unsigned int replacement_len;
  bool expanded;
};

struct ReplacementView {
  const char* value;
  unsigned int len;
  bool expanded;
};

constexpr CommonTypo kCommonTypos[] = {
    // Source: Typai prompt 99 baseline plus prompt 103 explicitly reviewed
    // non-word typo candidates. No third-party corpus is embedded here.
    {"teh", 3, "the", 3, false},
    {"adn", 3, "and", 3, false},
    {"recieve", 7, "receive", 7, false},
    {"becuase", 7, "because", 7, false},
    {"thier", 5, "their", 5, false},
    {"adress", 6, "address", 7, true},
    {"speling", 7, "spelling", 8, true},
    {"corection", 9, "correction", 10, true},
    {"seperate", 8, "separate", 8, true},
    {"definitly", 9, "definitely", 10, true},
    {"accomodate", 10, "accommodate", 11, true},
    {"occured", 7, "occurred", 8, true},
    {"untill", 6, "until", 5, true},
    {"tommorow", 8, "tomorrow", 8, true},
    {"goverment", 9, "government", 10, true},
    {"enviroment", 10, "environment", 11, true},
    {"arguement", 9, "argument", 8, true},
    {"calender", 8, "calendar", 8, true},
    {"embarass", 8, "embarrass", 9, true},
    {"publically", 10, "publicly", 8, true},
    {"neccessary", 10, "necessary", 9, true},
};

inline ReplacementView common_typo_replacement(const char* token, unsigned int token_len) {
  for (const CommonTypo& entry : kCommonTypos) {
    if (token_equals(token, token_len, entry.typo, entry.typo_len)) {
      return {entry.replacement, entry.replacement_len, entry.expanded};
    }
  }

  return {nullptr, 0, false};
}

}  // namespace typai
