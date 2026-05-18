import { DEFAULT_MAX_COMPLETION_CHARS } from "./context";

export type SanitizeCompletionInput = {
  text: string;
  contextBefore?: string;
  maxCompletionChars?: number;
  stopSequences?: string[];
  trimDuplicatePrefix?: boolean;
  removeSurroundingQuotes?: boolean;
};

export type SanitizeCompletionOptions = {
  maxCompletionChars?: number;
  stopSequences?: string[];
  contextBefore?: string;
  trimDuplicatePrefix?: boolean;
  removeSurroundingQuotes?: boolean;
};

export function sanitizeCompletionText(input: SanitizeCompletionInput): string;
export function sanitizeCompletionText(text: string, options?: SanitizeCompletionOptions): string;
export function sanitizeCompletionText(
  inputOrText: string | SanitizeCompletionInput,
  options: SanitizeCompletionOptions = {},
): string {
  const input = typeof inputOrText === "string" ? { ...options, text: inputOrText } : inputOrText;
  const maxCompletionChars = normalizeMaxCompletionChars(input.maxCompletionChars);
  const contextBefore = input.contextBefore ?? "";
  const shouldTrimDuplicatePrefix = input.trimDuplicatePrefix ?? true;
  const shouldRemoveSurroundingQuotes = input.removeSurroundingQuotes ?? true;
  let text = input.text;

  if (text.trim().length === 0) {
    return "";
  }

  if (shouldRemoveSurroundingQuotes) {
    text = removeSafeSurroundingQuotes(text);
  }

  text = applyStopSequences(text, input.stopSequences ?? []);

  if (shouldTrimDuplicatePrefix && contextBefore.length > 0) {
    text = trimDuplicateCompletionPrefix(text, contextBefore);
  }

  text = normalizeCompletionWhitespace(text, contextBefore);

  if (text.length === 0) {
    return "";
  }

  return text.slice(0, maxCompletionChars).trimEnd();
}

export function trimDuplicateCompletionPrefix(text: string, contextBefore: string): string {
  const overlapLength = findLongestSuffixPrefixOverlap(contextBefore, text);

  if (overlapLength === 0) {
    return text;
  }

  return text.slice(overlapLength);
}

function normalizeMaxCompletionChars(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_COMPLETION_CHARS;
  }

  return Math.max(0, Math.floor(value));
}

function applyStopSequences(text: string, stopSequences: string[]): string {
  let end = text.length;

  for (const stopSequence of stopSequences) {
    if (stopSequence.length === 0) {
      continue;
    }

    const index = text.indexOf(stopSequence);
    if (index >= 0) {
      end = Math.min(end, index);
    }
  }

  return text.slice(0, end);
}

function removeSafeSurroundingQuotes(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length < 2) {
    return text;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if (!isMatchingQuote(first, last)) {
    return text;
  }

  const inner = trimmed.slice(1, -1);

  if (inner.trim().length === 0 || inner.includes(first)) {
    return text;
  }

  return inner;
}

function isMatchingQuote(first: string | undefined, last: string | undefined): boolean {
  return (
    (first === `"` && last === `"`) ||
    (first === "'" && last === "'") ||
    (first === "`" && last === "`")
  );
}

function normalizeCompletionWhitespace(text: string, contextBefore: string): string {
  let normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  if (normalized.trim().length === 0) {
    return "";
  }

  normalized = normalized.replace(/^\n+/, "").trimEnd();

  const leadingWhitespace = normalized.match(/^[ \t]+/)?.[0] ?? "";

  if (leadingWhitespace.length === 0) {
    return normalized;
  }

  const rest = normalized.slice(leadingWhitespace.length);

  if (contextBefore.length > 0 && !/\s$/.test(contextBefore) && startsWithWordLikeCharacter(rest)) {
    return ` ${rest}`;
  }

  return rest;
}

function startsWithWordLikeCharacter(text: string): boolean {
  return /^[A-Za-z0-9]/.test(text);
}

function findLongestSuffixPrefixOverlap(contextBefore: string, text: string): number {
  const maxOverlapLength = Math.min(contextBefore.length, text.length);

  for (let length = maxOverlapLength; length > 0; length -= 1) {
    if (contextBefore.slice(-length) === text.slice(0, length)) {
      return length;
    }
  }

  return 0;
}
