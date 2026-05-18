import { reasonFlagsToCodes, TypaiReasonFlag } from "./reasonFlags";
import { createMemoryStorage } from "./storage";
import type {
  CheckCompletedTokenInput,
  CorrectionDecision,
  CorrectionRule,
  CreateTypaiCoreOptions,
  ImportTypaiMemoryOptions,
  PersonalDictionaryEntry,
  ResetTypaiMemoryOptions,
  SuggestTokenInput,
  SuggestTokenResult,
  TypaiCore,
  TypaiDictionaryLoadSource,
  TypaiLanguage,
  TypaiMemoryExport,
  TypaiStorage,
} from "./types";
import type {
  TypaiWasmBindings,
  TypaiWasmDecision,
  TypaiWasmDictionaryLoadResult,
  TypaiWasmSuggestionResult,
} from "./wasmLoader";
import { loadTypaiWasm } from "./wasmLoader";

const defaultMaxSuggestions = 4;
const personalDictionaryNamespace = "personalDictionary";
const correctionRulesNamespace = "correctionRules";
const settingsNamespace = "settings";

interface UserState {
  personalDictionary: Set<string>;
  alwaysRulesByOriginal: Map<string, StoredCorrectionRule>;
  neverRulesByOriginalReplacement: Map<string, StoredCorrectionRule>;
}

type StoredCorrectionRule = CorrectionRule & {
  key: string;
};

export async function createTypaiCore(options: CreateTypaiCoreOptions = {}): Promise<TypaiCore> {
  const wasm = await loadTypaiWasm();
  wasm.clearLoadedDictionary();

  if (options.dictionary !== undefined) {
    await loadDictionarySource(wasm, options.dictionary);
  }

  const storage = options.storage ?? createMemoryStorage();
  const userState = await loadUserState(storage);
  const defaultLanguage = options.language ?? "en-US";

  return {
    checkCompletedToken(input: CheckCompletedTokenInput) {
      const language = input.language ?? defaultLanguage;

      return checkCompletedToken(wasm, userState, input.token, language);
    },
    suggestToken(input: SuggestTokenInput) {
      const language = input.language ?? defaultLanguage;

      return suggestToken(wasm, input.token, language, input.maxSuggestions);
    },
    getLoadedDictionaryWordCount() {
      return wasm.loadedDictionaryWordCount();
    },
    clearLoadedDictionary() {
      wasm.clearLoadedDictionary();
    },
    addToPersonalDictionary(word: string) {
      return addToPersonalDictionary(storage, userState, word);
    },
    removeFromPersonalDictionary(word: string) {
      return removeFromPersonalDictionary(storage, userState, word);
    },
    isInPersonalDictionary(word: string) {
      return userState.personalDictionary.has(normalizeTokenKey(word));
    },
    setAlwaysCorrect(original: string, replacement: string) {
      return setCorrectionRule(storage, userState, original, replacement, "always");
    },
    setNeverCorrect(original: string, replacement: string) {
      return setCorrectionRule(storage, userState, original, replacement, "never");
    },
    clearCorrectionRule(original: string, replacement?: string) {
      return clearCorrectionRule(storage, userState, original, replacement);
    },
    getCorrectionRule(original: string, replacement?: string) {
      return getCorrectionRule(userState, original, replacement);
    },
    exportTypaiMemory() {
      return exportTypaiMemory(storage);
    },
    importTypaiMemory(data: TypaiMemoryExport, importOptions?: ImportTypaiMemoryOptions) {
      return importTypaiMemory(storage, userState, data, importOptions);
    },
    resetTypaiMemory(resetOptions?: ResetTypaiMemoryOptions) {
      return resetTypaiMemory(storage, userState, resetOptions);
    },
  };
}

async function loadDictionarySource(
  wasm: TypaiWasmBindings,
  dictionary: TypaiDictionaryLoadSource,
): Promise<void> {
  const bytes = await resolveDictionaryBytes(dictionary);
  const result = wasm.loadDictionaryBlob(bytes);

  if (!result.success) {
    throw new Error(dictionaryLoadErrorMessage(result));
  }
}

async function resolveDictionaryBytes(dictionary: TypaiDictionaryLoadSource): Promise<Uint8Array> {
  if (dictionary.bytes !== undefined) {
    return dictionary.bytes;
  }

  if (dictionary.load !== undefined) {
    return dictionary.load();
  }

  if (dictionary.url !== undefined) {
    return loadDictionaryBytesFromUrl(dictionary.url);
  }

  throw new Error("Typai dictionary source must provide bytes, load, or url.");
}

async function loadDictionaryBytesFromUrl(url: string): Promise<Uint8Array> {
  const fetchDictionary = globalThis.fetch;

  if (fetchDictionary === undefined) {
    throw new Error("Typai dictionary URL loading requires globalThis.fetch.");
  }

  const response = await fetchDictionary(url);

  if (!response.ok) {
    throw new Error(`Typai dictionary request failed with HTTP ${response.status}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function dictionaryLoadErrorMessage(result: TypaiWasmDictionaryLoadResult): string {
  const reasonCodes = reasonFlagsToCodes(result.reasonFlags);
  const reasonSuffix = reasonCodes.length > 0 ? ` (${reasonCodes.join(", ")})` : "";
  const error = result.error ?? "dictionary load failed";

  return `Typai dictionary load failed: ${error}${reasonSuffix}`;
}

function checkCompletedToken(
  wasm: TypaiWasmBindings,
  userState: UserState,
  token: string,
  language: TypaiLanguage,
): CorrectionDecision {
  if (language !== "en-US") {
    return {
      action: "do_nothing",
      reasonCodes: ["UNSUPPORTED_LANGUAGE"],
    };
  }

  if (token.length === 0) {
    return {
      action: "do_nothing",
      reasonCodes: reasonFlagsToCodes(TypaiReasonFlag.INVALID_INPUT),
    };
  }

  const normalizedToken = normalizeTokenKey(token);

  if (userState.personalDictionary.has(normalizedToken)) {
    return {
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    };
  }

  const alwaysRule = userState.alwaysRulesByOriginal.get(normalizedToken);

  if (alwaysRule !== undefined) {
    return {
      action: "auto_correct",
      original: token,
      replacement: alwaysRule.replacement,
      confidence: 1,
      mark: "blue_applied_correction",
      reasonCodes: ["ALWAYS_CORRECT_RULE"],
    };
  }

  return wasmDecisionToCorrectionDecision(token, wasm, userState, wasm.checkToken(token));
}

function suggestToken(
  wasm: TypaiWasmBindings,
  token: string,
  language: TypaiLanguage,
  maxSuggestions = defaultMaxSuggestions,
): SuggestTokenResult {
  if (language !== "en-US") {
    return {
      suggestions: [],
      scores: [],
      reasonCodes: ["UNSUPPORTED_LANGUAGE"],
    };
  }

  if (token.length === 0) {
    return {
      suggestions: [],
      scores: [],
      reasonCodes: reasonFlagsToCodes(TypaiReasonFlag.INVALID_INPUT),
    };
  }

  return wasmSuggestionToSuggestionResult(wasm.suggestToken(token, maxSuggestions));
}

function wasmDecisionToCorrectionDecision(
  original: string,
  wasm: TypaiWasmBindings,
  userState: UserState,
  decision: TypaiWasmDecision,
): CorrectionDecision {
  const reasonCodes = reasonFlagsToCodes(decision.reasonFlags);

  if (decision.code === 1) {
    const neverRule = getNeverRuleForReplacement(userState, original, decision.replacement);

    if (neverRule !== null) {
      const suggestionResult = wasm.suggestToken(original, defaultMaxSuggestions);
      const suggestions = addUniqueSuggestion(suggestionResult.suggestions, decision.replacement);

      return {
        action: "mark_unresolved",
        original,
        suggestions,
        mark: "red_spelling_issue",
        reasonCodes: [...reasonCodes, "NEVER_CORRECT_RULE"],
      };
    }

    return {
      action: "auto_correct",
      original,
      replacement: decision.replacement,
      confidence: decision.confidence,
      mark: "blue_applied_correction",
      reasonCodes,
    };
  }

  if (decision.code === 2) {
    const suggestionResult = wasm.suggestToken(original, defaultMaxSuggestions);

    return {
      action: "mark_unresolved",
      original,
      suggestions: suggestionResult.suggestions,
      mark: "red_spelling_issue",
      reasonCodes,
    };
  }

  return {
    action: "do_nothing",
    reasonCodes,
  };
}

function wasmSuggestionToSuggestionResult(result: TypaiWasmSuggestionResult): SuggestTokenResult {
  return {
    suggestions: result.suggestions,
    scores: result.scores,
    reasonCodes: reasonFlagsToCodes(result.reasonFlags),
  };
}

async function loadUserState(storage: TypaiStorage): Promise<UserState> {
  const personalEntries = await storage.list<PersonalDictionaryEntry>(personalDictionaryNamespace);
  const correctionRuleEntries = await storage.list<CorrectionRule>(correctionRulesNamespace);
  const userState: UserState = {
    personalDictionary: new Set<string>(),
    alwaysRulesByOriginal: new Map<string, StoredCorrectionRule>(),
    neverRulesByOriginalReplacement: new Map<string, StoredCorrectionRule>(),
  };

  for (const { value } of personalEntries) {
    const key = normalizeTokenKey(value.word);

    if (key.length > 0) {
      userState.personalDictionary.add(key);
    }
  }

  for (const { key, value } of correctionRuleEntries) {
    insertLoadedCorrectionRule(userState, { ...value, key });
  }

  return userState;
}

async function addToPersonalDictionary(
  storage: TypaiStorage,
  userState: UserState,
  word: string,
): Promise<void> {
  const normalizedWord = normalizeTokenKey(word);

  if (normalizedWord.length === 0) {
    return;
  }

  const entry: PersonalDictionaryEntry = {
    word: normalizedWord,
    createdAt: Date.now(),
  };

  userState.personalDictionary.add(normalizedWord);

  return storage.set(personalDictionaryNamespace, normalizedWord, entry);
}

async function exportTypaiMemory(storage: TypaiStorage): Promise<TypaiMemoryExport> {
  const [personalEntries, correctionRuleEntries, settingEntries] = await Promise.all([
    storage.list<PersonalDictionaryEntry>(personalDictionaryNamespace),
    storage.list<CorrectionRule>(correctionRulesNamespace),
    storage.list<unknown>(settingsNamespace),
  ]);
  const settings = Object.fromEntries(
    settingEntries
      .filter(({ key }) => key.length > 0)
      .map(({ key, value }) => [key, cloneJsonValue(value)]),
  );
  const memory: TypaiMemoryExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    personalDictionary: personalEntries
      .map(({ value }) => ({
        word: normalizeTokenKey(value.word),
        createdAt: finiteTimestampOrUndefined(value.createdAt),
      }))
      .filter((entry) => entry.word.length > 0)
      .sort((left, right) => left.word.localeCompare(right.word)),
    correctionRules: correctionRuleEntries
      .map(({ value }) => normalizeExportedCorrectionRule(value))
      .filter((rule): rule is TypaiMemoryExport["correctionRules"][number] => rule !== null)
      .sort(
        (left, right) =>
          left.original.localeCompare(right.original) ||
          left.replacement.localeCompare(right.replacement) ||
          left.status.localeCompare(right.status),
      ),
  };

  if (Object.keys(settings).length > 0) {
    memory.settings = settings;
  }

  return memory;
}

async function importTypaiMemory(
  storage: TypaiStorage,
  userState: UserState,
  data: TypaiMemoryExport,
  options: ImportTypaiMemoryOptions = {},
): Promise<void> {
  const memory = validateTypaiMemoryExport(data);
  const shouldMerge = options.merge ?? false;

  if (!shouldMerge) {
    await resetTypaiMemory(storage, userState, {
      personalDictionary: true,
      correctionRules: true,
      settings: true,
    });
  }

  for (const entry of memory.personalDictionary) {
    await addToPersonalDictionaryWithCreatedAt(storage, userState, entry.word, entry.createdAt);
  }

  for (const rule of memory.correctionRules) {
    await setCorrectionRuleWithTimestamps(storage, userState, rule);
  }

  if (memory.settings !== undefined) {
    for (const [key, value] of Object.entries(memory.settings)) {
      await storage.set(settingsNamespace, key, cloneJsonValue(value));
    }
  }
}

async function resetTypaiMemory(
  storage: TypaiStorage,
  userState: UserState,
  options: ResetTypaiMemoryOptions = {},
): Promise<void> {
  const hasExplicitSelection =
    options.personalDictionary !== undefined ||
    options.correctionRules !== undefined ||
    options.settings !== undefined;
  const resetPersonalDictionary = options.personalDictionary ?? !hasExplicitSelection;
  const resetCorrectionRules = options.correctionRules ?? !hasExplicitSelection;
  const resetSettings = options.settings ?? !hasExplicitSelection;
  const clears: Array<Promise<void>> = [];

  if (resetPersonalDictionary) {
    userState.personalDictionary.clear();
    clears.push(storage.clear(personalDictionaryNamespace));
  }

  if (resetCorrectionRules) {
    userState.alwaysRulesByOriginal.clear();
    userState.neverRulesByOriginalReplacement.clear();
    clears.push(storage.clear(correctionRulesNamespace));
  }

  if (resetSettings) {
    clears.push(storage.clear(settingsNamespace));
  }

  await Promise.all(clears);
}

async function addToPersonalDictionaryWithCreatedAt(
  storage: TypaiStorage,
  userState: UserState,
  word: string,
  createdAt: number | undefined,
): Promise<void> {
  const normalizedWord = normalizeTokenKey(word);

  if (normalizedWord.length === 0) {
    return;
  }

  const entry: PersonalDictionaryEntry = {
    word: normalizedWord,
    createdAt: createdAt ?? Date.now(),
  };

  userState.personalDictionary.add(normalizedWord);

  await storage.set(personalDictionaryNamespace, normalizedWord, entry);
}

async function setCorrectionRuleWithTimestamps(
  storage: TypaiStorage,
  userState: UserState,
  rule: TypaiMemoryExport["correctionRules"][number],
): Promise<void> {
  const normalizedOriginal = normalizeTokenKey(rule.original);

  if (normalizedOriginal.length === 0 || rule.replacement.length === 0) {
    return;
  }

  const now = Date.now();
  const storedRule: StoredCorrectionRule = {
    original: normalizedOriginal,
    replacement: rule.replacement,
    status: rule.status,
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? rule.createdAt ?? now,
    key: correctionRuleStorageKey(rule.status, normalizedOriginal, rule.replacement),
  };

  if (storedRule.status === "always") {
    const previous = userState.alwaysRulesByOriginal.get(normalizedOriginal);

    if (previous !== undefined && previous.key !== storedRule.key) {
      await storage.delete(correctionRulesNamespace, previous.key);
    }
  }

  insertLoadedCorrectionRule(userState, storedRule);
  await storage.set(correctionRulesNamespace, storedRule.key, stripStorageKey(storedRule));
}

function validateTypaiMemoryExport(data: TypaiMemoryExport): TypaiMemoryExport {
  if (!isPlainObject(data)) {
    throw new Error("Typai memory import must be an object.");
  }

  if (data.version !== 1) {
    throw new Error("Unsupported Typai memory export version.");
  }

  if (typeof data.exportedAt !== "string" || Number.isNaN(Date.parse(data.exportedAt))) {
    throw new Error("Typai memory export has an invalid exportedAt value.");
  }

  if (!Array.isArray(data.personalDictionary)) {
    throw new Error("Typai memory export personalDictionary must be an array.");
  }

  if (!Array.isArray(data.correctionRules)) {
    throw new Error("Typai memory export correctionRules must be an array.");
  }

  const personalDictionary = data.personalDictionary.map(validatePersonalDictionaryExportEntry);
  const correctionRules = data.correctionRules.map(validateCorrectionRuleExportEntry);
  const memory: TypaiMemoryExport = {
    version: 1,
    exportedAt: data.exportedAt,
    personalDictionary,
    correctionRules,
  };

  if (data.settings !== undefined) {
    if (!isPlainObject(data.settings)) {
      throw new Error("Typai memory export settings must be an object.");
    }

    memory.settings = cloneJsonValue(data.settings) as Record<string, unknown>;
  }

  return memory;
}

function validatePersonalDictionaryExportEntry(
  entry: unknown,
): TypaiMemoryExport["personalDictionary"][number] {
  if (!isPlainObject(entry) || typeof entry.word !== "string") {
    throw new Error("Typai memory personalDictionary entries must include a word.");
  }

  const word = normalizeTokenKey(entry.word);

  if (word.length === 0) {
    throw new Error("Typai memory personalDictionary entries cannot be empty.");
  }

  return {
    word,
    createdAt: optionalFiniteTimestamp(entry.createdAt, "personalDictionary.createdAt"),
  };
}

function validateCorrectionRuleExportEntry(
  entry: unknown,
): TypaiMemoryExport["correctionRules"][number] {
  if (
    !isPlainObject(entry) ||
    typeof entry.original !== "string" ||
    typeof entry.replacement !== "string" ||
    (entry.status !== "always" && entry.status !== "never")
  ) {
    throw new Error("Typai memory correctionRules entries are malformed.");
  }

  const original = normalizeTokenKey(entry.original);

  if (original.length === 0 || entry.replacement.length === 0) {
    throw new Error("Typai memory correctionRules entries cannot be empty.");
  }

  return {
    original,
    replacement: entry.replacement,
    status: entry.status,
    createdAt: optionalFiniteTimestamp(entry.createdAt, "correctionRules.createdAt"),
    updatedAt: optionalFiniteTimestamp(entry.updatedAt, "correctionRules.updatedAt"),
  };
}

function normalizeExportedCorrectionRule(
  value: CorrectionRule,
): TypaiMemoryExport["correctionRules"][number] | null {
  if (
    typeof value.original !== "string" ||
    typeof value.replacement !== "string" ||
    (value.status !== "always" && value.status !== "never")
  ) {
    return null;
  }

  const original = normalizeTokenKey(value.original);

  if (original.length === 0 || value.replacement.length === 0) {
    return null;
  }

  return {
    original,
    replacement: value.replacement,
    status: value.status,
    createdAt: finiteTimestampOrUndefined(value.createdAt),
    updatedAt: finiteTimestampOrUndefined(value.updatedAt),
  };
}

function optionalFiniteTimestamp(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Typai memory ${label} must be a finite non-negative number.`);
  }

  return value;
}

function finiteTimestampOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function cloneJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function removeFromPersonalDictionary(
  storage: TypaiStorage,
  userState: UserState,
  word: string,
): Promise<void> {
  const normalizedWord = normalizeTokenKey(word);

  userState.personalDictionary.delete(normalizedWord);

  return storage.delete(personalDictionaryNamespace, normalizedWord);
}

async function setCorrectionRule(
  storage: TypaiStorage,
  userState: UserState,
  original: string,
  replacement: string,
  status: CorrectionRule["status"],
): Promise<void> {
  const normalizedOriginal = normalizeTokenKey(original);

  if (normalizedOriginal.length === 0 || replacement.length === 0) {
    return;
  }

  const now = Date.now();
  const existing =
    status === "always"
      ? userState.alwaysRulesByOriginal.get(normalizedOriginal)
      : userState.neverRulesByOriginalReplacement.get(rulePairKey(normalizedOriginal, replacement));
  const rule: StoredCorrectionRule = {
    original: normalizedOriginal,
    replacement,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    key: correctionRuleStorageKey(status, normalizedOriginal, replacement),
  };

  if (status === "always") {
    const previous = userState.alwaysRulesByOriginal.get(normalizedOriginal);
    const deletePrevious =
      previous !== undefined && previous.key !== rule.key
        ? storage.delete(correctionRulesNamespace, previous.key)
        : Promise.resolve();

    userState.alwaysRulesByOriginal.set(normalizedOriginal, rule);
    await deletePrevious;
  } else {
    userState.neverRulesByOriginalReplacement.set(
      rulePairKey(normalizedOriginal, replacement),
      rule,
    );
  }

  return storage.set(correctionRulesNamespace, rule.key, stripStorageKey(rule));
}

async function clearCorrectionRule(
  storage: TypaiStorage,
  userState: UserState,
  original: string,
  replacement?: string,
): Promise<void> {
  const normalizedOriginal = normalizeTokenKey(original);
  const keysToDelete: string[] = [];
  const alwaysRule = userState.alwaysRulesByOriginal.get(normalizedOriginal);

  if (
    alwaysRule !== undefined &&
    (replacement === undefined || alwaysRule.replacement === replacement)
  ) {
    userState.alwaysRulesByOriginal.delete(normalizedOriginal);
    keysToDelete.push(alwaysRule.key);
  }

  for (const [key, rule] of userState.neverRulesByOriginalReplacement) {
    if (
      rule.original === normalizedOriginal &&
      (replacement === undefined || rule.replacement === replacement)
    ) {
      userState.neverRulesByOriginalReplacement.delete(key);
      keysToDelete.push(rule.key);
    }
  }

  await Promise.all(keysToDelete.map((key) => storage.delete(correctionRulesNamespace, key)));
}

function getCorrectionRule(
  userState: UserState,
  original: string,
  replacement?: string,
): CorrectionRule | null {
  const normalizedOriginal = normalizeTokenKey(original);

  if (replacement !== undefined) {
    const exactNeverRule = userState.neverRulesByOriginalReplacement.get(
      rulePairKey(normalizedOriginal, replacement),
    );
    const alwaysRule = userState.alwaysRulesByOriginal.get(normalizedOriginal);
    const exactAlwaysRule = alwaysRule?.replacement === replacement ? alwaysRule : undefined;
    const rule = exactNeverRule ?? exactAlwaysRule;

    return rule === undefined ? null : stripStorageKey(rule);
  }

  const rule =
    userState.alwaysRulesByOriginal.get(normalizedOriginal) ??
    [...userState.neverRulesByOriginalReplacement.values()].find(
      (candidate) => candidate.original === normalizedOriginal,
    );

  return rule === undefined ? null : stripStorageKey(rule);
}

function getNeverRuleForReplacement(
  userState: UserState,
  original: string,
  replacement: string,
): CorrectionRule | null {
  const rule = userState.neverRulesByOriginalReplacement.get(
    rulePairKey(normalizeTokenKey(original), replacement),
  );

  return rule === undefined ? null : stripStorageKey(rule);
}

function insertLoadedCorrectionRule(userState: UserState, rule: StoredCorrectionRule): void {
  const normalizedOriginal = normalizeTokenKey(rule.original);

  if (normalizedOriginal.length === 0 || rule.replacement.length === 0) {
    return;
  }

  const normalizedRule = {
    ...rule,
    original: normalizedOriginal,
    key: rule.key || correctionRuleStorageKey(rule.status, normalizedOriginal, rule.replacement),
  };

  if (normalizedRule.status === "always") {
    userState.alwaysRulesByOriginal.set(normalizedOriginal, normalizedRule);
    return;
  }

  if (normalizedRule.status === "never") {
    userState.neverRulesByOriginalReplacement.set(
      rulePairKey(normalizedOriginal, normalizedRule.replacement),
      normalizedRule,
    );
  }
}

function normalizeTokenKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function rulePairKey(original: string, replacement: string): string {
  return `${original}\u0000${replacement}`;
}

function correctionRuleStorageKey(
  status: CorrectionRule["status"],
  original: string,
  replacement: string,
): string {
  return `${status}:${encodeURIComponent(original)}:${encodeURIComponent(replacement)}`;
}

function stripStorageKey(rule: StoredCorrectionRule): CorrectionRule {
  return {
    original: rule.original,
    replacement: rule.replacement,
    status: rule.status,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function addUniqueSuggestion(suggestions: string[], suggestion: string): string[] {
  return [suggestion, ...suggestions.filter((candidate) => candidate !== suggestion)];
}
