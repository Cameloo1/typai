import { classifyToken } from "./protectedSpans";
import type { Token } from "./types";

const trailingDelimiters = new Set([".", ",", "!", "?", ";", ":", ")", "]", "}"]);
const tokenBoundaries = new Set([",", "!", "?", ";", "(", ")", "[", "]", "{", "}"]);

export function isDelimiter(char: string): boolean {
  return (
    char === " " ||
    char === "\n" ||
    char === "\t" ||
    char === "." ||
    char === "," ||
    char === "!" ||
    char === "?" ||
    char === ";" ||
    char === ":" ||
    char === ")" ||
    char === "]" ||
    char === "}"
  );
}

export function getTokenBeforeOffset(text: string, offset: number): Token | null {
  let end = clampOffset(offset, text.length);

  while (end > 0 && isWhitespace(text[end - 1] ?? "")) {
    end -= 1;
  }

  while (end > 0 && trailingDelimiters.has(text[end - 1] ?? "")) {
    end -= 1;
  }

  if (end === 0) {
    return null;
  }

  let start = end;

  while (start > 0 && !isTokenBoundary(text[start - 1] ?? "")) {
    start -= 1;
  }

  const tokenText = text.slice(start, end);

  if (tokenText.length === 0) {
    return null;
  }

  const classification = classifyToken(tokenText);

  return {
    text: tokenText,
    normalized: tokenText.toLocaleLowerCase("en-US"),
    range: {
      start,
      end,
    },
    tokenType: classification.tokenType,
    protected: classification.protected,
    language: "en-US",
  };
}

function clampOffset(offset: number, textLength: number): number {
  if (!Number.isFinite(offset)) {
    return textLength;
  }

  return Math.max(0, Math.min(textLength, Math.trunc(offset)));
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t";
}

function isTokenBoundary(char: string): boolean {
  return isWhitespace(char) || tokenBoundaries.has(char);
}
