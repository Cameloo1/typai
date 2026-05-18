import { Decoration, type DecorationSet } from "@codemirror/view";
import type { CodeMirrorTypaiMark } from "./types";

export const typaiCodeMirrorRedSpellingClass = "typai-cm-red-spelling";
export const typaiCodeMirrorBlueCorrectedClass = "typai-cm-blue-corrected";

export function createMarkDecoration(mark: CodeMirrorTypaiMark): Decoration {
  return Decoration.mark({
    class:
      mark.kind === "red_spelling_issue"
        ? typaiCodeMirrorRedSpellingClass
        : typaiCodeMirrorBlueCorrectedClass,
    attributes: {
      "aria-label": getMarkAriaLabel(mark),
      "data-typai-cm-mark": mark.kind,
      "data-typai-cm-mark-id": mark.id,
      role: "button",
      tabindex: "0",
    },
    typaiMark: mark,
  });
}

export function collectTypaiMarks(decorations: DecorationSet): CodeMirrorTypaiMark[] {
  const marks: CodeMirrorTypaiMark[] = [];

  decorations.between(0, Number.MAX_SAFE_INTEGER, (from, to, decoration) => {
    const mark = getTypaiMarkFromDecoration(decoration);

    if (mark !== null) {
      marks.push({
        ...mark,
        from,
        to,
      });
    }
  });

  return marks;
}

export function getTypaiMarkFromDecoration(decoration: Decoration): CodeMirrorTypaiMark | null {
  const mark = decoration.spec.typaiMark as CodeMirrorTypaiMark | undefined;

  return mark ?? null;
}

function getMarkAriaLabel(mark: CodeMirrorTypaiMark): string {
  if (mark.kind === "red_spelling_issue") {
    return `Typai spelling issue: ${mark.original ?? "word"}`;
  }

  return `Typai correction: ${mark.original ?? "original"} to ${mark.replacement ?? "replacement"}`;
}
