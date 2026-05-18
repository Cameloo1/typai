export interface TypaiWasmDecision {
  readonly code: number;
  readonly replacement: string;
  readonly confidence: number;
  readonly reasonFlags: number;
}

export interface TypaiWasmSuggestionResult {
  readonly suggestions: string[];
  readonly scores: number[];
  readonly reasonFlags: number;
}

export interface TypaiWasmDictionaryLoadResult {
  readonly success: boolean;
  readonly wordCount: number;
  readonly reasonFlags: number;
  readonly error?: string;
}

export interface TypaiWasmBindings {
  checkToken(token: string): TypaiWasmDecision;
  suggestToken(token: string, maxSuggestions?: number): TypaiWasmSuggestionResult;
  loadDictionaryBlob(bytes: Uint8Array): TypaiWasmDictionaryLoadResult;
  clearLoadedDictionary(): void;
  loadedDictionaryWordCount(): number;
}

interface TypaiWasmModule {
  default(input?: { module_or_path: BufferSource | Promise<BufferSource> }): Promise<unknown>;
  check_token(token: string): unknown;
  suggest_token(token: string, max_suggestions?: number): unknown;
  load_dictionary_blob(bytes: Uint8Array): unknown;
  clear_loaded_dictionary(): void;
  loaded_dictionary_word_count(): number;
}

let wasmBindingsPromise: Promise<TypaiWasmBindings> | undefined;

export async function loadTypaiWasm(): Promise<TypaiWasmBindings> {
  wasmBindingsPromise ??= initializeTypaiWasm();

  return wasmBindingsPromise;
}

async function initializeTypaiWasm(): Promise<TypaiWasmBindings> {
  const wasmModuleUrl = new URL("../pkg/typai_wasm.js", import.meta.url);
  const wasmModule = (await import(/* @vite-ignore */ wasmModuleUrl.href)) as TypaiWasmModule;

  if (isNodeRuntime()) {
    const wasmBinaryUrl = new URL("../pkg/typai_wasm_bg.wasm", import.meta.url);
    const nodeFsPromises = "node:fs/promises";
    const { readFile } = (await import(/* @vite-ignore */ nodeFsPromises)) as {
      readFile(path: URL): Promise<BufferSource>;
    };

    await wasmModule.default({ module_or_path: await readFile(wasmBinaryUrl) });
  } else {
    await wasmModule.default();
  }

  return {
    checkToken(token: string) {
      return normalizeWasmDecision(wasmModule.check_token(token));
    },
    suggestToken(token: string, maxSuggestions?: number) {
      return normalizeWasmSuggestionResult(wasmModule.suggest_token(token, maxSuggestions));
    },
    loadDictionaryBlob(bytes: Uint8Array) {
      return normalizeDictionaryLoadResult(wasmModule.load_dictionary_blob(bytes));
    },
    clearLoadedDictionary() {
      wasmModule.clear_loaded_dictionary();
    },
    loadedDictionaryWordCount() {
      return wasmModule.loaded_dictionary_word_count();
    },
  };
}

function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions !== undefined &&
    process.versions.node !== undefined
  );
}

function normalizeWasmDecision(value: unknown): TypaiWasmDecision {
  if (value === null || typeof value !== "object") {
    return fallbackDecision();
  }

  const raw = value as Record<string, unknown>;
  const code = typeof raw.code === "number" ? raw.code : 0;
  const replacement = typeof raw.replacement === "string" ? raw.replacement : "";
  const confidence = typeof raw.confidence === "number" ? raw.confidence : 0;
  const reasonFlags = typeof raw.reasonFlags === "number" ? raw.reasonFlags : 0;

  return {
    code,
    replacement,
    confidence,
    reasonFlags,
  };
}

function fallbackDecision(): TypaiWasmDecision {
  return {
    code: 0,
    replacement: "",
    confidence: 0,
    reasonFlags: 0,
  };
}

function normalizeWasmSuggestionResult(value: unknown): TypaiWasmSuggestionResult {
  if (value === null || typeof value !== "object") {
    return fallbackSuggestionResult();
  }

  const raw = value as Record<string, unknown>;
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.filter((suggestion): suggestion is string => typeof suggestion === "string")
    : [];
  const scores = Array.isArray(raw.scores)
    ? raw.scores.filter((score): score is number => typeof score === "number")
    : [];
  const reasonFlags = typeof raw.reasonFlags === "number" ? raw.reasonFlags : 0;

  return {
    suggestions,
    scores,
    reasonFlags,
  };
}

function fallbackSuggestionResult(): TypaiWasmSuggestionResult {
  return {
    suggestions: [],
    scores: [],
    reasonFlags: 0,
  };
}

function normalizeDictionaryLoadResult(value: unknown): TypaiWasmDictionaryLoadResult {
  if (value === null || typeof value !== "object") {
    return fallbackDictionaryLoadResult("invalid load result");
  }

  const raw = value as Record<string, unknown>;
  const success = typeof raw.success === "boolean" ? raw.success : false;
  const wordCount = typeof raw.wordCount === "number" ? raw.wordCount : 0;
  const reasonFlags = typeof raw.reasonFlags === "number" ? raw.reasonFlags : 0;
  const error = typeof raw.error === "string" ? raw.error : undefined;

  return {
    success,
    wordCount,
    reasonFlags,
    ...(error === undefined ? {} : { error }),
  };
}

function fallbackDictionaryLoadResult(error: string): TypaiWasmDictionaryLoadResult {
  return {
    success: false,
    wordCount: 0,
    reasonFlags: 0,
    error,
  };
}
