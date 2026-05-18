import type { EditorView } from "@codemirror/view";
import {
  createCorrectionPopover,
  createSpellingPopover,
  ensureTypaiUiStyles,
  type TypaiPopoverHandle,
} from "@typai/ui";
import {
  addTypaiCodeMirrorMarkEffect,
  addTypaiCodeMirrorTransactionEffect,
  clearTypaiCodeMirrorGhostTextEffect,
  clearTypaiCodeMirrorMarksEffect,
  getTypaiCodeMirrorCompletionTransactions,
  getTypaiCodeMirrorGhostText,
  getTypaiCodeMirrorMarks,
  getTypaiCodeMirrorOptions,
  getTypaiCodeMirrorTransactions,
  removeTypaiCodeMirrorMarkEffect,
  setTypaiCodeMirrorGhostTextEffect,
  setTypaiCodeMirrorRuntimeSettingsEffect,
} from "./state";
import type {
  CodeMirrorCompletionGhostMetadata,
  CodeMirrorCompletionSnapshot,
  CodeMirrorCompletionTransaction,
  CodeMirrorGhostTextClearReason,
  CodeMirrorTypaiCorrectionTransaction,
  CodeMirrorTypaiMark,
} from "./types";

const activePopovers = new WeakMap<EditorView, TypaiPopoverHandle>();

export function clearTypaiCodeMirrorMarks(view: EditorView): boolean {
  view.dispatch({
    effects: clearTypaiCodeMirrorMarksEffect.of(),
  });

  return true;
}

export function getTypaiCodeMirrorViewMarks(view: EditorView): CodeMirrorTypaiMark[] {
  return getTypaiCodeMirrorMarks(view.state);
}

export function getTypaiCodeMirrorViewTransactions(
  view: EditorView,
): CodeMirrorTypaiCorrectionTransaction[] {
  return getTypaiCodeMirrorTransactions(view.state);
}

export function getTypaiCodeMirrorViewCompletionTransactions(
  view: EditorView,
): CodeMirrorCompletionTransaction[] {
  return getTypaiCodeMirrorCompletionTransactions(view.state);
}

export function renderTypaiCodeMirrorGhostText(
  view: EditorView,
  text: string,
  snapshot?: CodeMirrorCompletionSnapshot,
  metadata?: CodeMirrorCompletionGhostMetadata,
): boolean {
  const normalizedText = text.length === 0 ? "" : text;

  if (normalizedText.length === 0) {
    clearTypaiCodeMirrorGhostText(view);
    return false;
  }

  const ghostSnapshot = snapshot ?? createCurrentCompletionSnapshot(view);

  if (!completionSnapshotMatchesEditor(view, ghostSnapshot)) {
    clearTypaiCodeMirrorGhostText(view);
    return false;
  }

  view.dispatch({
    effects: setTypaiCodeMirrorGhostTextEffect.of({
      text: normalizedText,
      from: ghostSnapshot.selection.end,
      snapshot: ghostSnapshot,
      metadata,
    }),
  });

  return true;
}

export function clearTypaiCodeMirrorGhostText(
  view: EditorView,
  _reason: CodeMirrorGhostTextClearReason = "manual",
): boolean {
  if (getTypaiCodeMirrorGhostText(view.state) === null) {
    return false;
  }

  view.dispatch({
    effects: clearTypaiCodeMirrorGhostTextEffect.of(),
  });

  return true;
}

export function isTypaiCodeMirrorGhostTextVisible(view: EditorView): boolean {
  return getTypaiCodeMirrorGhostText(view.state) !== null;
}

export function getTypaiCodeMirrorGhostTextContent(view: EditorView): string | null {
  return getTypaiCodeMirrorGhostText(view.state)?.text ?? null;
}

export function revertLastTypaiCodeMirrorCompletion(view: EditorView): boolean {
  const transaction = getTypaiCodeMirrorCompletionTransactions(view.state).at(-1);

  if (transaction === undefined) {
    return false;
  }

  return revertTypaiCodeMirrorCompletionTransaction(view, transaction);
}

export function revertTypaiCodeMirrorCompletion(view: EditorView, transactionId: string): boolean {
  const transaction = getTypaiCodeMirrorCompletionTransactions(view.state).find(
    (candidate) => candidate.id === transactionId,
  );

  if (transaction === undefined) {
    return false;
  }

  return revertTypaiCodeMirrorCompletionTransaction(view, transaction);
}

export function revertFirstTypaiCodeMirrorCorrection(view: EditorView): boolean {
  const mark = getTypaiCodeMirrorMarks(view.state).find(
    (candidate) => candidate.kind === "blue_applied_correction",
  );

  if (mark === undefined) {
    return false;
  }

  return revertTypaiCodeMirrorBlueMark(view, mark);
}

export function revertSelectedTypaiCodeMirrorCorrection(view: EditorView): boolean {
  const selection = view.state.selection.main;
  const mark = getTypaiCodeMirrorMarks(view.state).find(
    (candidate) =>
      candidate.kind === "blue_applied_correction" &&
      candidate.from <= selection.from &&
      candidate.to >= selection.to,
  );

  if (mark === undefined) {
    return false;
  }

  return revertTypaiCodeMirrorBlueMark(view, mark);
}

export function openFirstTypaiCodeMirrorBluePopover(view: EditorView, index = 0): boolean {
  const mark = getTypaiCodeMirrorMarks(view.state).filter(
    (candidate) => candidate.kind === "blue_applied_correction",
  )[index];

  if (mark === undefined) {
    return false;
  }

  return openTypaiCodeMirrorPopoverForMark(view, mark.id);
}

export function openFirstTypaiCodeMirrorRedPopover(view: EditorView, index = 0): boolean {
  const mark = getTypaiCodeMirrorMarks(view.state).filter(
    (candidate) => candidate.kind === "red_spelling_issue",
  )[index];

  if (mark === undefined) {
    return false;
  }

  return openTypaiCodeMirrorPopoverForMark(view, mark.id);
}

export function openTypaiCodeMirrorPopoverForMark(view: EditorView, markId: string): boolean {
  const mark = getTypaiCodeMirrorMarks(view.state).find((candidate) => candidate.id === markId);

  if (mark === undefined) {
    closeTypaiCodeMirrorPopover(view);
    return false;
  }

  if (mark.kind === "blue_applied_correction") {
    return openTypaiCodeMirrorBluePopover(view, mark);
  }

  return openTypaiCodeMirrorRedPopover(view, mark);
}

export function closeTypaiCodeMirrorPopover(view: EditorView): boolean {
  const popover = activePopovers.get(view);

  if (popover === undefined) {
    return false;
  }

  popover.destroy();
  activePopovers.delete(view);

  return true;
}

export function applyFirstTypaiCodeMirrorRedSuggestion(
  view: EditorView,
  suggestion?: string,
  index = 0,
): boolean {
  const mark = getTypaiCodeMirrorMarks(view.state).filter(
    (candidate) => candidate.kind === "red_spelling_issue",
  )[index];

  if (mark === undefined) {
    return false;
  }

  const chosenSuggestion = suggestion ?? mark.suggestions?.[0];

  if (chosenSuggestion === undefined) {
    return false;
  }

  return applyTypaiCodeMirrorRedSuggestion(view, mark, chosenSuggestion);
}

export function ignoreFirstTypaiCodeMirrorRedMark(view: EditorView, index = 0): boolean {
  const mark = getTypaiCodeMirrorMarks(view.state).filter(
    (candidate) => candidate.kind === "red_spelling_issue",
  )[index];

  if (mark === undefined) {
    return false;
  }

  view.dispatch({
    effects: removeTypaiCodeMirrorMarkEffect.of(mark.id),
  });

  return true;
}

function openTypaiCodeMirrorBluePopover(view: EditorView, mark: CodeMirrorTypaiMark): boolean {
  const options = getTypaiCodeMirrorOptions(view.state);

  if (
    options === null ||
    mark.original === undefined ||
    mark.replacement === undefined ||
    mark.kind !== "blue_applied_correction"
  ) {
    return false;
  }

  closeTypaiCodeMirrorPopover(view);
  ensureTypaiUiStyles(view.dom.ownerDocument);

  const original = mark.original;
  const replacement = mark.replacement;
  const popover = createCorrectionPopover({
    ownerDocument: view.dom.ownerDocument,
    parent: view.dom.ownerDocument.body,
    restoreFocusOnClose: true,
    onClose: () => activePopovers.delete(view),
    data: {
      original,
      replacement,
      anchorRect: getTypaiCodeMirrorMarkAnchorRect(view, mark),
    },
    actions: {
      revert: () => {
        revertTypaiCodeMirrorBlueMark(view, mark);
      },
      alwaysCorrect: async () => {
        await options.typai.setAlwaysCorrect(original, replacement);
      },
      neverCorrect: async () => {
        await options.typai.setNeverCorrect(original, replacement);
        revertTypaiCodeMirrorBlueMark(view, mark);
      },
      addOriginalToDictionary: async () => {
        await options.typai.addToPersonalDictionary(original);
        revertTypaiCodeMirrorBlueMark(view, mark);
      },
      close: () => {},
    },
  });

  popover.element.setAttribute("data-testid", "codemirror-blue-popover");
  wirePopoverKeyboardActivation(popover.element);
  activePopovers.set(view, popover);
  popover.focusFirstAction();

  return true;
}

function openTypaiCodeMirrorRedPopover(view: EditorView, mark: CodeMirrorTypaiMark): boolean {
  const options = getTypaiCodeMirrorOptions(view.state);

  if (options === null || mark.kind !== "red_spelling_issue") {
    return false;
  }

  closeTypaiCodeMirrorPopover(view);
  ensureTypaiUiStyles(view.dom.ownerDocument);

  const original = mark.original ?? view.state.doc.sliceString(mark.from, mark.to);
  const popover = createSpellingPopover({
    ownerDocument: view.dom.ownerDocument,
    parent: view.dom.ownerDocument.body,
    restoreFocusOnClose: true,
    onClose: () => activePopovers.delete(view),
    data: {
      original,
      suggestions: mark.suggestions ?? [],
      anchorRect: getTypaiCodeMirrorMarkAnchorRect(view, mark),
    },
    actions: {
      chooseSuggestion: (suggestion) => {
        applyTypaiCodeMirrorRedSuggestion(view, mark, suggestion);
      },
      ignoreOnce: () => {
        view.dispatch({
          effects: removeTypaiCodeMirrorMarkEffect.of(mark.id),
        });
      },
      addToDictionary: async () => {
        await options.typai.addToPersonalDictionary(original);
        view.dispatch({
          effects: removeTypaiCodeMirrorMarkEffect.of(mark.id),
        });
      },
      disableAutocorrect: () => {
        view.dispatch({
          effects: setTypaiCodeMirrorRuntimeSettingsEffect.of({ autocorrect: false }),
        });
      },
      close: () => {},
    },
  });

  popover.element.setAttribute("data-testid", "codemirror-red-popover");
  wirePopoverKeyboardActivation(popover.element);
  activePopovers.set(view, popover);
  popover.focusFirstAction();

  return true;
}

function applyTypaiCodeMirrorRedSuggestion(
  view: EditorView,
  mark: CodeMirrorTypaiMark,
  suggestion: string,
): boolean {
  if (mark.kind !== "red_spelling_issue" || suggestion.length === 0) {
    return false;
  }

  const original = mark.original ?? view.state.doc.sliceString(mark.from, mark.to);

  if (view.state.doc.sliceString(mark.from, mark.to) !== original) {
    return false;
  }

  const transaction: CodeMirrorTypaiCorrectionTransaction = {
    id: createCommandId("tx"),
    markId: createCommandId("blue"),
    documentVersion: Date.now(),
    docLengthBefore: view.state.doc.length,
    rangeBefore: {
      from: mark.from,
      to: mark.to,
      text: original,
    },
    rangeAfter: {
      from: mark.from,
      to: mark.from + suggestion.length,
      text: suggestion,
    },
    original,
    replacement: suggestion,
    trigger: "popover",
    confidence: 1,
    reasonCodes: mark.reasonCodes ?? [],
    createdAt: Date.now(),
  };
  const blueMark: CodeMirrorTypaiMark = {
    id: transaction.markId,
    from: transaction.rangeAfter.from,
    to: transaction.rangeAfter.to,
    kind: "blue_applied_correction",
    original,
    replacement: suggestion,
    reasonCodes: transaction.reasonCodes,
  };

  view.dispatch({
    changes: {
      from: mark.from,
      to: mark.to,
      insert: suggestion,
    },
    selection: {
      anchor: mark.from + suggestion.length,
    },
    effects: [
      removeTypaiCodeMirrorMarkEffect.of(mark.id),
      addTypaiCodeMirrorMarkEffect.of(blueMark),
      addTypaiCodeMirrorTransactionEffect.of(transaction),
    ],
    userEvent: "input.typai.suggestion",
  });

  return true;
}

function revertTypaiCodeMirrorBlueMark(view: EditorView, mark: CodeMirrorTypaiMark): boolean {
  if (
    mark.kind !== "blue_applied_correction" ||
    mark.original === undefined ||
    mark.replacement === undefined
  ) {
    return false;
  }

  if (view.state.doc.sliceString(mark.from, mark.to) !== mark.replacement) {
    return false;
  }

  view.dispatch({
    changes: {
      from: mark.from,
      to: mark.to,
      insert: mark.original,
    },
    selection: {
      anchor: mark.from + mark.original.length,
    },
    effects: removeTypaiCodeMirrorMarkEffect.of(mark.id),
    userEvent: "input.typai.revert",
  });

  return true;
}

function revertTypaiCodeMirrorCompletionTransaction(
  view: EditorView,
  transaction: CodeMirrorCompletionTransaction,
): boolean {
  if (
    transaction.insertedText.length === 0 ||
    view.state.doc.sliceString(transaction.rangeAfter.from, transaction.rangeAfter.to) !==
      transaction.insertedText
  ) {
    return false;
  }

  const options = getTypaiCodeMirrorOptions(view.state);

  view.dispatch({
    changes: {
      from: transaction.rangeAfter.from,
      to: transaction.rangeAfter.to,
      insert: "",
    },
    selection: {
      anchor: transaction.rangeAfter.from,
    },
    userEvent: "input.typai.completion.revert",
  });

  options?.completion?.onCompletionReverted?.(transaction);

  return true;
}

function getTypaiCodeMirrorMarkAnchorRect(
  view: EditorView,
  mark: CodeMirrorTypaiMark,
): DOMRect | undefined {
  const fromRect = safeCoordsAtPos(view, mark.from);
  const toRect = safeCoordsAtPos(view, mark.to);

  if (fromRect !== null && toRect !== null) {
    return createDomRect(
      view,
      Math.min(fromRect.left, toRect.left),
      Math.min(fromRect.top, toRect.top),
      Math.abs(toRect.right - fromRect.left),
      Math.max(fromRect.bottom, toRect.bottom) - Math.min(fromRect.top, toRect.top),
    );
  }

  const markElement = view.dom.querySelector<HTMLElement>(`[data-typai-cm-mark-id="${mark.id}"]`);

  if (markElement !== null) {
    return markElement.getBoundingClientRect();
  }

  return view.dom.getBoundingClientRect();
}

function safeCoordsAtPos(view: EditorView, position: number): RectLike | null {
  try {
    return view.coordsAtPos(position);
  } catch {
    return null;
  }
}

function createDomRect(
  view: EditorView,
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  const DOMRectCtor = view.dom.ownerDocument.defaultView?.DOMRect ?? DOMRect;

  return new DOMRectCtor(left, top, width, height);
}

function wirePopoverKeyboardActivation(element: HTMLElement): void {
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (!(event.target instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.target.click();
  });
}

function createCommandId(prefix: string): string {
  return `typai-cm-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createCurrentCompletionSnapshot(view: EditorView): CodeMirrorCompletionSnapshot {
  const selection = view.state.selection.main;

  return {
    text: view.state.doc.toString(),
    version: Date.now(),
    selection: {
      start: selection.from,
      end: selection.to,
    },
    isComposingIME: view.composing,
  };
}

function completionSnapshotMatchesEditor(
  view: EditorView,
  snapshot: CodeMirrorCompletionSnapshot,
): boolean {
  const selection = view.state.selection.main;

  return (
    snapshot.text === view.state.doc.toString() &&
    snapshot.selection.start === selection.from &&
    snapshot.selection.end === selection.to &&
    selection.empty &&
    !snapshot.isComposingIME &&
    !view.composing
  );
}

type RectLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
