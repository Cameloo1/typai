import type { TextareaSnapshot } from "../types";

export function getTextareaSnapshot(
  textarea: HTMLTextAreaElement,
  version = 0,
  isComposingIME = false,
): TextareaSnapshot {
  const value = textarea.value;
  const selectionStart = clampOffset(textarea.selectionStart, value.length);
  const selectionEnd = clampOffset(textarea.selectionEnd, value.length);

  return {
    value,
    version,
    selectionStart: Math.min(selectionStart, selectionEnd),
    selectionEnd: Math.max(selectionStart, selectionEnd),
    isComposingIME,
  };
}

export const createTextareaSnapshot = getTextareaSnapshot;

function clampOffset(offset: number | null | undefined, max: number): number {
  if (typeof offset !== "number" || !Number.isFinite(offset)) {
    return max;
  }

  return Math.max(0, Math.min(Math.trunc(offset), max));
}
