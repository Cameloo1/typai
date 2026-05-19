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
constexpr unsigned int kDeleteIndexMaxDistance = 2;
constexpr unsigned int kMaxDeleteIndexWordLen = 32;
constexpr unsigned int kMaxDeleteKeyVariants =
    1 + kMaxDeleteIndexWordLen +
    ((kMaxDeleteIndexWordLen * (kMaxDeleteIndexWordLen - 1)) / 2);
constexpr unsigned int kDeleteIndexBucketCount = 32768;
constexpr unsigned int kMaxDeleteIndexEntries = 65536;
constexpr unsigned int kMaxDeleteIndexCandidateLinks = 196608;
constexpr unsigned int kMaxDeleteIndexStringBytes = 786432;
constexpr unsigned int kBuiltinWordIdFlag = 1u << 31;
constexpr unsigned int kFnvOffsetBasis = 2166136261u;
constexpr unsigned int kFnvPrime = 16777619u;
constexpr char kDictionaryBlobMagic[] = {'T', 'Y', 'P', 'A', 'I', 'D', 'I', 'C'};
constexpr char kSupportedDictionaryLanguage[] = {'e', 'n', '-', 'U', 'S'};

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

struct DeleteKey {
  char key[kMaxDeleteIndexWordLen + 1];
  unsigned int len;
};

struct DeleteKeySet {
  DeleteKey keys[kMaxDeleteKeyVariants];
  unsigned int count;
};

struct DeleteIndexCandidateLink {
  unsigned int word_id;
  int next;
};

struct DeleteIndexEntry {
  unsigned int key_offset;
  unsigned int key_len;
  unsigned int hash;
  int candidate_head;
  int candidate_tail;
  unsigned int candidate_count;
  int next_bucket;
};

struct DeleteIndex {
  char key_table[kMaxDeleteIndexStringBytes];
  DeleteIndexEntry entries[kMaxDeleteIndexEntries];
  DeleteIndexCandidateLink candidate_links[kMaxDeleteIndexCandidateLinks];
  int buckets[kDeleteIndexBucketCount];
  unsigned int key_table_len;
  unsigned int entry_count;
  unsigned int candidate_link_count;
  bool built;
};

LoadedDictionary g_loaded_dictionary;
LoadedDictionary g_staging_dictionary;
DeleteIndex g_delete_index;
DeleteIndex g_staging_delete_index;

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

void clear_delete_index_state(DeleteIndex& index) {
  index.key_table_len = 0;
  index.entry_count = 0;
  index.candidate_link_count = 0;
  index.built = false;

  for (unsigned int bucket_index = 0; bucket_index < kDeleteIndexBucketCount; ++bucket_index) {
    index.buckets[bucket_index] = -1;
  }
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

bool is_dynamic_dictionary_word_in(
    const LoadedDictionary& dictionary,
    const char* token,
    unsigned int token_len) {
  return find_dynamic_dictionary_entry(dictionary, token, token_len) != nullptr;
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

unsigned int hash_delete_key(const char* key, unsigned int key_len) {
  unsigned int hash = kFnvOffsetBasis;

  for (unsigned int index = 0; index < key_len; ++index) {
    hash ^= static_cast<unsigned int>(static_cast<unsigned char>(key[index]));
    hash *= kFnvPrime;
  }

  hash ^= key_len;
  hash *= kFnvPrime;
  return hash;
}

bool delete_key_equals(const char* left, unsigned int left_len, const char* right, unsigned int right_len) {
  return compare_words(left, left_len, right, right_len) == 0;
}

bool delete_key_set_contains(const DeleteKeySet& key_set, const char* key, unsigned int key_len) {
  for (unsigned int index = 0; index < key_set.count; ++index) {
    if (delete_key_equals(key_set.keys[index].key, key_set.keys[index].len, key, key_len)) {
      return true;
    }
  }

  return false;
}

bool append_delete_key(DeleteKeySet& key_set, const char* key, unsigned int key_len) {
  if (key_len > kMaxDeleteIndexWordLen) {
    return false;
  }

  if (delete_key_set_contains(key_set, key, key_len)) {
    return true;
  }

  if (key_set.count >= kMaxDeleteKeyVariants) {
    return false;
  }

  DeleteKey& output = key_set.keys[key_set.count];
  output.len = key_len;

  for (unsigned int index = 0; index < key_len; ++index) {
    output.key[index] = key[index];
  }

  output.key[key_len] = '\0';
  key_set.count += 1;
  return true;
}

bool append_delete_variant(
    DeleteKeySet& key_set,
    const char* word,
    unsigned int word_len,
    unsigned int first_deleted,
    unsigned int second_deleted,
    unsigned int deleted_count) {
  char key[kMaxDeleteIndexWordLen + 1] = {};
  unsigned int key_len = 0;

  for (unsigned int index = 0; index < word_len; ++index) {
    const bool skip_first = deleted_count > 0 && index == first_deleted;
    const bool skip_second = deleted_count > 1 && index == second_deleted;

    if (skip_first || skip_second) {
      continue;
    }

    key[key_len] = word[index];
    key_len += 1;
  }

  return append_delete_key(key_set, key, key_len);
}

bool collect_delete_keys(const char* word, unsigned int word_len, DeleteKeySet& key_set) {
  key_set.count = 0;

  if (word == nullptr || word_len > kMaxDeleteIndexWordLen) {
    return false;
  }

  if (!append_delete_key(key_set, word, word_len)) {
    return false;
  }

  for (unsigned int first = 0; first < word_len; ++first) {
    if (!append_delete_variant(key_set, word, word_len, first, 0, 1)) {
      return false;
    }
  }

  for (unsigned int first = 0; first < word_len; ++first) {
    for (unsigned int second = first + 1; second < word_len; ++second) {
      if (!append_delete_variant(key_set, word, word_len, first, second, kDeleteIndexMaxDistance)) {
        return false;
      }
    }
  }

  return true;
}

bool delete_index_entry_key_matches(
    const DeleteIndex& index,
    const DeleteIndexEntry& entry,
    const char* key,
    unsigned int key_len,
    unsigned int hash) {
  if (entry.hash != hash || entry.key_len != key_len) {
    return false;
  }

  return delete_key_equals(index.key_table + entry.key_offset, entry.key_len, key, key_len);
}

int find_delete_index_entry(
    const DeleteIndex& index,
    const char* key,
    unsigned int key_len,
    unsigned int hash) {
  const unsigned int bucket_index = hash % kDeleteIndexBucketCount;
  int entry_index = index.buckets[bucket_index];

  while (entry_index >= 0) {
    const DeleteIndexEntry& entry = index.entries[static_cast<unsigned int>(entry_index)];

    if (delete_index_entry_key_matches(index, entry, key, key_len, hash)) {
      return entry_index;
    }

    entry_index = entry.next_bucket;
  }

  return -1;
}

bool append_delete_index_entry(
    DeleteIndex& index,
    const char* key,
    unsigned int key_len,
    unsigned int hash,
    int& entry_index_out) {
  if (index.entry_count >= kMaxDeleteIndexEntries) {
    return false;
  }

  const unsigned long long key_table_end =
      static_cast<unsigned long long>(index.key_table_len) + key_len;

  if (key_table_end > kMaxDeleteIndexStringBytes) {
    return false;
  }

  const unsigned int bucket_index = hash % kDeleteIndexBucketCount;
  const unsigned int entry_index = index.entry_count;
  DeleteIndexEntry& entry = index.entries[entry_index];
  entry.key_offset = index.key_table_len;
  entry.key_len = key_len;
  entry.hash = hash;
  entry.candidate_head = -1;
  entry.candidate_tail = -1;
  entry.candidate_count = 0;
  entry.next_bucket = index.buckets[bucket_index];

  for (unsigned int index_in_key = 0; index_in_key < key_len; ++index_in_key) {
    index.key_table[index.key_table_len + index_in_key] = key[index_in_key];
  }

  index.key_table_len += key_len;
  index.buckets[bucket_index] = static_cast<int>(entry_index);
  index.entry_count += 1;
  entry_index_out = static_cast<int>(entry_index);
  return true;
}

bool delete_index_entry_has_word_id(
    const DeleteIndex& index,
    const DeleteIndexEntry& entry,
    unsigned int word_id) {
  int link_index = entry.candidate_head;

  while (link_index >= 0) {
    const DeleteIndexCandidateLink& link =
        index.candidate_links[static_cast<unsigned int>(link_index)];

    if (link.word_id == word_id) {
      return true;
    }

    link_index = link.next;
  }

  return false;
}

bool append_delete_index_candidate(
    DeleteIndex& index,
    DeleteIndexEntry& entry,
    unsigned int word_id) {
  if (delete_index_entry_has_word_id(index, entry, word_id)) {
    return true;
  }

  if (index.candidate_link_count >= kMaxDeleteIndexCandidateLinks) {
    return false;
  }

  const unsigned int link_index = index.candidate_link_count;
  DeleteIndexCandidateLink& link = index.candidate_links[link_index];
  link.word_id = word_id;
  link.next = -1;

  if (entry.candidate_tail >= 0) {
    index.candidate_links[static_cast<unsigned int>(entry.candidate_tail)].next =
        static_cast<int>(link_index);
  } else {
    entry.candidate_head = static_cast<int>(link_index);
  }

  entry.candidate_tail = static_cast<int>(link_index);
  entry.candidate_count += 1;
  index.candidate_link_count += 1;
  return true;
}

bool add_delete_key_to_index(
    DeleteIndex& index,
    const char* key,
    unsigned int key_len,
    unsigned int word_id) {
  const unsigned int hash = hash_delete_key(key, key_len);
  int entry_index = find_delete_index_entry(index, key, key_len, hash);

  if (entry_index < 0) {
    if (!append_delete_index_entry(index, key, key_len, hash, entry_index)) {
      return false;
    }
  }

  return append_delete_index_candidate(
      index, index.entries[static_cast<unsigned int>(entry_index)], word_id);
}

bool add_word_to_delete_index(DeleteIndex& index, WordView word, unsigned int word_id) {
  if (word.len > kMaxDeleteIndexWordLen || !is_lowercase_ascii_word(word.word, word.len)) {
    return true;
  }

  DeleteKeySet key_set = {};

  if (!collect_delete_keys(word.word, word.len, key_set)) {
    return false;
  }

  for (unsigned int index_in_set = 0; index_in_set < key_set.count; ++index_in_set) {
    const DeleteKey& key = key_set.keys[index_in_set];

    if (!add_delete_key_to_index(index, key.key, key.len, word_id)) {
      return false;
    }
  }

  return true;
}

bool word_view_from_word_id(unsigned int word_id, WordView& word_out) {
  if ((word_id & kBuiltinWordIdFlag) != 0) {
    const unsigned int builtin_index = word_id & ~kBuiltinWordIdFlag;

    if (builtin_index >= kKnownValidWordsCount) {
      return false;
    }

    const DictionaryEntry& entry = kKnownValidWords[builtin_index];
    word_out = {entry.word, entry.len, 0, 0, false};
    return true;
  }

  if (word_id >= g_loaded_dictionary.entry_count) {
    return false;
  }

  const DynamicDictionaryEntry& entry = g_loaded_dictionary.entries[word_id];
  word_out = {
      dynamic_word_ptr(g_loaded_dictionary, entry),
      entry.len,
      entry.frequency,
      entry.flags,
      true,
  };
  return true;
}

bool rebuild_delete_index(const LoadedDictionary& dictionary, DeleteIndex& index) {
  clear_delete_index_state(index);

  for (unsigned int entry_index = 0; entry_index < dictionary.entry_count; ++entry_index) {
    const DynamicDictionaryEntry& entry = dictionary.entries[entry_index];
    const WordView word = {
        dynamic_word_ptr(dictionary, entry),
        entry.len,
        entry.frequency,
        entry.flags,
        true,
    };

    if (!add_word_to_delete_index(index, word, entry_index)) {
      clear_delete_index_state(index);
      return false;
    }
  }

  for (unsigned int builtin_index = 0; builtin_index < kKnownValidWordsCount; ++builtin_index) {
    const DictionaryEntry& entry = kKnownValidWords[builtin_index];

    if (
        !is_lowercase_ascii_word(entry.word, entry.len) ||
        is_dynamic_dictionary_word_in(dictionary, entry.word, entry.len)) {
      continue;
    }

    if (!add_word_to_delete_index(
            index,
            {entry.word, entry.len, 0, 0, false},
            kBuiltinWordIdFlag | builtin_index)) {
      clear_delete_index_state(index);
      return false;
    }
  }

  index.built = true;
  return true;
}

bool ensure_delete_index_built() {
  if (g_delete_index.built) {
    return true;
  }

  if (!rebuild_delete_index(g_loaded_dictionary, g_staging_delete_index)) {
    clear_delete_index_state(g_delete_index);
    return false;
  }

  g_delete_index = g_staging_delete_index;
  return true;
}

unsigned int delete_index_memory_estimate_bytes(const DeleteIndex& index) {
  const unsigned long long bytes =
      static_cast<unsigned long long>(index.key_table_len) +
      (static_cast<unsigned long long>(index.entry_count) * sizeof(DeleteIndexEntry)) +
      (static_cast<unsigned long long>(index.candidate_link_count) *
       sizeof(DeleteIndexCandidateLink)) +
      (static_cast<unsigned long long>(kDeleteIndexBucketCount) * sizeof(int));

  if (bytes > 0xffffffffull) {
    return 0xffffffffu;
  }

  return static_cast<unsigned int>(bytes);
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
    if (candidate_cap == 0 || !candidate_precedes(candidate, candidates[candidate_cap - 1])) {
      return;
    }

    candidates[candidate_cap - 1] = candidate;

    unsigned int replacement_index = candidate_cap - 1;
    while (
        replacement_index > 0 &&
        candidate_precedes(candidates[replacement_index], candidates[replacement_index - 1])) {
      const SuggestionCandidate previous = candidates[replacement_index - 1];
      candidates[replacement_index - 1] = candidates[replacement_index];
      candidates[replacement_index] = previous;
      replacement_index -= 1;
    }

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

bool collected_candidates_contain_word(
    const SuggestionCandidate* candidates,
    unsigned int candidate_count,
    WordView word) {
  for (unsigned int index = 0; index < candidate_count; ++index) {
    if (token_equals(candidates[index].word.word, candidates[index].word.len, word.word, word.len)) {
      return true;
    }
  }

  return false;
}

void maybe_collect_unique_candidate(
    const char* token,
    unsigned int token_len,
    WordView word,
    SuggestionCandidate* candidates,
    unsigned int& candidate_count,
    unsigned int candidate_cap) {
  if (collected_candidates_contain_word(candidates, candidate_count, word)) {
    return;
  }

  maybe_collect_candidate(token, token_len, word, candidates, candidate_count, candidate_cap);
}

unsigned int collect_suggestion_candidates_by_scan(
    const char* token,
    unsigned int token_len,
    SuggestionCandidate* candidates,
    unsigned int candidate_cap) {
  unsigned int candidate_count = 0;

  for (unsigned int index = 0; index < g_loaded_dictionary.entry_count; ++index) {
    const DynamicDictionaryEntry& entry = g_loaded_dictionary.entries[index];
    maybe_collect_unique_candidate(
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

    maybe_collect_unique_candidate(
        token,
        token_len,
        {entry.word, entry.len, 0, 0, false},
        candidates,
        candidate_count,
        candidate_cap);
  }

  return candidate_count;
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

  if (token_len > kMaxDeleteIndexWordLen || !ensure_delete_index_built()) {
    return collect_suggestion_candidates_by_scan(token, token_len, candidates, candidate_cap);
  }

  DeleteKeySet query_keys = {};

  if (!collect_delete_keys(token, token_len, query_keys)) {
    return collect_suggestion_candidates_by_scan(token, token_len, candidates, candidate_cap);
  }

  for (unsigned int query_key_index = 0; query_key_index < query_keys.count; ++query_key_index) {
    const DeleteKey& key = query_keys.keys[query_key_index];
    const unsigned int hash = hash_delete_key(key.key, key.len);
    const int entry_index = find_delete_index_entry(g_delete_index, key.key, key.len, hash);

    if (entry_index < 0) {
      continue;
    }

    const DeleteIndexEntry& entry = g_delete_index.entries[static_cast<unsigned int>(entry_index)];
    int link_index = entry.candidate_head;

    while (link_index >= 0) {
      const DeleteIndexCandidateLink& link =
          g_delete_index.candidate_links[static_cast<unsigned int>(link_index)];
      WordView word = {};

      if (word_view_from_word_id(link.word_id, word)) {
        maybe_collect_unique_candidate(
            token, token_len, word, candidates, candidate_count, candidate_cap);
      }

      link_index = link.next;
    }
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

bool dictionary_language_matches(const unsigned char* data, unsigned int language_len) {
  if (language_len != sizeof(kSupportedDictionaryLanguage)) {
    return false;
  }

  for (unsigned int index = 0; index < sizeof(kSupportedDictionaryLanguage); ++index) {
    if (data[index] != static_cast<unsigned char>(kSupportedDictionaryLanguage[index])) {
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

  if (!dictionary_language_matches(data + language_offset, language_len)) {
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

  if (!rebuild_delete_index(g_staging_dictionary, g_staging_delete_index)) {
    return reject_dictionary_blob(
        word_count_out,
        reason_flags_out,
        TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR,
        TYPAI_REASON_DICTIONARY_BOUNDS_ERROR);
  }

  g_loaded_dictionary = g_staging_dictionary;
  g_delete_index = g_staging_delete_index;

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
        ? (TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS | TYPAI_REASON_DELETE_INDEX_SUGGESTIONS)
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
        reason_flags_out,
        TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS | TYPAI_REASON_DELETE_INDEX_SUGGESTIONS |
            TYPAI_REASON_INVALID_INPUT);
    return 0;
  }

  const unsigned int writable_slots = typai::writable_suggestion_slots(
      suggestions_out_cap, max_suggestions, suggestion_slot_cap, scores_out, scores_cap);
  const unsigned int suggestion_count = typai::min_uint(candidate_count, writable_slots);
  unsigned int flags = TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS | TYPAI_REASON_DELETE_INDEX_SUGGESTIONS;

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
  if (typai::rebuild_delete_index(typai::g_loaded_dictionary, typai::g_staging_delete_index)) {
    typai::g_delete_index = typai::g_staging_delete_index;
  } else {
    typai::clear_delete_index_state(typai::g_delete_index);
  }
}

extern "C" unsigned int typai_loaded_dictionary_word_count() {
  return typai::g_loaded_dictionary.entry_count;
}

extern "C" unsigned int typai_delete_index_entry_count() {
  return typai::g_delete_index.entry_count;
}

extern "C" unsigned int typai_delete_index_memory_estimate_bytes() {
  return typai::delete_index_memory_estimate_bytes(typai::g_delete_index);
}

extern "C" void typai_clear_delete_index() {
  typai::clear_delete_index_state(typai::g_delete_index);
}
