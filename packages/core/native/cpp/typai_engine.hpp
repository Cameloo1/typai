#pragma once

enum TypaiReasonFlags : unsigned int {
  TYPAI_REASON_NONE = 0,
  TYPAI_REASON_KNOWN_VALID_WORD = 1u << 0,
  TYPAI_REASON_COMMON_TYPO_MATCH = 1u << 1,
  TYPAI_REASON_UNKNOWN_NON_WORD = 1u << 2,
  TYPAI_REASON_PROTECTED_LOOKING_TOKEN = 1u << 3,
  TYPAI_REASON_INVALID_INPUT = 1u << 4,
  TYPAI_REASON_REPLACEMENT_TRUNCATED = 1u << 5,
  TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS = 1u << 6,
  TYPAI_REASON_NO_SUGGESTIONS = 1u << 7,
  TYPAI_REASON_DICTIONARY_LOADED = 1u << 8,
  TYPAI_REASON_DICTIONARY_INVALID_MAGIC = 1u << 9,
  TYPAI_REASON_DICTIONARY_UNSUPPORTED_VERSION = 1u << 10,
  TYPAI_REASON_DICTIONARY_BOUNDS_ERROR = 1u << 11,
  TYPAI_REASON_DICTIONARY_EMPTY = 1u << 12,
  TYPAI_REASON_DICTIONARY_CLEARED = 1u << 13,
  TYPAI_REASON_DYNAMIC_DICTIONARY_MATCH = 1u << 14,
  TYPAI_REASON_DELETE_INDEX_SUGGESTIONS = 1u << 15,
  TYPAI_REASON_COMMON_TYPO_TABLE_EXPANDED = 1u << 16,
  TYPAI_REASON_CASE_PRESERVED = 1u << 17,
  TYPAI_REASON_PUNCTUATION_PRESERVED = 1u << 18,
  TYPAI_REASON_DELETE_INDEX_CANDIDATE = 1u << 19,
  TYPAI_REASON_FREQUENCY_RANKED = 1u << 20,
  TYPAI_REASON_AUTOCORRECT_GATE_PASSED = 1u << 21,
  TYPAI_REASON_AUTOCORRECT_GATE_BLOCKED = 1u << 22,
  TYPAI_REASON_VALID_WORD_BLOCK = 1u << 23,
  TYPAI_REASON_PROTECTED_TOKEN_BLOCK = 1u << 24,
};

enum TypaiDictionaryLoadResult : int {
  TYPAI_DICTIONARY_LOAD_OK = 1,
  TYPAI_DICTIONARY_LOAD_INVALID_INPUT = -1,
  TYPAI_DICTIONARY_LOAD_INVALID_MAGIC = -2,
  TYPAI_DICTIONARY_LOAD_UNSUPPORTED_VERSION = -3,
  TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR = -4,
  TYPAI_DICTIONARY_LOAD_EMPTY = -5,
};

namespace typai {
constexpr int kTypaiEngineVersion = 1;
}

extern "C" int typai_check_token(
    const char* token,
    unsigned int token_len,
    char* replacement_out,
    unsigned int replacement_cap,
    double* confidence_out,
    unsigned int* reason_flags_out);

extern "C" unsigned int typai_suggest_token(
    const char* token,
    unsigned int token_len,
    char* suggestions_out,
    unsigned int suggestions_out_cap,
    unsigned int max_suggestions,
    unsigned int suggestion_slot_cap,
    double* scores_out,
    unsigned int scores_cap,
    unsigned int* reason_flags_out);

extern "C" int typai_load_dictionary_blob(
    const unsigned char* data,
    unsigned int data_len,
    unsigned int* word_count_out,
    unsigned int* reason_flags_out);

extern "C" void typai_clear_loaded_dictionary();

extern "C" unsigned int typai_loaded_dictionary_word_count();

extern "C" unsigned int typai_delete_index_entry_count();

extern "C" unsigned int typai_delete_index_memory_estimate_bytes();

extern "C" void typai_clear_delete_index();
