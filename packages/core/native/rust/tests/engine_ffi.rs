use std::ffi::{c_char, CStr};

const TYPAI_REASON_KNOWN_VALID_WORD: u32 = 1 << 0;
const TYPAI_REASON_COMMON_TYPO_MATCH: u32 = 1 << 1;
const TYPAI_REASON_UNKNOWN_NON_WORD: u32 = 1 << 2;
const TYPAI_REASON_PROTECTED_LOOKING_TOKEN: u32 = 1 << 3;
const TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS: u32 = 1 << 6;
const TYPAI_REASON_NO_SUGGESTIONS: u32 = 1 << 7;
const TYPAI_REASON_DICTIONARY_LOADED: u32 = 1 << 8;
const TYPAI_REASON_DICTIONARY_INVALID_MAGIC: u32 = 1 << 9;
const TYPAI_REASON_DICTIONARY_UNSUPPORTED_VERSION: u32 = 1 << 10;
const TYPAI_REASON_DICTIONARY_BOUNDS_ERROR: u32 = 1 << 11;
const TYPAI_REASON_DYNAMIC_DICTIONARY_MATCH: u32 = 1 << 14;
const TYPAI_REASON_DELETE_INDEX_SUGGESTIONS: u32 = 1 << 15;
const TYPAI_REASON_COMMON_TYPO_TABLE_EXPANDED: u32 = 1 << 16;
const TYPAI_REASON_DELETE_INDEX_CANDIDATE: u32 = 1 << 19;
const TYPAI_REASON_FREQUENCY_RANKED: u32 = 1 << 20;
const TYPAI_REASON_AUTOCORRECT_GATE_PASSED: u32 = 1 << 21;
const TYPAI_REASON_AUTOCORRECT_GATE_BLOCKED: u32 = 1 << 22;
const TYPAI_REASON_VALID_WORD_BLOCK: u32 = 1 << 23;
const TYPAI_REASON_PROTECTED_TOKEN_BLOCK: u32 = 1 << 24;
const TYPAI_DICTIONARY_LOAD_OK: i32 = 1;
const TYPAI_DICTIONARY_LOAD_INVALID_MAGIC: i32 = -2;
const TYPAI_DICTIONARY_LOAD_UNSUPPORTED_VERSION: i32 = -3;
const TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR: i32 = -4;

#[link(name = "typai_engine", kind = "static")]
unsafe extern "C" {
    fn typai_check_token(
        token: *const c_char,
        token_len: u32,
        replacement_out: *mut c_char,
        replacement_cap: u32,
        confidence_out: *mut f64,
        reason_flags_out: *mut u32,
    ) -> i32;

    fn typai_suggest_token(
        token: *const c_char,
        token_len: u32,
        suggestions_out: *mut c_char,
        suggestions_out_cap: u32,
        max_suggestions: u32,
        suggestion_slot_cap: u32,
        scores_out: *mut f64,
        scores_cap: u32,
        reason_flags_out: *mut u32,
    ) -> u32;

    fn typai_load_dictionary_blob(
        data: *const u8,
        data_len: u32,
        word_count_out: *mut u32,
        reason_flags_out: *mut u32,
    ) -> i32;

    fn typai_clear_loaded_dictionary();

    fn typai_loaded_dictionary_word_count() -> u32;

    fn typai_delete_index_entry_count() -> u32;

    fn typai_delete_index_memory_estimate_bytes() -> u32;

    fn typai_clear_delete_index();
}

#[derive(Debug)]
struct EngineDecision {
    code: i32,
    replacement: String,
    confidence: f64,
    reason_flags: u32,
}

#[derive(Debug)]
struct SuggestionResult {
    suggestions: Vec<String>,
    scores: Vec<f64>,
    reason_flags: u32,
}

fn check_token(token: &str) -> EngineDecision {
    let mut replacement = [0 as c_char; 32];
    let mut confidence = -1.0;
    let mut reason_flags = 0;

    let code = unsafe {
        typai_check_token(
            token.as_ptr().cast::<c_char>(),
            token.len() as u32,
            replacement.as_mut_ptr(),
            replacement.len() as u32,
            &mut confidence,
            &mut reason_flags,
        )
    };

    let replacement = unsafe { CStr::from_ptr(replacement.as_ptr()) }
        .to_string_lossy()
        .into_owned();

    EngineDecision {
        code,
        replacement,
        confidence,
        reason_flags,
    }
}

fn suggest_token(token: &str) -> SuggestionResult {
    const MAX_SUGGESTIONS: usize = 4;
    const SLOT_CAP: usize = 32;

    let mut suggestions = [0 as c_char; MAX_SUGGESTIONS * SLOT_CAP];
    let mut scores = [0.0_f64; MAX_SUGGESTIONS];
    let mut reason_flags = 0;

    let count = unsafe {
        typai_suggest_token(
            token.as_ptr().cast::<c_char>(),
            token.len() as u32,
            suggestions.as_mut_ptr(),
            suggestions.len() as u32,
            MAX_SUGGESTIONS as u32,
            SLOT_CAP as u32,
            scores.as_mut_ptr(),
            scores.len() as u32,
            &mut reason_flags,
        )
    } as usize;

    let suggestions = (0..count)
        .map(|index| {
            let slot = unsafe { suggestions.as_ptr().add(index * SLOT_CAP) };

            unsafe { CStr::from_ptr(slot) }
                .to_string_lossy()
                .into_owned()
        })
        .collect::<Vec<_>>();

    SuggestionResult {
        suggestions,
        scores: scores[..count].to_vec(),
        reason_flags,
    }
}

fn clear_loaded_dictionary() {
    unsafe {
        typai_clear_loaded_dictionary();
    }
}

fn loaded_dictionary_word_count() -> u32 {
    unsafe { typai_loaded_dictionary_word_count() }
}

fn delete_index_entry_count() -> u32 {
    unsafe { typai_delete_index_entry_count() }
}

fn delete_index_memory_estimate_bytes() -> u32 {
    unsafe { typai_delete_index_memory_estimate_bytes() }
}

fn clear_delete_index() {
    unsafe {
        typai_clear_delete_index();
    }
}

fn load_dictionary_blob(blob: &[u8]) -> (i32, u32, u32) {
    let mut word_count = u32::MAX;
    let mut reason_flags = 0;
    let code = unsafe {
        typai_load_dictionary_blob(
            blob.as_ptr(),
            blob.len() as u32,
            &mut word_count,
            &mut reason_flags,
        )
    };

    (code, word_count, reason_flags)
}

fn mock_dictionary_blob() -> Vec<u8> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../assets/mock-en-us.dictionary.bin");

    std::fs::read(path).expect("mock dictionary asset should exist")
}

fn mock_word_count(blob: &[u8]) -> u32 {
    u32::from_le_bytes(blob[16..20].try_into().expect("word count bytes"))
}

fn dictionary_blob(entries: &[(&str, u32, u32)], language: &str) -> Vec<u8> {
    const HEADER_LEN: usize = 24;
    const ENTRY_LEN: usize = 14;

    let language_bytes = language.as_bytes();
    let string_table_len = entries.iter().map(|(word, _, _)| word.len()).sum::<usize>();
    let byte_len = HEADER_LEN + entries.len() * ENTRY_LEN + string_table_len + language_bytes.len();
    let mut output = vec![0_u8; byte_len];
    let mut offset = 0;

    output[offset..offset + 8].copy_from_slice(b"TYPAIDIC");
    offset += 8;
    output[offset..offset + 4].copy_from_slice(&1_u32.to_le_bytes());
    offset += 4;
    output[offset..offset + 2].copy_from_slice(&(language_bytes.len() as u16).to_le_bytes());
    offset += 2;
    output[offset..offset + 2].copy_from_slice(&0_u16.to_le_bytes());
    offset += 2;
    output[offset..offset + 4].copy_from_slice(&(entries.len() as u32).to_le_bytes());
    offset += 4;
    output[offset..offset + 4].copy_from_slice(&(string_table_len as u32).to_le_bytes());
    offset += 4;

    let mut word_offset = 0_u32;

    for (word, frequency, flags) in entries {
        output[offset..offset + 4].copy_from_slice(&word_offset.to_le_bytes());
        offset += 4;
        output[offset..offset + 2].copy_from_slice(&(word.len() as u16).to_le_bytes());
        offset += 2;
        output[offset..offset + 4].copy_from_slice(&frequency.to_le_bytes());
        offset += 4;
        output[offset..offset + 4].copy_from_slice(&flags.to_le_bytes());
        offset += 4;
        word_offset += word.len() as u32;
    }

    for (word, _, _) in entries {
        output[offset..offset + word.len()].copy_from_slice(word.as_bytes());
        offset += word.len();
    }

    output[offset..offset + language_bytes.len()].copy_from_slice(language_bytes);

    output
}

#[test]
fn common_typos_are_deterministic_auto_corrections() {
    clear_loaded_dictionary();

    for (token, replacement) in [
        ("teh", "the"),
        ("adn", "and"),
        ("recieve", "receive"),
        ("becuase", "because"),
        ("thier", "their"),
    ] {
        let decision = check_token(token);

        assert_eq!(decision.code, 1, "{token}");
        assert_eq!(decision.replacement, replacement, "{token}");
        assert!(
            (0.98..=1.0).contains(&decision.confidence),
            "{token} confidence was {}",
            decision.confidence,
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_COMMON_TYPO_MATCH,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_AUTOCORRECT_GATE_PASSED,
            0,
            "{token}",
        );
    }
}

#[test]
fn expanded_common_typos_are_explicit_auto_corrections() {
    clear_loaded_dictionary();

    for (token, replacement) in [
        ("adress", "address"),
        ("speling", "spelling"),
        ("corection", "correction"),
        ("seperate", "separate"),
        ("definitly", "definitely"),
        ("accomodate", "accommodate"),
        ("occured", "occurred"),
        ("untill", "until"),
        ("tommorow", "tomorrow"),
        ("goverment", "government"),
        ("enviroment", "environment"),
        ("arguement", "argument"),
        ("calender", "calendar"),
        ("embarass", "embarrass"),
        ("publically", "publicly"),
        ("neccessary", "necessary"),
    ] {
        let decision = check_token(token);

        assert_eq!(decision.code, 1, "{token}");
        assert_eq!(decision.replacement, replacement, "{token}");
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_COMMON_TYPO_TABLE_EXPANDED,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_AUTOCORRECT_GATE_PASSED,
            0,
            "{token}",
        );
    }
}

#[test]
fn known_valid_words_are_never_auto_corrected() {
    clear_loaded_dictionary();

    for token in ["the", "and", "form", "their", "its", "lead", "to", "nmap", "sqlmap"] {
        let decision = check_token(token);

        assert_eq!(decision.code, 0, "{token}");
        assert_eq!(decision.replacement, "", "{token}");
        assert_eq!(decision.confidence, 0.0, "{token}");
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_KNOWN_VALID_WORD,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_VALID_WORD_BLOCK,
            0,
            "{token}",
        );
    }
}

#[test]
fn unknown_lowercase_alphabetic_tokens_are_marked_unresolved() {
    clear_loaded_dictionary();

    let decision = check_token("zzzzword");

    assert_eq!(decision.code, 2);
    assert_eq!(decision.replacement, "");
    assert_eq!(decision.confidence, 0.0);
    assert_ne!(decision.reason_flags & TYPAI_REASON_UNKNOWN_NON_WORD, 0);
    assert_ne!(
        decision.reason_flags & TYPAI_REASON_AUTOCORRECT_GATE_BLOCKED,
        0,
    );
    assert_ne!(decision.reason_flags & TYPAI_REASON_NO_SUGGESTIONS, 0);
}

#[test]
fn protected_looking_tokens_are_ignored() {
    clear_loaded_dictionary();

    for token in [
        "CVE-2024-1234",
        "/etc/passwd",
        "camelCaseIdentifier",
        "snake_case_identifier",
        "PascalCaseClass",
        "https://example.com",
        "user@example.com",
        "abc123",
        "name-with-hyphen",
        "path:segment",
    ] {
        let decision = check_token(token);

        assert_eq!(decision.code, 0, "{token}");
        assert_eq!(decision.replacement, "", "{token}");
        assert_eq!(decision.confidence, 0.0, "{token}");
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_PROTECTED_LOOKING_TOKEN,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_PROTECTED_TOKEN_BLOCK,
            0,
            "{token}",
        );
    }
}

#[test]
fn edit_distance_suggestions_include_seed_candidates() {
    clear_loaded_dictionary();

    for (token, expected) in [
        ("reciept", "receipt"),
        ("adress", "address"),
        ("corection", "correction"),
        ("speling", "spelling"),
    ] {
        let result = suggest_token(token);

        assert!(
            result.suggestions.iter().any(|suggestion| suggestion == expected),
            "{token} suggestions were {:?}",
            result.suggestions,
        );
        assert_eq!(
            result.suggestions.len(),
            result.scores.len(),
            "{token} should write one score per suggestion",
        );
        assert!(
            result.scores.iter().all(|score| score.is_finite() && *score > 0.0),
            "{token} scores were {:?}",
            result.scores,
        );
        assert_ne!(
            result.reason_flags & TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS,
            0,
            "{token}",
        );
        assert_ne!(
            result.reason_flags & TYPAI_REASON_DELETE_INDEX_SUGGESTIONS,
            0,
            "{token}",
        );
        assert_ne!(
            result.reason_flags & TYPAI_REASON_DELETE_INDEX_CANDIDATE,
            0,
            "{token}",
        );
        assert_ne!(
            result.reason_flags & TYPAI_REASON_FREQUENCY_RANKED,
            0,
            "{token}",
        );
    }
}

#[test]
fn distant_unknown_tokens_can_return_no_suggestions() {
    clear_loaded_dictionary();

    let result = suggest_token("zzzzword");

    assert!(result.suggestions.is_empty());
    assert!(result.scores.is_empty());
    assert_ne!(result.reason_flags & TYPAI_REASON_NO_SUGGESTIONS, 0);
}

#[test]
fn edit_distance_candidates_are_suggestions_only() {
    clear_loaded_dictionary();

    for token in ["reciept", "addres", "separat", "tomorow"] {
        let decision = check_token(token);

        assert_eq!(decision.code, 2, "{token}");
        assert_eq!(decision.replacement, "", "{token}");
        assert_eq!(decision.confidence, 0.0, "{token}");
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_UNKNOWN_NON_WORD,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_EDIT_DISTANCE_SUGGESTIONS,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_DELETE_INDEX_SUGGESTIONS,
            0,
            "{token}",
        );
        assert_ne!(
            decision.reason_flags & TYPAI_REASON_AUTOCORRECT_GATE_BLOCKED,
            0,
            "{token}",
        );
    }

    let valid_word = check_token("form");

    assert_eq!(valid_word.code, 0);
    assert_eq!(valid_word.replacement, "");
    assert_ne!(
        valid_word.reason_flags & TYPAI_REASON_KNOWN_VALID_WORD,
        0,
    );
}

#[test]
fn valid_mock_dictionary_blob_loads_and_counts_words() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();
    let (code, word_count, reason_flags) = load_dictionary_blob(&blob);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_OK);
    assert_eq!(word_count, mock_word_count(&blob));
    assert_eq!(loaded_dictionary_word_count(), mock_word_count(&blob));
    assert_ne!(reason_flags & TYPAI_REASON_DICTIONARY_LOADED, 0);

    clear_loaded_dictionary();
}

#[test]
fn delete_index_builds_after_dictionary_load() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);
    assert_eq!(loaded_dictionary_word_count(), mock_word_count(&blob));
    assert!(delete_index_entry_count() > loaded_dictionary_word_count());
    assert!(delete_index_memory_estimate_bytes() > 0);

    clear_loaded_dictionary();
}

#[test]
fn delete_index_clears_and_rebuilds_safely() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);
    assert!(delete_index_entry_count() > 0);

    clear_delete_index();

    assert_eq!(delete_index_entry_count(), 0);

    let result = suggest_token("adress");

    assert!(result.suggestions.iter().any(|suggestion| suggestion == "address"));
    assert!(delete_index_entry_count() > 0);

    clear_loaded_dictionary();
}

#[test]
fn malformed_dictionary_does_not_replace_existing_delete_index() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);

    let word_count_before = loaded_dictionary_word_count();
    let index_count_before = delete_index_entry_count();
    let index_memory_before = delete_index_memory_estimate_bytes();
    let mut invalid = blob;
    invalid[0] = b'X';

    assert_eq!(load_dictionary_blob(&invalid).0, TYPAI_DICTIONARY_LOAD_INVALID_MAGIC);
    assert_eq!(loaded_dictionary_word_count(), word_count_before);
    assert_eq!(delete_index_entry_count(), index_count_before);
    assert_eq!(delete_index_memory_estimate_bytes(), index_memory_before);
    assert!(suggest_token("adress").suggestions.iter().any(|suggestion| suggestion == "address"));

    clear_loaded_dictionary();
}

#[test]
fn delete_index_suggestions_are_duplicate_free_and_deterministic() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);

    let first = suggest_token("adress");
    let second = suggest_token("adress");
    let address_count = first
        .suggestions
        .iter()
        .filter(|suggestion| suggestion.as_str() == "address")
        .count();

    assert_eq!(first.suggestions, second.suggestions);
    assert_eq!(first.scores, second.scores);
    assert_eq!(address_count, 1);

    for (index, suggestion) in first.suggestions.iter().enumerate() {
        assert_eq!(
            first
                .suggestions
                .iter()
                .filter(|candidate| candidate.as_str() == suggestion)
                .count(),
            1,
            "duplicate suggestion at index {index}: {suggestion}",
        );
    }

    clear_loaded_dictionary();
}

#[test]
fn delete_index_suggests_host_dictionary_words_without_autocorrecting() {
    clear_loaded_dictionary();
    let blob = dictionary_blob(
        &[
            ("separate", 900, 0),
            ("tomorrow", 800, 0),
            ("address", 700, 0),
            ("spelling", 600, 0),
            ("correction", 500, 0),
        ],
        "en-US",
    );

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);

    for (token, expected) in [
        ("addres", "address"),
        ("spelng", "spelling"),
        ("corecton", "correction"),
        ("separat", "separate"),
        ("tomorow", "tomorrow"),
    ] {
        let suggestions = suggest_token(token);
        let decision = check_token(token);

        assert!(
            suggestions
                .suggestions
                .iter()
                .any(|suggestion| suggestion == expected),
            "{token} suggestions were {:?}",
            suggestions.suggestions,
        );
        assert_ne!(
            suggestions.reason_flags & TYPAI_REASON_DELETE_INDEX_SUGGESTIONS,
            0,
            "{token}",
        );
        assert_eq!(decision.code, 2, "{token}");
        assert_eq!(decision.replacement, "", "{token}");
    }

    clear_loaded_dictionary();
}

#[test]
fn loaded_dictionary_words_are_known_words() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();
    let (code, _, _) = load_dictionary_blob(&blob);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_OK);

    let decision = check_token("address");

    assert_eq!(decision.code, 0);
    assert_eq!(decision.replacement, "");
    assert_ne!(
        decision.reason_flags & TYPAI_REASON_DYNAMIC_DICTIONARY_MATCH,
        0,
    );

    let unknown = check_token("zzzzword");

    assert_eq!(unknown.code, 2);
    assert_ne!(unknown.reason_flags & TYPAI_REASON_UNKNOWN_NON_WORD, 0);

    clear_loaded_dictionary();
}

#[test]
fn invalid_dictionary_magic_is_rejected_without_replacing_current_dictionary() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();
    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);

    let mut invalid = blob;
    invalid[0] = b'X';
    let (code, word_count, reason_flags) = load_dictionary_blob(&invalid);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_INVALID_MAGIC);
    assert_eq!(word_count, 0);
    assert_ne!(reason_flags & TYPAI_REASON_DICTIONARY_INVALID_MAGIC, 0);
    assert!(loaded_dictionary_word_count() > 0);

    clear_loaded_dictionary();
}

#[test]
fn unsupported_dictionary_version_is_rejected() {
    clear_loaded_dictionary();
    let mut blob = mock_dictionary_blob();

    blob[8..12].copy_from_slice(&2u32.to_le_bytes());

    let (code, word_count, reason_flags) = load_dictionary_blob(&blob);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_UNSUPPORTED_VERSION);
    assert_eq!(word_count, 0);
    assert_ne!(
        reason_flags & TYPAI_REASON_DICTIONARY_UNSUPPORTED_VERSION,
        0,
    );
    assert_eq!(loaded_dictionary_word_count(), 0);
}

#[test]
fn truncated_dictionary_blob_is_rejected() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();
    let truncated = &blob[..blob.len() - 1];
    let (code, word_count, reason_flags) = load_dictionary_blob(truncated);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR);
    assert_eq!(word_count, 0);
    assert_ne!(reason_flags & TYPAI_REASON_DICTIONARY_BOUNDS_ERROR, 0);
    assert_eq!(loaded_dictionary_word_count(), 0);
}

#[test]
fn duplicate_dictionary_words_are_rejected_without_replacing_current_dictionary() {
    clear_loaded_dictionary();
    let mock = mock_dictionary_blob();
    assert_eq!(load_dictionary_blob(&mock).0, TYPAI_DICTIONARY_LOAD_OK);

    let duplicate = dictionary_blob(&[("alpha", 100, 0), ("alpha", 90, 0)], "en-US");
    let (code, word_count, reason_flags) = load_dictionary_blob(&duplicate);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR);
    assert_eq!(word_count, 0);
    assert_ne!(reason_flags & TYPAI_REASON_DICTIONARY_BOUNDS_ERROR, 0);
    assert_eq!(loaded_dictionary_word_count(), mock_word_count(&mock));

    clear_loaded_dictionary();
}

#[test]
fn protected_looking_dictionary_words_are_rejected() {
    clear_loaded_dictionary();
    let blob = dictionary_blob(&[("abc123", 100, 0)], "en-US");
    let (code, word_count, reason_flags) = load_dictionary_blob(&blob);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR);
    assert_eq!(word_count, 0);
    assert_ne!(reason_flags & TYPAI_REASON_DICTIONARY_BOUNDS_ERROR, 0);
    assert_eq!(loaded_dictionary_word_count(), 0);
}

#[test]
fn unsupported_dictionary_language_is_rejected() {
    clear_loaded_dictionary();
    let blob = dictionary_blob(&[("alpha", 100, 0)], "en-GB");
    let (code, word_count, reason_flags) = load_dictionary_blob(&blob);

    assert_eq!(code, TYPAI_DICTIONARY_LOAD_BOUNDS_ERROR);
    assert_eq!(word_count, 0);
    assert_ne!(reason_flags & TYPAI_REASON_DICTIONARY_BOUNDS_ERROR, 0);
    assert_eq!(loaded_dictionary_word_count(), 0);
}

#[test]
fn clearing_dictionary_resets_dynamic_count_and_keeps_builtin_engine() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);
    assert!(loaded_dictionary_word_count() > 0);

    clear_loaded_dictionary();

    assert_eq!(loaded_dictionary_word_count(), 0);

    let valid = check_token("form");
    assert_eq!(valid.code, 0);
    assert_ne!(valid.reason_flags & TYPAI_REASON_KNOWN_VALID_WORD, 0);

    let typo = check_token("teh");
    assert_eq!(typo.code, 1);
    assert_eq!(typo.replacement, "the");
    assert_ne!(typo.reason_flags & TYPAI_REASON_COMMON_TYPO_MATCH, 0);
}

#[test]
fn common_typo_corrections_still_work_after_dictionary_load() {
    clear_loaded_dictionary();
    let blob = mock_dictionary_blob();

    assert_eq!(load_dictionary_blob(&blob).0, TYPAI_DICTIONARY_LOAD_OK);

    let typo = check_token("teh");

    assert_eq!(typo.code, 1);
    assert_eq!(typo.replacement, "the");
    assert_ne!(typo.reason_flags & TYPAI_REASON_COMMON_TYPO_MATCH, 0);

    clear_loaded_dictionary();
}
