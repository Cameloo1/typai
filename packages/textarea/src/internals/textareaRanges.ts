import type { TextareaRange } from "../types";

export type TextareaRangeStillMatchesInput = {
  textarea: HTMLTextAreaElement;
  range: TextareaRange;
  expectedText: string;
  version: number;
  currentVersion: number;
};

export function rangeStillMatches(input: TextareaRangeStillMatchesInput): boolean {
  if (input.version !== input.currentVersion) {
    return false;
  }

  if (!isValidTextareaRange(input.textarea.value, input.range)) {
    return false;
  }

  return (
    getTextareaRangeText(input.textarea.value, input.range) === input.expectedText &&
    !isWordContinuation(input.textarea.value[input.range.start - 1]) &&
    !isWordContinuation(input.textarea.value[input.range.end])
  );
}

export function getTextareaRangeText(value: string, range: TextareaRange): string {
  const clamped = clampTextareaRange(value, range);

  return value.slice(clamped.start, clamped.end);
}

export function clampTextareaRange(value: string, range: TextareaRange): TextareaRange {
  const start = clampOffset(range.start, value.length);
  const end = clampOffset(range.end, value.length);

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

export function isValidTextareaRange(value: string, range: TextareaRange): boolean {
  return (
    Number.isFinite(range.start) &&
    Number.isFinite(range.end) &&
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.end >= range.start &&
    range.end <= value.length
  );
}

function clampOffset(offset: number, max: number): number {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(offset), max));
}

function isWordContinuation(char: string | undefined): boolean {
  return char !== undefined && /^[A-Za-z']$/.test(char);
}
