import { Decoration, type DecorationSet, WidgetType } from "@codemirror/view";
import type { CodeMirrorCompletionGhost, CodeMirrorTypaiMark } from "./types";

export const typaiCodeMirrorRedSpellingClass = "typai-cm-red-spelling";
export const typaiCodeMirrorBlueCorrectedClass = "typai-cm-blue-corrected";
export const typaiCodeMirrorGhostTextClass = "typai-cm-ghost-text";

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

export function createGhostTextDecoration(ghost: CodeMirrorCompletionGhost): Decoration {
  return Decoration.widget({
    side: 1,
    widget: new CodeMirrorGhostTextWidget(ghost),
    typaiCompletionGhost: ghost,
  });
}

export function collectTypaiCompletionGhosts(
  decorations: DecorationSet,
): CodeMirrorCompletionGhost[] {
  const ghosts: CodeMirrorCompletionGhost[] = [];

  decorations.between(0, Number.MAX_SAFE_INTEGER, (from, _to, decoration) => {
    const ghost = getTypaiCompletionGhostFromDecoration(decoration);

    if (ghost !== null) {
      ghosts.push({
        ...ghost,
        from,
      });
    }
  });

  return ghosts;
}

export function getTypaiCompletionGhostFromDecoration(
  decoration: Decoration,
): CodeMirrorCompletionGhost | null {
  const ghost = decoration.spec.typaiCompletionGhost as CodeMirrorCompletionGhost | undefined;

  return ghost ?? null;
}

function getMarkAriaLabel(mark: CodeMirrorTypaiMark): string {
  if (mark.kind === "red_spelling_issue") {
    return `Typai spelling issue: ${mark.original ?? "word"}`;
  }

  return `Typai correction: ${mark.original ?? "original"} to ${mark.replacement ?? "replacement"}`;
}

class CodeMirrorGhostTextWidget extends WidgetType {
  constructor(private readonly ghost: CodeMirrorCompletionGhost) {
    super();
  }

  eq(other: CodeMirrorGhostTextWidget): boolean {
    return this.ghost.text === other.ghost.text && this.ghost.from === other.ghost.from;
  }

  toDOM(view: { dom: HTMLElement }): HTMLElement {
    const element = view.dom.ownerDocument.createElement("span");

    element.className = typaiCodeMirrorGhostTextClass;
    element.dataset.typaiCmGhost = "true";
    element.dataset.testid = "codemirror-ghost-text";
    element.setAttribute("aria-hidden", "true");
    element.textContent = this.ghost.text;

    return element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}
