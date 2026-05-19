export type TypaiLanguage = "en-US";

export interface TypaiRange {
  start: number;
  end: number;
}

export type TokenType =
  | "word"
  | "url"
  | "email"
  | "path"
  | "code"
  | "identifier"
  | "number"
  | "mixed";

export interface Token {
  text: string;
  normalized: string;
  range: TypaiRange;
  tokenType: TokenType;
  protected: boolean;
  language?: TypaiLanguage;
}

export type CorrectionAction = "auto_correct" | "mark_unresolved" | "do_nothing";

export type CorrectionMark = "blue_applied_correction" | "red_spelling_issue";

export type CorrectionDecision =
  | {
      action: "auto_correct";
      original: string;
      replacement: string;
      confidence: number;
      mark: "blue_applied_correction";
      reasonCodes: string[];
    }
  | {
      action: "mark_unresolved";
      original: string;
      suggestions: string[];
      mark: "red_spelling_issue";
      reasonCodes: string[];
    }
  | {
      action: "do_nothing";
      reasonCodes: string[];
    };

export interface CheckCompletedTokenInput {
  token: string;
  language?: TypaiLanguage;
}

export interface SuggestTokenInput {
  token: string;
  language?: TypaiLanguage;
  maxSuggestions?: number;
}

export interface SuggestTokenResult {
  suggestions: string[];
  scores: number[];
  reasonCodes: string[];
}

export type TypaiDictionaryMode = "built-in" | "host-provided" | "production";

export interface TypaiDictionaryLoadSource {
  mode?: TypaiDictionaryMode;
  bytes?: Uint8Array;
  url?: string;
  load?: () => Promise<Uint8Array>;
}

export interface TypaiDictionaryLoadResult {
  success: boolean;
  wordCount: number;
  reasonFlags: number;
  error?: string;
}

export interface TypaiStorage {
  get<T>(namespace: string, key: string): Promise<T | null>;
  set<T>(namespace: string, key: string, value: T): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  list<T>(namespace: string): Promise<Array<{ key: string; value: T }>>;
  clear(namespace: string): Promise<void>;
}

export interface PersonalDictionaryEntry {
  word: string;
  createdAt: number;
}

export type CorrectionRuleStatus = "always" | "never";

export interface CorrectionRule {
  original: string;
  replacement: string;
  status: CorrectionRuleStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TypaiMemoryExport {
  version: 1;
  exportedAt: string;
  personalDictionary: Array<{
    word: string;
    createdAt?: number;
  }>;
  correctionRules: Array<{
    original: string;
    replacement: string;
    status: CorrectionRuleStatus;
    createdAt?: number;
    updatedAt?: number;
  }>;
  settings?: Record<string, unknown>;
}

export interface ImportTypaiMemoryOptions {
  merge?: boolean;
}

export interface ResetTypaiMemoryOptions {
  personalDictionary?: boolean;
  correctionRules?: boolean;
  settings?: boolean;
}

export interface TypaiCore {
  checkCompletedToken(input: CheckCompletedTokenInput): CorrectionDecision;
  suggestToken(input: SuggestTokenInput): SuggestTokenResult;
  getLoadedDictionaryWordCount(): number;
  getDeleteIndexEntryCount(): number;
  getDeleteIndexMemoryEstimateBytes(): number;
  clearLoadedDictionary(): void;
  addToPersonalDictionary(word: string): Promise<void>;
  removeFromPersonalDictionary(word: string): Promise<void>;
  isInPersonalDictionary(word: string): boolean;
  setAlwaysCorrect(original: string, replacement: string): Promise<void>;
  setNeverCorrect(original: string, replacement: string): Promise<void>;
  clearCorrectionRule(original: string, replacement?: string): Promise<void>;
  getCorrectionRule(original: string, replacement?: string): CorrectionRule | null;
  exportTypaiMemory(): Promise<TypaiMemoryExport>;
  importTypaiMemory(data: TypaiMemoryExport, options?: ImportTypaiMemoryOptions): Promise<void>;
  resetTypaiMemory(options?: ResetTypaiMemoryOptions): Promise<void>;
}

export interface CreateTypaiCoreOptions {
  language?: TypaiLanguage;
  storage?: TypaiStorage;
  dictionary?: TypaiDictionaryLoadSource;
}
