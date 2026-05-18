use core::ffi::c_char;

use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

const DEFAULT_MAX_SUGGESTIONS: u32 = 4;
const MAX_SUGGESTIONS_CAP: u32 = 8;
const MAX_SUGGESTIONS_CAP_USIZE: usize = 8;
const SUGGESTION_SLOT_CAP: usize = 32;
const SUGGESTION_BUFFER_CAP: usize = MAX_SUGGESTIONS_CAP_USIZE * SUGGESTION_SLOT_CAP;

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
}

#[wasm_bindgen]
pub fn typai_wasm_version() -> String {
    "0.0.0-dev".to_string()
}

#[wasm_bindgen]
pub fn check_token(token: &str) -> JsValue {
    let mut replacement = [0 as c_char; 128];
    let mut confidence = 0.0;
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

    decision_to_js_value(
        code,
        replacement_buffer_to_string(&replacement),
        confidence,
        reason_flags,
    )
}

#[wasm_bindgen]
pub fn suggest_token(token: &str, max_suggestions: Option<u32>) -> JsValue {
    let max_suggestions = max_suggestions
        .unwrap_or(DEFAULT_MAX_SUGGESTIONS)
        .clamp(1, MAX_SUGGESTIONS_CAP);
    let mut suggestions = [0 as c_char; SUGGESTION_BUFFER_CAP];
    let mut scores = [0.0_f64; MAX_SUGGESTIONS_CAP_USIZE];
    let mut reason_flags = 0;

    let count = unsafe {
        typai_suggest_token(
            token.as_ptr().cast::<c_char>(),
            token.len() as u32,
            suggestions.as_mut_ptr(),
            suggestions.len() as u32,
            max_suggestions,
            SUGGESTION_SLOT_CAP as u32,
            scores.as_mut_ptr(),
            scores.len() as u32,
            &mut reason_flags,
        )
    } as usize;

    suggestions_to_js_value(
        &suggestions,
        &scores,
        count.min(max_suggestions as usize),
        reason_flags,
    )
}

#[wasm_bindgen]
pub fn load_dictionary_blob(bytes: &[u8]) -> JsValue {
    let mut word_count = 0;
    let mut reason_flags = 0;
    let code = unsafe {
        typai_load_dictionary_blob(
            bytes.as_ptr(),
            bytes.len() as u32,
            &mut word_count,
            &mut reason_flags,
        )
    };

    dictionary_load_result_to_js_value(code, word_count, reason_flags)
}

#[wasm_bindgen]
pub fn clear_loaded_dictionary() {
    unsafe {
        typai_clear_loaded_dictionary();
    }
}

#[wasm_bindgen]
pub fn loaded_dictionary_word_count() -> u32 {
    unsafe { typai_loaded_dictionary_word_count() }
}

fn replacement_buffer_to_string(buffer: &[c_char]) -> String {
    let null_index = buffer
        .iter()
        .position(|byte| *byte == 0 as c_char)
        .unwrap_or(buffer.len());

    let bytes = buffer[..null_index]
        .iter()
        .map(|byte| *byte as u8)
        .collect::<Vec<u8>>();

    String::from_utf8(bytes).unwrap_or_default()
}

fn suggestion_slot_to_string(buffer: &[c_char], index: usize) -> String {
    let start = index * SUGGESTION_SLOT_CAP;
    let end = start + SUGGESTION_SLOT_CAP;

    replacement_buffer_to_string(&buffer[start..end])
}

fn decision_to_js_value(
    code: i32,
    replacement: String,
    confidence: f64,
    reason_flags: u32,
) -> JsValue {
    let decision = Object::new();

    Reflect::set(&decision, &JsValue::from_str("code"), &JsValue::from_f64(code as f64))
        .expect("setting code on a fresh object should not fail");
    Reflect::set(
        &decision,
        &JsValue::from_str("replacement"),
        &JsValue::from_str(&replacement),
    )
    .expect("setting replacement on a fresh object should not fail");
    Reflect::set(
        &decision,
        &JsValue::from_str("confidence"),
        &JsValue::from_f64(confidence),
    )
    .expect("setting confidence on a fresh object should not fail");
    Reflect::set(
        &decision,
        &JsValue::from_str("reasonFlags"),
        &JsValue::from_f64(reason_flags as f64),
    )
    .expect("setting reasonFlags on a fresh object should not fail");

    decision.into()
}

fn suggestions_to_js_value(
    suggestion_buffer: &[c_char],
    scores: &[f64],
    count: usize,
    reason_flags: u32,
) -> JsValue {
    let result = Object::new();
    let suggestions = Array::new();
    let score_values = Array::new();

    for index in 0..count {
        suggestions.push(&JsValue::from_str(&suggestion_slot_to_string(
            suggestion_buffer,
            index,
        )));
        score_values.push(&JsValue::from_f64(scores[index]));
    }

    Reflect::set(&result, &JsValue::from_str("suggestions"), &suggestions)
        .expect("setting suggestions on a fresh object should not fail");
    Reflect::set(&result, &JsValue::from_str("scores"), &score_values)
        .expect("setting scores on a fresh object should not fail");
    Reflect::set(
        &result,
        &JsValue::from_str("reasonFlags"),
        &JsValue::from_f64(reason_flags as f64),
    )
    .expect("setting reasonFlags on a fresh object should not fail");

    result.into()
}

fn dictionary_load_result_to_js_value(code: i32, word_count: u32, reason_flags: u32) -> JsValue {
    let result = Object::new();

    Reflect::set(
        &result,
        &JsValue::from_str("success"),
        &JsValue::from_bool(code > 0),
    )
    .expect("setting success on a fresh object should not fail");
    Reflect::set(
        &result,
        &JsValue::from_str("wordCount"),
        &JsValue::from_f64(word_count as f64),
    )
    .expect("setting wordCount on a fresh object should not fail");
    Reflect::set(
        &result,
        &JsValue::from_str("reasonFlags"),
        &JsValue::from_f64(reason_flags as f64),
    )
    .expect("setting reasonFlags on a fresh object should not fail");

    if code <= 0 {
        Reflect::set(
            &result,
            &JsValue::from_str("error"),
            &JsValue::from_str(dictionary_load_error(code)),
        )
        .expect("setting error on a fresh object should not fail");
    }

    result.into()
}

fn dictionary_load_error(code: i32) -> &'static str {
    match code {
        -1 => "invalid input",
        -2 => "invalid magic",
        -3 => "unsupported version",
        -4 => "bounds error",
        -5 => "empty dictionary",
        _ => "dictionary load failed",
    }
}
