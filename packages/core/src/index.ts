export const TYPAI_CORE_VERSION = "0.0.0-dev";

export { createTypaiCore } from "./createTypaiCore";
export { classifyToken, isProtectedTokenText } from "./protectedSpans";
export type { CreateIndexedDbStorageOptions } from "./storage";
export { createIndexedDbStorage, createMemoryStorage } from "./storage";
export { getTokenBeforeOffset, isDelimiter } from "./tokenization";
export type {
  CheckCompletedTokenInput,
  CorrectionAction,
  CorrectionDecision,
  CorrectionMark,
  CorrectionRule,
  CorrectionRuleStatus,
  CreateTypaiCoreOptions,
  ImportTypaiMemoryOptions,
  PersonalDictionaryEntry,
  ResetTypaiMemoryOptions,
  SuggestTokenInput,
  SuggestTokenResult,
  Token,
  TokenType,
  TypaiCore,
  TypaiDictionaryLoadResult,
  TypaiDictionaryLoadSource,
  TypaiLanguage,
  TypaiMemoryExport,
  TypaiRange,
  TypaiStorage,
} from "./types";
