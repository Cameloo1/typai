import type { CorrectionTransaction, VisualMark } from "@typai/contenteditable";
import type { TypaiRange } from "@typai/core";

export type DemoMark = VisualMark & {
  text: string;
};

export type RevertResult = {
  text: string;
  caretOffset: number;
  revertedRange: TypaiRange;
};

export function renderMarkedText(text: string, marks: DemoMark[]): string {
  const renderableMarks = getRenderableMarks(text, marks);
  let html = "";
  let cursor = 0;

  for (const mark of renderableMarks) {
    html += escapeHtml(text.slice(cursor, mark.range.start));
    html += renderMarkSpan(text.slice(mark.range.start, mark.range.end), mark);
    cursor = mark.range.end;
  }

  html += escapeHtml(text.slice(cursor));

  return html;
}

export function pruneStaleMarks(text: string, marks: DemoMark[]): DemoMark[] {
  return marks.filter((mark) => isMarkStillCurrent(text, mark));
}

export function replaceRangeText(text: string, range: TypaiRange, replacement: string): string {
  return text.slice(0, range.start) + replacement + text.slice(range.end);
}

export function buildRevertResult(
  text: string,
  mark: DemoMark,
  correction: CorrectionTransaction,
): RevertResult | null {
  if (
    mark.kind !== "blue_applied_correction" ||
    mark.correctionEventId !== correction.id ||
    text.slice(mark.range.start, mark.range.end) !== correction.replacement
  ) {
    return null;
  }

  const revertedRange = {
    start: mark.range.start,
    end: mark.range.start + correction.original.length,
  };

  return {
    text: replaceRangeText(text, mark.range, correction.original),
    caretOffset: revertedRange.end,
    revertedRange,
  };
}

export function shiftMarksAfterEdit(
  marks: DemoMark[],
  editedRange: TypaiRange,
  replacementLength: number,
): DemoMark[] {
  const delta = replacementLength - (editedRange.end - editedRange.start);

  return marks.flatMap((mark) => {
    if (mark.range.end <= editedRange.start) {
      return [mark];
    }

    if (mark.range.start >= editedRange.end) {
      return [
        {
          ...mark,
          range: {
            start: mark.range.start + delta,
            end: mark.range.end + delta,
          },
        },
      ];
    }

    return [];
  });
}

function getRenderableMarks(text: string, marks: DemoMark[]): DemoMark[] {
  const sortedMarks = pruneStaleMarks(text, marks).sort(
    (left, right) => left.range.start - right.range.start || left.range.end - right.range.end,
  );
  const renderableMarks: DemoMark[] = [];
  let cursor = 0;

  for (const mark of sortedMarks) {
    if (mark.range.start < cursor) {
      continue;
    }

    renderableMarks.push(mark);
    cursor = mark.range.end;
  }

  return renderableMarks;
}

function isMarkStillCurrent(text: string, mark: DemoMark): boolean {
  return (
    mark.range.start >= 0 &&
    mark.range.end <= text.length &&
    mark.range.start < mark.range.end &&
    text.slice(mark.range.start, mark.range.end) === mark.text &&
    !isWordContinuation(text[mark.range.start - 1]) &&
    !isWordContinuation(text[mark.range.end])
  );
}

function isWordContinuation(char: string | undefined): boolean {
  return char !== undefined && /^[A-Za-z']$/.test(char);
}

function renderMarkSpan(text: string, mark: DemoMark): string {
  const className =
    mark.kind === "blue_applied_correction"
      ? "typai-mark typai-mark-blue"
      : "typai-mark typai-mark-red";
  const testId = mark.kind === "blue_applied_correction" ? "blue-mark" : "red-mark";
  const correctionAttribute =
    mark.correctionEventId && mark.kind === "blue_applied_correction"
      ? ` data-correction-id="${escapeAttribute(mark.correctionEventId)}"`
      : "";
  const originalAttribute =
    mark.original !== undefined ? ` data-typai-original="${escapeAttribute(mark.original)}"` : "";
  const replacementAttribute =
    mark.replacement !== undefined
      ? ` data-typai-replacement="${escapeAttribute(mark.replacement)}"`
      : "";
  const label =
    mark.kind === "blue_applied_correction"
      ? `Correction mark: ${text}. Open correction actions.`
      : `Spelling issue: ${text}. Open spelling actions.`;

  return `<span class="${className}" data-mark-id="${escapeAttribute(
    mark.id,
  )}" data-typai-mark-id="${escapeAttribute(mark.id)}" data-typai-mark-kind="${escapeAttribute(
    mark.kind,
  )}" data-testid="${testId}" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-controls="typai-popover-dialog" aria-label="${escapeAttribute(
    label,
  )}"${correctionAttribute}${originalAttribute}${replacementAttribute}>${escapeHtml(text)}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
