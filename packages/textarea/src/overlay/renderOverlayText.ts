import type { TextareaMark } from "../types";

const trailingNewlinePlaceholder = "\u200b";
const redMarkClassName = "typai-textarea-mark typai-textarea-mark--red-spelling-issue";
const blueMarkClassName = "typai-textarea-mark typai-textarea-mark--blue-applied-correction";

export function renderOverlayText(
  mirror: HTMLElement,
  value: string,
  marks: TextareaMark[] = [],
): void {
  const safeMarks = normalizeMarks(value, marks);
  let html = "";
  let cursor = 0;

  for (const mark of safeMarks) {
    html += escapeHtml(value.slice(cursor, mark.range.start));
    html += renderMarkHtml(mark, value.slice(mark.range.start, mark.range.end));
    cursor = mark.range.end;
  }

  html += escapeHtml(value.slice(cursor));

  if (value.endsWith("\n")) {
    html += trailingNewlinePlaceholder;
  }

  mirror.innerHTML = html;
}

function normalizeMarks(value: string, marks: TextareaMark[]): TextareaMark[] {
  const candidates = marks
    .filter((mark) => isValidMarkRange(value, mark))
    .sort((left, right) => {
      if (left.range.start !== right.range.start) {
        return left.range.start - right.range.start;
      }

      if (left.range.end !== right.range.end) {
        return left.range.end - right.range.end;
      }

      return markPriority(right) - markPriority(left);
    });
  const selected: TextareaMark[] = [];

  for (const candidate of candidates) {
    const previous = selected.at(-1);

    if (previous === undefined || previous.range.end <= candidate.range.start) {
      selected.push(candidate);
      continue;
    }

    if (
      previous.range.start === candidate.range.start &&
      previous.range.end === candidate.range.end &&
      markPriority(candidate) > markPriority(previous)
    ) {
      selected[selected.length - 1] = candidate;
    }
  }

  return selected;
}

function renderMarkHtml(mark: TextareaMark, text: string): string {
  const className = mark.kind === "blue_applied_correction" ? blueMarkClassName : redMarkClassName;
  const decorationStyle = mark.kind === "blue_applied_correction" ? "dotted" : "wavy";
  const decorationColor = mark.kind === "blue_applied_correction" ? "blue" : "red";
  const attributes = [
    ["class", className],
    ["data-typai-textarea-mark-id", mark.id],
    ["data-typai-mark-kind", mark.kind],
    [
      "data-testid",
      mark.kind === "blue_applied_correction" ? "textarea-blue-mark" : "textarea-red-mark",
    ],
    ["data-typai-range-start", String(mark.range.start)],
    ["data-typai-range-end", String(mark.range.end)],
    [
      "style",
      `text-decoration-line: underline; text-decoration-style: ${decorationStyle}; text-decoration-color: ${decorationColor};`,
    ],
  ];

  if (mark.original !== undefined) {
    attributes.push(["data-typai-original", mark.original]);
  }

  if (mark.replacement !== undefined) {
    attributes.push(["data-typai-replacement", mark.replacement]);
  }

  return `<span ${attributes
    .map(([name, attributeValue]) => `${name}="${escapeAttribute(attributeValue)}"`)
    .join(" ")}>${escapeHtml(text)}</span>`;
}

function isValidMarkRange(value: string, mark: TextareaMark): boolean {
  return (
    Number.isFinite(mark.range.start) &&
    Number.isFinite(mark.range.end) &&
    Number.isInteger(mark.range.start) &&
    Number.isInteger(mark.range.end) &&
    mark.range.start >= 0 &&
    mark.range.end > mark.range.start &&
    mark.range.end <= value.length
  );
}

function markPriority(mark: TextareaMark): number {
  return mark.kind === "blue_applied_correction" ? 2 : 1;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
