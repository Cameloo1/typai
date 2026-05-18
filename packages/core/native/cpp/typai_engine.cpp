#include "typai_engine.hpp"

#include "dictionary.hpp"
#include "common_typos.hpp"

namespace typai {

constexpr double kCommonTypoConfidence = 0.99;
constexpr unsigned int kMaxEditDistance = 2;
constexpr unsigned int kMaxSuggestionTokenLen = 64;
constexpr unsigned int kMaxSuggestionCandidates = 256;
constexpr unsigned int kFrequencyScoreCap = 1000000;
constexpr unsigned int kDictionaryBlobVersion = 1;
constexpr unsigned int kDictionaryBlobHeaderLen = 24;
constexpr unsigned int kDictionaryBlobEntryLen = 14;
constexpr unsigned int kMaxDynamicDictionaryWords = 4096;
constexpr unsigned int kMaxDynamicDictionaryStringBytes = 65536;
constexpr unsigned int kMaxDynamicDictionaryTrieNodes = 32768;
constexpr char kDictionaryBlobMagic[] = {'T', 'Y', 'P', 'A', 'I', 'D', 'I', 'C'};

struct WordView {
  const char* word;
  unsigned int len;
  unsigned int frequency;
  unsigned int flags;
  bool dynamic;
};

struct SuggestionCandidate {
  WordView word;
  unsigned int distance;
  double score;
};

struct DynamicDictionaryEntry {
  unsigned int word_offset;
  unsigned int len;
  unsigned int frequency;
  unsigned int flags;
};

struct TrieNode {
  int children[26];
  unsigned int entry_index;
  bool terminal;
};

struct LoadedDictionary {
  char string_table[kMaxDynamicDictionaryStringBytes];
  DynamicDictionaryEntry entries[kMaxDynamicDictionaryWords];
  TrieNode trie[kMaxDynamicDictionaryTrieNodes];
  unsigned int string_table_len;
  unsigned int entry_count;
  unsigned int trie_count;
};

LoadedDictionary g_loaded_dictionary;
LoadedDictionary g_staging_dictionary;

void reset_outputs(
    char* replacement_out,
    unsigned int replacement_cap,
    double* confidence_out,
    unsigned int* reason_flags_out) {
  if (replacement_out != nullptr && replacement_cap > 0) {
    replacement_out[0] = '\0';
  }

  if (confidence_out != nullptr) {
    *confidence_out = 0.0;
  }

  if (reason_flags_out != nullptr) {
    *reason_flags_out = TYPAI_REASON_NONE;
  }
}

void set_confidence(double* confidence_out, double confidence) {
  if (confidence_out != nullptr) {
    *confidence_out = confidence;
  }
}

void set_reason_flags(unsigned int* reason_flags_out, unsigned int reason_flags) {
  if (reason_flags_out != nullptr) {
    *reason_flags_out = reason_flags;
  }
}

bool is_lowercase_ascii_alpha(char value) {
  return value >= 'a' && value <= 'z';
}

bool is_ascii_digit(char value) {
  return value >= '0' && value <= '9';
}

bool is_explicitly_protected_char(char value) {
  return is_ascii_digit(value) || value == '/' || value == ':' || value == '@' || value == '_' ||
         value == '-' || value == '.';
}

bool is_lowercase_alphabetic_token(const char* token, unsigned int token_len) {
  if (token_len == 0) {
    return false;
  }

  for (unsigned int index = 0; index < token_len; ++index) {
    const char value = token[index];
    if (!is_lowercase_ascii_alpha(value)) {
      return false;
    }
  }

  return true;
}

bool is_lowercase_ascii_word(const char* word, unsigned int word_len) {
  return is_lowercase_alphabetic_token(word, word_len);
}

const char* dynamic_word_ptr(const LoadedDictionary& dictionary, const DynamicDictionaryEntry& entry) {
  return dictionary.string_table + entry.word_offset;
}

void reset_trie_node(TrieNode& node) {
  for (unsigned int index = 0; index < 26; ++index) {
    node.children[index] = -1;
  }

  node.entry_index = 0;
  node.terminal = false;
}

void clear_loaded_dictionary_state(LoadedDictionary& dictionary) {
  dictionary.string_table_len = 0;
  dictionary.entry_count = 0;
  dictionary.trie_count = 0;
}

bool append_trie_node(LoadedDictionary& dictionary, int& node_index_out) {
  if (dictionary.trie_count >= kMaxDynamicDictionaryTrieNodes) {
    return false;
  }

  reset_trie_node(dictionary.trie[dictionary.trie_count]);
  node_index_out = static_cast<int>(dictionary.trie_count);
  dictionary.trie_count += 1;
  return true;
}

bool ensure_trie_root(LoadedDictionary& dictionary) {
  if (dictionary.trie_count > 0) {
    return true;
  }

  int root_index = 0;
  return append_trie_node(dictionary, root_index);
}

bool trie_insert(LoadedDictionary& dictionary, unsigned int entry_index) {
  if (entry_index >= dictionary.entry_count || !ensure_trie_root(dictionary)) {
    return false;
  }

  const DynamicDictionaryEntry& entry = dictionary.entries[entry_index];
  const char* word = dynamic_word_ptr(dictionary, entry);
  int node_index = 0;

  for (unsigned int index = 0; index < entry.len; ++index) {
    const char value = word[index];

    if (!is_lowercase_ascii_alpha(value)) {
      return false;
    }

    const unsigned int child_index = static_cast<unsigned int>(value - 'a');
    int next_node_index = dictionary.trie[static_cast<unsigned int>(node_index)].children[child_index];

    if (next_node_index < 0) {
      if (!append_trie_node(dictionary, next_node_index)) {
        return false;
      }

      dictionary.trie[static_cast<unsigned int>(node_index)].children[child_index] = next_node_index;
    }

    node_index = next_node_index;
  }

  TrieNode& node = dictionary.trie[static_cast<unsigned int>(node_index)];

  if (node.terminal) {
    return false;
  }

  node.terminal = true;
  node.entry_index = entry_index;
  return true;
}

const DynamicDictionaryEntry* find_dynamic_dictionary_entry(
    const LoadedDictionary& dictionary,
    const char* token,
    unsigned int token_len) {
  if (dictionary.trie_count == 0 || !is_lowercase_alphabetic_token(token, token_len)) {
    return nullptr;
  }

  int node_index = 0;

  for (unsigned int index = 0; index < token_len; ++index) {
    const unsigned int child_index = static_cast<unsigned int>(token[index] - 'a');
    node_index = dictionary.trie[static_cast<unsigned int>(node_index)].children[child_index];

    if (node_index < 0) {
      return nullptr;
    }
  }

  const TrieNode& node = dictionary.trie[static_cast<unsigned int>(node_index)];

  if (!node.terminal || node.entry_index >= dictionary.entry_count) {
    return nullptr;
  }

  return &dictionary.entries[node.entry_index];
}

bool is_dynamic_dictionary_word(const char* token, unsigned int token_len) {
  return find_dynamic_dictionary_entry(g_loaded_dictionary, token, token_len) != nullptr;
}

bool is_any_known_valid_word(const char* token, unsigned int token_len, bool* dynamic_match_out) {
  if (dynamic_match_out != nullptr) {
    *dynamic_match_out = false;
  }

  if (is_dynamic_dictionary_word(token, token_len)) {
    if (dynamic_match_out != nullptr) {
      *dynamic_match_out = true;
    }

    return true;
  }

  return is_known_valid_word(token, token_len);
}

bool is_protected_looking_token(const char* token, unsigned int token_len) {
  for (unsigned int index = 0; index < token_len; ++index) {
    const char value = token[index];
    if (is_explicitly_protected_char(value)) {
      return true;
    }

    if (!is_lowercase_ascii_alpha(value)) {
      return true;
    }
  }

  return false;
}

unsigned int write_replacement(
    ReplacementView replacement,
    char* replacement_out,
    unsigned int replacement_cap) {
  if (replacement_out == nullptr || replacement_cap == 0) {
    return TYPAI_REASON_REPLACEMENT_TRUNCATED;
  }

  const unsigned int writable_len = replacement_cap - 1;
  const bool truncated = replacement.len > writable_len;
  const unsigned int copy_len = truncated ? writable_len : replacement.len;

  for (unsigned int index = 0; index < copy_len; ++index) {
    replacement_out[index] = replacement.value[index];
  }

  replacement_out[copy_len] = '\0';

  return truncated ? TYPAI_REASON_REPLACEMENT_TRUNCATED : TYPAI_REASON_NONE;
}

unsigned int min_uint(unsigned int left, unsigned int right) {
  return left < right ? left : right;
}

unsigned int abs_diff_uint(unsigned int left, unsigned int right) {
  return left > right ? left - right : right - left;
}

int compare_words(
    const char* left,
    unsigned int left_len,
    const char* right,
    unsigned int right_len) {
  const unsigned int min_len = min_uint(left_len, right_len);

  for (unsigned int index = 0; index < min_len; ++index) {
    if (left[index] < right[index]) {
      return -1;
    }

    if (left[index] > right[index]) {
      return 1;
    }
  }

  if (left_len < right_len) {
    return -1;
  }

  if (left_len > right_len) {
    return 1;
  }

  return 0;
}

unsigned int levenshtein_distance_bounded(
    const char* token,
    unsigned int token_len,
    const char* word,
    unsigned int word_len,
    unsigned int max_distance) {
  if (token_len > kMaxSuggestionTokenLen || word_len > kMaxSuggestionTokenLen) {
    return max_distance + 1;
  }

  if (abs_diff_uint(token_len, word_len) > max_distance) {
    return max_distance + 1;
  }

  unsigned int previous[kMaxSuggestionTokenLen + 1] = {};
  unsigned int current[kMaxSuggestionTokenLen + 1] = {};

  for (unsigned int column = 0; column <= word_len; ++column) {
    previous[column] = column;
  }

  for (unsigned int row = 1; row <= token_len; ++row) {
    current[0] = row;
    unsigned int row_min = current[0];

    for (unsigned int column = 1; column <= word_len; ++column) {
      const unsigned int substitution_cost = token[row - 1] == word[column - 1] ? 0 : 1;
      const unsigned int deletion_cost = previous[column] + 1;
      const unsigned int insertion_cost = current[column - 1] + 1;
      const unsigned int substitution = previous[column - 1] + substitution_cost;
      const unsigned int best = min_uint(min_uint(deletion_cost, insertion_cost), substitution);

      current[column] = best;
      row_min = min_uint(row_min, best);
    }

    if (row_min > max_distance) {
      return max_distance + 1;
    }

    for (unsigned int column = 0; column <= word_len; ++column) {
      previous[column] = current[column];
    }
  }

  return previous[word_len];
}

double score_candidate(unsigned int distance, unsigned int frequency) {
  const double distance_component = static_cast<double>(kMaxEditDistance + 1 - distance) * 2.0;
  const double frequency_component =
      static_cast<double>(min_uint(frequency, kFrequencyScoreCap)) /
      static_cast<double>(kFrequencyScoreCap);

  return distance_component + frequency_component;
}

bool candidate_precedes(const SuggestionCandidate& left, const SuggestionCandidate& right) {
  if (left.distance != right.distance) {
    return left.distance < right.distance;
  }

  if (left.word.frequency != right.word.frequency) {
    return left.word.frequency > right.word.frequency;
  }

  return compare_words(left.word.word, left.word.len, right.word.word, right.word.len) < 0;
}

void insert_sorted_candidate(
    SuggestionCandidate* candidates,
    unsigned int& candidate_count,
    unsigned int candidate_cap,
    SuggestionCandidate candidate) {
  if (candidate_count >= candidate_cap) {
    return;
  }

  unsigned int index = candidate_count;
  candidate_count += 1;
  candidates[index] = candidate;

  while (index > 0 && candidate_precedes(candidates[index], candidates[index - 1])) {
    const SuggestionCandidate previous = candidates[index - 1];
    candidates[index - 1] = candidates[index];
    candidates[index] = previous;
    index -= 1;
  }
}

void maybe_collect_candidate(
    const char* token,
    unsigned int token_len,
    WordView word,
    SuggestionCandidate* candidates,
    unsigned int& candidate_count,
    unsigned int candidate_cap) {
  if (token_equals(token, token_len, word.word, word.len)) {
    return;
  }

  const unsigned int distance = levenshtein_distance_bounded(
      token, token_len, word.word, word.len, kMaxEditDistance);

  if (distance <= kMaxEditDistance) {
    insert_sorted_candidate(
        candidates,
        candidate_count,
        candidate_cap,
        {word, distance, score_candidate(distance, word.frequency)});
  }
}

unsigned int collect_suggestion_candidates(
    const char* token,
    unsigned int token_len,
    SuggestionCandidate* candidates,
    unsigned int candidate_cap) {
  if (candidates == nullptr || candidate_cap == 0 || !is_lowercase_alphabetic_token(token, token_len)) {
    return 0;
  }

  unsigned int candidate_count = 0;

  for (unsigned int index = 0; index < g_loaded_dictionary.entry_count; ++index) {
    const DynamicDictionaryEntry& entry = g_loaded_dictionary.entries[index];
    maybe_collect_candidate(
        token,
        token_len,
        {
            dynamic_word_ptr(g_loaded_dictionary, entry),
            entry.len,
            entry.frequency,
            entry.flags,
            true,
        },
        candidates,
        candidate_count,
        candidate_cap);
  }

  for (unsigned int index = 0; index < kKnownValidWordsCount; ++index) {
    const DictionaryEntry& entry = kKnownValidWords[index];

    if (is_dynamic_dictionary_word(entry.word, entry.len)) {
      continue;
    }

    maybe_collect_candidate(
        token,
        token_len,
        {entry.word, entry.len, 0, 0, false},
        candidates,
        candidate_count,
        candidate_cap);
  }

  return candidate_count;
}

bool has_edit_distance_suggestions(const char* token, unsigned int token_len) {
  SuggestionCandidate candidates[kMaxSuggestionCandidates] = {};

  return collect_suggestion_candidates(token, token_len, candidates, kMaxSuggestionCandidates) > 0;
}

unsigned int writable_suggestion_slots(
    unsigned int suggestions_out_cap,
    unsigned int max_suggestions,
    unsigned int suggestion_slot_cap,
    double* scores_out,
    unsigned int scores_cap) {
  if (max_suggestions == 0 || suggestion_slot_cap == 0 || suggestions_out_cap == 0) {
    return 0;
  }

  unsigned int slots = suggestions_out_cap / suggestion_slot_cap;
  slots = min_uint(slots, max_suggestions);

  if (scores_out != nullptr) {
    slots = min_uint(slots, scores_cap);
  }

  return slots;
}

unsigned int write_suggestion(
    WordView suggestion,
    char* slot,
    unsigned int slot_cap) {
  if (slot == nullptr || slot_cap == 0) {
    return TYPAI_REASON_REPLACEMENT_TRUNCATED;
  }

  const unsigned int writable_len = slot_cap - 1;
  const bool truncated = suggestion.len > writable_len;
  const unsigned int copy_len = truncated ? writable_len : suggestion.len;

  for (unsigned int index = 0; index < copy_len; ++index) {
    slot[index] = suggestion.word[index];
  }

  slot[copy_len] = '\0';

  return truncated ? TYPAI_REASON_REPLACEMENT_TRUNCATED : TYPAI_REASON_NONE;
}

unsigned int read_u16_le(const unsigned char* data) {
  return static_cast<unsigned int>(data[0]) | (static_cast<unsigned int>(data[1]) << 8);
}

unsigned int read_u32_le(const unsigned char* data) {
  return static_cast<unsigned int>(data[0]) | (static_cast<unsigned int>(data[1]) << 8) |
         (static_cast<unsigned int>(data[2]) << 16) |
         (static_cast<unsigned int>(data[3]) << 24);
}

bool dictionary_magic_matches(const unsigned char* data, unsigned int data_len) {
  if (data_len < sizeof(kDictionaryBlobMagic)) {
    return false;
  }

  for (unsigned int index = 0; index < sizeof(kDictionaryBlobMagic); ++index) {
    if (data[index] != static_cast<unsigned char>(kDictionaryBlobMagic[index])) {
      return false;
    }
  }

  return true;
}

bool checked_dictionary_payload_bounds(
    unsigned int data_len,
    unsigned int word_count,
    unsigned int string_table_len,
    unsigned int language_len,
    unsigned int& entries_offset_out,
    unsigned int& string_table_offset_out,
    unsigned int& language_offset_out) {
  const unsigned long long entries_offset = kDictionaryBlobHeaderLen;
  const unsigned long long entries_len =
      static_cast<unsigned long long>(word_count) * kDictionaryBlobEntryLen;
  const unsigned long long string_table_offset = entries_offset + entries_len;
  const unsigned long long language_offset = string_table_offset + string_table_len;
  const unsigned long long expected_len = language_offset + language_len;

  if (expected_len != data_len || expected_len > 0xffffffffull) {
    return false;
  }

  entries_offset_out = static_cast<unsigned int>(entries_offset);
  string_table_offset_out = static_cast<unsigned int>(string_table_offset);
  language_offset_out = static_cast<unsigned int>(language_offset);
  return true;
}

int reject_dictionary_blob(
    unsigned int* word_count_out,
    unsigned int* reason_flags_out,
    int result,
    unsigned int reason_flags) {
  if (word_count_out != nullptr) {
    *word_count_out = 0;
  }

  set_reason_flags(reason_flags_out, reason_flags);
  return result;
}

int load_dictionary_blob(
    const unsigned char* data,
    unsigned int data_len,
    unsigned int* word_count_out,
    unsigned int* reason_flags_out) {
  if (word_count_out != nullptr) {
    *word_count_out = 0;
  }

  if (data == nullptr || data_len < kDictionaryBlobHeaderLen) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_INVALID_INPUT,
        TYPAI_REASON_INVALID_INPUT);
  }

  if (!dictionary_magic_matches(data, data_len)) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_INVALID_MAGIC,
        TYPAI_REASON_DICTIONARY_INVALID_MAGIC);
  }

  const unsigned int version = read_u32_le(data + 8);
  if (version != kDictionaryBlobVersion) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_UNSUPPORTED_VERSION,
        TYPAI_REASON_DICTIONARY_UNSUPPORTED_VERSION);
  }

  const unsigned int language_len = read_u16_le(data + 12);
  const unsigned int reserved = read_u16_le(data + 14);
  const unsigned int word_count = read_u32_le(data + 16);
  const unsigned int string_table_len = read_u32_le(data + 20);

  if (reserved != 0) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
        TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
  }

  if (word_count == 0 || string_table_len == 0) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_EMPTY,
        TYPAI_REASON_DICTIONARY_EMPTY);
  }

  unsigned int entries_offset = 0;
  unsigned int string_table_offset = 0;
  unsigned int language_offset = 0;

  if (!checked_dictionary_payload_bounds(
          data_len,
          word_count,
          string_table_len,
          language_len,
          entries_offset,
          string_table_offset,
          language_offset)) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
        TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
  }

  if (
      word_count > kMaxDynamicDictionaryWords ||
      string_table_len > kMaxDynamicDictionaryStringBytes) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
        TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
  }

  clear_loaded_dictionary_state(g_staging_dictionary);
  g_staging_dictionary.string_table_len = string_table_len;

  for (unsigned int index = 0; index < string_table_len; ++index) {
    g_staging_dictionary.string_table[index] =
        static_cast<char>(data[string_table_offset + index]);
  }

  if (!ensure_trie_root(g_staging_dictionary)) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
        TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
  }

  for (unsigned int index = 0; index < word_count; ++index) {
    const unsigned int entry_offset = entries_offset + index * kDictionaryBlobEntryLen;
    const unsigned int word_offset = read_u32_le(data + entry_offset);
    const unsigned int word_len = read_u16_le(data + entry_offset + 4);
    const unsigned int frequency = read_u32_le(data + entry_offset + 6);
    const unsigned int flags = read_u32_le(data + entry_offset + 10);
    const unsigned long long word_end = static_cast<unsigned long long>(word_offset) + word_len;

    if (word_len == 0 || word_end > string_table_len) {
      return reject_dictionary_blob(
          word_count_out,
          reason_flags_out,
          TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
          TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
    }

    const char* word = g_staging_dictionary.string_table + word_offset;

    if (!is_lowercase_ascii_word(word, word_len)) {
      return reject_dictionary_blob(
          word_count_out,
          reason_flags_out,
          TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
          TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
    }

    g_staging_dictionary.entries[g_staging_dictionary.entry_count] =
        {word_offset, word_len, frequency, flags};
    g_staging_dictionary.entry_count += 1;

    if (!trie_insert(g_staging_dictionary, g_staging_dictionary.entry_count - 1)) {
      return reject_dictionary_blob(
          word_count_out,
          reason_flags_out,
          TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
          TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
    }
  }

  g_loaded_dictionary = g_staging_dictionary;

  if (word_count_out != nullptr) {
    *word_count_out = g_loaded_dictionary.entry_count;
  }

  set_reason_flags(reason_flags_out, TYPAI_REASON_DICTIONARY_LOADED);
  return TYPAI_DICTIONARY_LOAD_OK;
}

}  // namespace typai

extern "C" int typai_check_token(
    const char* token,
    unsigned int token_len,
    char* replacement_out,
    unsigned int replacement_cap,
    double* confidence_out,
    unsigned int* reason_flags_out) {
  typai::reset_outputs(replacement_out, replacement_cap, confidence_out, reason_flags_out);

  if (token == nullptr || token_len == 0) {
    typai::set_reason_flags(reason_flags_out, TYPAI_REASON_INVALID_INPUT);
    return 0;
  }

  bool dynamic_match = false;
  if (typai::is_any_known_valid_word(token, token_len, &dynamic_match)) {
    typai::set_reason_flags(
        reason_flags_out,
        dynamic_match ? TYPAI_REASON_DYNAMIC_DICTIONARY_MATCH : TYPAI_REASON_KNOWN_VALID_WORD);
    return 0;
  }

  if (typai::is_protected_looking_token(token, token_len)) {
    typai::set_reason_flags(reason_flags_out, TYPAI_REASON_PROTECTED_LOOKING_TOKEN);
    return 0;
  }

  const typai::ReplacementView replacement = typai::common_typo_replacement(token, token_len);
  if (replacement.value != nullptr) {
    const unsigned int replacement_flags =
        typai::write_replacement(replacement, replacement_out, replacement_cap);
    typai::set_confidence(confidence_out, typai::kCommonTypoConfidence);
    typai::set_reason_flags(
        reason_flags_out, TYPAI_REASON_COMMON_TYPO_MATCH | replacement_flags);
    return 1;
  }

  if (typai::is_lowercase_alphabetic_token(token, token_len)) {
    const unsigned int suggestion_flags = typai::has_edit_distance_suggestions(token, token_len)
        ? TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS
        : TYPAI_REASON_NO_SUGGESTIONS;
    typai::set_reason_flags(
        reason_flags_out, TYPAI_REASON_UNKNOWN_NON_WORD | suggestion_flags);
    return 2;
  }

  typai::set_reason_flags(reason_flags_out, TYPAI_REASON_PROTECTED_LOOKING_TOKEN);
  return 0;
}

extern "C" unsigned int typai_suggest_token(
    const char* token,
    unsigned int token_len,
    char* suggestions_out,
    unsigned int suggestions_out_cap,
    unsigned int max_suggestions,
    unsigned int suggestion_slot_cap,
    double* scores_out,
    unsigned int scores_cap,
    unsigned int* reason_flags_out) {
  typai::set_reason_flags(reason_flags_out, TYPAI_REASON_NONE);

  if (token == nullptr || token_len == 0) {
    typai::set_reason_flags(reason_flags_out, TYPAI_REASON_INVALID_INPUT);
    return 0;
  }

  bool dynamic_match = false;
  if (typai::is_any_known_valid_word(token, token_len, &dynamic_match)) {
    typai::set_reason_flags(
        reason_flags_out,
        dynamic_match ? TYPAI_REASON_DYNAMIC_DICTIONARY_MATCH : TYPAI_REASON_KNOWN_VALID_WORD);
    return 0;
  }

  if (typai::is_protected_looking_token(token, token_len) ||
      !typai::is_lowercase_alphabetic_token(token, token_len)) {
    typai::set_reason_flags(reason_flags_out, TYPAI_REASON_PROTECTED_LOOKING_TOKEN);
    return 0;
  }

  typai::SuggestionCandidate candidates[typai::kMaxSuggestionCandidates] = {};
  const unsigned int candidate_count = typai::collect_suggestion_candidates(
      token, token_len, candidates, typai::kMaxSuggestionCandidates);

  if (candidate_count == 0) {
    typai::set_reason_flags(reason_flags_out, TYPAI_REASON_NO_SUGGESTIONS);
    return 0;
  }

  if (suggestions_out == nullptr) {
    typai::set_reason_flags(
        reason_flags_out, TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS | TYPAI_REASON_INVALID_INPUT);
    return 0;
  }

  const unsigned int writable_slots = typai::writable_suggestion_slots(
      suggestions_out_cap, max_suggestions, suggestion_slot_cap, scores_out, scores_cap);
  const unsigned int suggestion_count = typai::min_uint(candidate_count, writable_slots);
  unsigned int flags = TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS;

  if (suggestion_count == 0) {
    typai::set_reason_flags(reason_flags_out, flags | TYPAI_REASON_REPLACEMENT_TRUNCATED);
    return 0;
  }

  for (unsigned int index = 0; index < suggestion_count; ++index) {
    char* slot = suggestions_out + (index * suggestion_slot_cap);
    flags |= typai::write_suggestion(candidates[index].word, slot, suggestion_slot_cap);

    if (scores_out != nullptr && index < scores_cap) {
      scores_out[index] = candidates[index].score;
    }
  }

  typai::set_reason_flags(reason_flags_out, flags);
  return suggestion_count;
}

extern "C" int typai_load_dictionary_blob(
    const unsigned char* data,
    unsigned int data_len,
    unsigned int* word_count_out,
    unsigned int* reason_flags_out) {
  return typai::load_dictionary_blob(data, data_len, word_count_out, reason_flags_out);
}

extern "C" void typai_clear_loaded_dictionary() {
  typai::clear_loaded_dictionary_state(typai::g_loaded_dictionary);
}

extern "C" unsigned int typai_loaded_dictionary_word_count() {
  return typai::g_loaded_dictionary.entry_count;
}
