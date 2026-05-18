import type { CorrectionDecision, Token, TypaiCore, TypaiRange } from "@typai/core";
import { getTokenBeforeOffset, isDelimiter, isProtectedTokenText } from "@typai/core";

export const TYPAI_CONTENTEDITABLE_VERSION = "0.0.0-dev";

export type CorrectionTrigger = "space" | "punctuation" | "newline" | "popover";

export interface TypaiSettings {
  autocorrect: boolean;
  spellcheck: boolean;
  keepCorrectionMarksVisible: boolean;
  usePersonalDictionary: boolean;
}

export interface AttachContenteditableOptions {
  element: HTMLElement;
  typai: TypaiCore;
  autocorrect?: boolean;
  spellcheck?: boolean;
  settings?: Partial<TypaiSettings>;
  onDecision?: (decision: CorrectionDecision) => void;
  onCorrection?: (transaction: CorrectionTransaction) => void;
  onMark?: (mark: VisualMark) => void;
  onMarkRemoved?: (mark: VisualMark) => void;
  onPopover?: (popover: TypaiPopover | null) => void;
  onProtectedSkip?: (token: Token) => void;
  onSettingsChange?: (settings: TypaiSettings) => void;
  onTextChange?: (change: TypaiTextChange) => void;
  onUserAction?: (action: TypaiUserAction) => void;
}

export type DetachContenteditable = (() => void) & {
  getSettings(): TypaiSettings;
  updateSettings(settings: Partial<TypaiSettings>): void;
};

export interface CorrectionTransaction {
  id: string;
  documentVersion: number;
  rangeBefore: {
    start: number;
    end: number;
    text: string;
  };
  rangeAfter: {
    start: number;
    end: number;
    text: string;
  };
  original: string;
  replacement: string;
  trigger: CorrectionTrigger;
  confidence: number;
  reasonCodes: string[];
  createdAt: number;
}

export interface VisualMark {
  id: string;
  range: TypaiRange;
  kind: "red_spelling_issue" | "blue_applied_correction";
  correctionEventId?: string;
  original?: string;
  replacement?: string;
  suggestions?: string[];
  reasonCodes?: string[];
}

export interface TypaiTextChange {
  text: string;
  caretOffset: number;
  reason: "auto_correct" | "revert" | "suggestion" | "paste";
  transaction?: CorrectionTransaction;
}

export type TypaiUserAction =
  | {
      type: "revert_correction";
      original: string;
      replacement: string;
    }
  | {
      type: "always_correct";
      original: string;
      replacement: string;
    }
  | {
      type: "never_correct";
      original: string;
      replacement: string;
    }
  | {
      type: "add_to_dictionary";
      word: string;
    }
  | {
      type: "apply_suggestion";
      original: string;
      replacement: string;
    }
  | {
      type: "ignore_once";
      original: string;
    }
  | {
      type: "disable_autocorrect";
    };

export type PopoverActionResult = {
  applied: boolean;
  reason?: "missing_mark" | "stale_range";
};

export type BlueCorrectionPopover = {
  id: string;
  kind: "blue_correction";
  mark: VisualMark;
  transaction: CorrectionTransaction;
  label: string;
  actions: {
    revert(): Promise<PopoverActionResult>;
    alwaysCorrect(): Promise<PopoverActionResult>;
    neverCorrect(): Promise<PopoverActionResult>;
    addOriginalToDictionary(): Promise<PopoverActionResult>;
  };
};

export type RedSpellingPopover = {
  id: string;
  kind: "red_spelling";
  mark: VisualMark;
  original: string;
  suggestions: string[];
  label: string;
  actions: {
    applySuggestion(suggestion: string): Promise<PopoverActionResult>;
    ignoreOnce(): Promise<PopoverActionResult>;
    addToDictionary(): Promise<PopoverActionResult>;
    disableAutocorrect(): Promise<PopoverActionResult>;
  };
};

export type TypaiPopover = BlueCorrectionPopover | RedSpellingPopover;

export interface ContenteditableSnapshot {
  text: string;
  documentVersion: number;
}

export interface RangeStillMatchesInput {
  documentVersion: number;
  currentDocumentVersion: number;
  text: string;
  range: TypaiRange;
  expectedText: string;
}

export interface DomTextPosition {
  node: Text;
  offset: number;
}

interface StoredVisualMark extends VisualMark {
  documentVersion: number;
  text: string;
}

interface AdapterState {
  documentVersion: number;
  isComposing: boolean;
  lastText: string;
  nextId: number;
  transactions: CorrectionTransaction[];
  marks: Map<string, StoredVisualMark>;
  settings: TypaiSettings;
  activePopover: TypaiPopover | null;
}

const defaultSettings: TypaiSettings = {
  autocorrect: true,
  spellcheck: true,
  keepCorrectionMarksVisible: true,
  usePersonalDictionary: true,
};
const textNodeType = 3;

export function attachContenteditable(
  options: AttachContenteditableOptions,
): DetachContenteditable {
  const state: AdapterState = {
    documentVersion: 0,
    isComposing: false,
    lastText: readElementText(options.element),
    nextId: 1,
    transactions: [],
    marks: new Map<string, StoredVisualMark>(),
    settings: resolveSettings(options),
    activePopover: null,
  };

  const handleCompositionStart = () => {
    state.isComposing = true;
  };

  const handleCompositionEnd = () => {
    state.isComposing = false;
    syncDocumentVersion(options.element, state);
  };

  const handleInput = (event: Event) => {
    const changed = syncDocumentVersion(options.element, state);

    if (changed) {
      pruneAdapterMarks(options, state);
      closePopover(options, state);
    }

    if (state.isComposing) {
      return;
    }

    const snapshot = readSnapshot(options.element, state.documentVersion);
    const offset = getCaretOffset(options.element, snapshot.text);
    const delimiter = getInputDelimiter(event, snapshot.text, offset);

    if (!changed && delimiter === null) {
      return;
    }

    if (delimiter === null) {
      return;
    }

    processCompletedToken(options, state, snapshot, offset, delimiter);
  };

  const handleClick = (event: Event) => {
    const markId = getClickedMarkId(event, options.element);

    if (markId === null) {
      closePopover(options, state);
      return;
    }

    openPopoverForMark(options, state, markId);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && state.activePopover !== null) {
      const activeMarkId = state.activePopover.mark.id;

      closePopover(options, state);
      focusMarkTrigger(options.element, activeMarkId);
      event.preventDefault();
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const markId = getClickedMarkId(event, options.element);

    if (markId === null) {
      return;
    }

    event.preventDefault();
    openPopoverForMark(options, state, markId);
  };

  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || state.activePopover === null) {
      return;
    }

    const activeMarkId = state.activePopover.mark.id;

    closePopover(options, state);
    if (!focusMarkTrigger(options.element, activeMarkId)) {
      options.element.focus();
    }
    event.preventDefault();
  };

  const handlePaste = (event: Event) => {
    const pastedText = getPastePlainText(event);

    if (pastedText === null) {
      return;
    }

    event.preventDefault();

    const currentText = readElementText(options.element);
    const selectedRange = getSelectedPlainTextRange(options.element, currentText);
    const nextText =
      currentText.slice(0, selectedRange.start) + pastedText + currentText.slice(selectedRange.end);
    const nextCaretOffset = selectedRange.start + pastedText.length;

    closePopover(options, state);
    commitText(options, state, nextText, nextCaretOffset, "paste");
  };

  options.element.addEventListener("compositionstart", handleCompositionStart);
  options.element.addEventListener("compositionend", handleCompositionEnd);
  options.element.addEventListener("input", handleInput);
  options.element.addEventListener("click", handleClick);
  options.element.addEventListener("keydown", handleKeyDown);
  options.element.addEventListener("paste", handlePaste);
  options.element.ownerDocument?.addEventListener("keydown", handleDocumentKeyDown);

  const detach = (() => {
    options.element.removeEventListener("compositionstart", handleCompositionStart);
    options.element.removeEventListener("compositionend", handleCompositionEnd);
    options.element.removeEventListener("input", handleInput);
    options.element.removeEventListener("click", handleClick);
    options.element.removeEventListener("keydown", handleKeyDown);
    options.element.removeEventListener("paste", handlePaste);
    options.element.ownerDocument?.removeEventListener("keydown", handleDocumentKeyDown);
    closePopover(options, state);
  }) as DetachContenteditable;

  detach.getSettings = () => ({ ...state.settings });
  detach.updateSettings = (settings: Partial<TypaiSettings>) => {
    updateSettings(options, state, settings);
  };

  return detach;
}

export function rangeStillMatches(input: RangeStillMatchesInput): boolean {
  if (input.documentVersion !== input.currentDocumentVersion) {
    return false;
  }

  return (
    input.text.slice(input.range.start, input.range.end) === input.expectedText &&
    !isWordContinuation(input.text[input.range.start - 1]) &&
    !isWordContinuation(input.text[input.range.end])
  );
}

export function plainTextOffsetToDomPosition(root: Node, offset: number): DomTextPosition | null {
  const targetOffset = Math.max(0, offset);
  let remaining = targetOffset;
  let lastPosition: DomTextPosition | null = null;

  for (const textNode of getTextNodes(root)) {
    const length = textNode.textContent?.length ?? 0;

    if (remaining <= length) {
      return {
        node: textNode as Text,
        offset: remaining,
      };
    }

    remaining -= length;
    lastPosition = {
      node: textNode as Text,
      offset: length,
    };
  }

  return lastPosition;
}

export function plainTextRangeToDomRange(root: HTMLElement, range: TypaiRange): Range | null {
  const ownerDocument = root.ownerDocument;
  const start = plainTextOffsetToDomPosition(root, range.start);
  const end = plainTextOffsetToDomPosition(root, range.end);

  if (start === null || end === null) {
    return null;
  }

  const domRange = ownerDocument.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);

  return domRange;
}

export function domRangeToPlainTextRange(root: HTMLElement, range: Range): TypaiRange | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const start = getPlainTextOffsetForRangeBoundary(root, range.startContainer, range.startOffset);
  const end = getPlainTextOffsetForRangeBoundary(root, range.endContainer, range.endOffset);

  if (start === null || end === null) {
    return null;
  }

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function processCompletedToken(
  options: AttachContenteditableOptions,
  state: AdapterState,
  snapshot: ContenteditableSnapshot,
  offset: number,
  delimiter: string,
) {
  const token = getTokenBeforeOffset(snapshot.text, offset);

  if (token === null) {
    return;
  }

  if (token.protected || isProtectedTokenText(token.text)) {
    options.onProtectedSkip?.(token);
    return;
  }

  const decision = options.typai.checkCompletedToken({
    token: token.text,
    language: token.language,
  });

  options.onDecision?.(decision);

  if (decision.action === "mark_unresolved") {
    if (state.settings.spellcheck) {
      emitMark(options, state, {
        id: createId(state, "mark"),
        range: token.range,
        kind: "red_spelling_issue",
        original: decision.original,
        suggestions: decision.suggestions,
        reasonCodes: decision.reasonCodes,
      });
    }

    return;
  }

  if (decision.action !== "auto_correct") {
    return;
  }

  if (!state.settings.autocorrect) {
    if (state.settings.spellcheck) {
      emitMark(options, state, {
        id: createId(state, "mark"),
        range: token.range,
        kind: "red_spelling_issue",
        original: decision.original,
        suggestions: [decision.replacement],
        reasonCodes: decision.reasonCodes,
      });
    }

    return;
  }

  applyAutoCorrection(options, state, snapshot, token, decision, delimiter);
}

function applyAutoCorrection(
  options: AttachContenteditableOptions,
  state: AdapterState,
  snapshot: ContenteditableSnapshot,
  token: Token,
  decision: Extract<CorrectionDecision, { action: "auto_correct" }>,
  delimiter: string,
): CorrectionTransaction | null {
  const currentText = readElementText(options.element);

  if (
    state.isComposing ||
    !rangeStillMatches({
      documentVersion: snapshot.documentVersion,
      currentDocumentVersion: state.documentVersion,
      text: currentText,
      range: token.range,
      expectedText: token.text,
    })
  ) {
    return null;
  }

  const transactionId = createId(state, "correction");
  const nextText =
    currentText.slice(0, token.range.start) +
    decision.replacement +
    currentText.slice(token.range.end);
  const rangeAfter = {
    start: token.range.start,
    end: token.range.start + decision.replacement.length,
  };

  commitText(options, state, nextText, rangeAfter.end + delimiter.length, "auto_correct");

  const transaction: CorrectionTransaction = {
    id: transactionId,
    documentVersion: state.documentVersion,
    rangeBefore: {
      start: token.range.start,
      end: token.range.end,
      text: token.text,
    },
    rangeAfter: {
      ...rangeAfter,
      text: decision.replacement,
    },
    original: decision.original,
    replacement: decision.replacement,
    trigger: triggerFromDelimiter(delimiter),
    confidence: decision.confidence,
    reasonCodes: decision.reasonCodes,
    createdAt: Date.now(),
  };

  state.transactions.push(transaction);
  options.onCorrection?.(transaction);

  if (state.settings.keepCorrectionMarksVisible) {
    emitMark(options, state, {
      id: createId(state, "mark"),
      range: rangeAfter,
      kind: "blue_applied_correction",
      correctionEventId: transactionId,
      original: decision.original,
      replacement: decision.replacement,
      reasonCodes: decision.reasonCodes,
    });
  }

  return transaction;
}

function emitMark(
  options: AttachContenteditableOptions,
  state: AdapterState,
  mark: VisualMark,
): StoredVisualMark | null {
  const text = readElementText(options.element).slice(mark.range.start, mark.range.end);

  if (text.length === 0) {
    return null;
  }

  const storedMark: StoredVisualMark = {
    ...mark,
    text,
    documentVersion: state.documentVersion,
  };

  state.marks.set(storedMark.id, storedMark);
  options.onMark?.(stripStoredMark(storedMark));

  return storedMark;
}

function openPopoverForMark(
  options: AttachContenteditableOptions,
  state: AdapterState,
  markId: string,
): void {
  const mark = getCurrentStoredMark(options, state, markId);

  if (mark === null) {
    closePopover(options, state);
    return;
  }

  const popover =
    mark.kind === "blue_applied_correction"
      ? createBlueCorrectionPopover(options, state, mark)
      : createRedSpellingPopover(options, state, mark);

  state.activePopover = popover;
  options.onPopover?.(popover);
}

function createBlueCorrectionPopover(
  options: AttachContenteditableOptions,
  state: AdapterState,
  mark: StoredVisualMark,
): BlueCorrectionPopover {
  const transaction = findTransaction(state, mark);
  const original = transaction?.original ?? mark.original ?? "";
  const replacement = transaction?.replacement ?? mark.replacement ?? mark.text;
  const popoverTransaction =
    transaction ??
    createSyntheticTransaction(state, mark, original, replacement, "blue_applied_correction");

  return {
    id: createId(state, "popover"),
    kind: "blue_correction",
    mark: stripStoredMark(mark),
    transaction: popoverTransaction,
    label: `Corrected "${original}" -> "${replacement}"`,
    actions: {
      revert: () => revertBlueCorrection(options, state, mark.id),
      alwaysCorrect: async () => {
        await options.typai.setAlwaysCorrect(original, replacement);
        closePopover(options, state);
        options.onUserAction?.({ type: "always_correct", original, replacement });

        return { applied: true };
      },
      neverCorrect: async () => {
        await options.typai.setNeverCorrect(original, replacement);
        options.onUserAction?.({ type: "never_correct", original, replacement });

        return revertBlueCorrection(options, state, mark.id);
      },
      addOriginalToDictionary: async () => {
        await options.typai.addToPersonalDictionary(original);
        options.onUserAction?.({ type: "add_to_dictionary", word: original });

        return revertBlueCorrection(options, state, mark.id);
      },
    },
  };
}

function createRedSpellingPopover(
  options: AttachContenteditableOptions,
  state: AdapterState,
  mark: StoredVisualMark,
): RedSpellingPopover {
  const original = mark.original ?? mark.text;
  const suggestions = mark.suggestions ?? [];

  return {
    id: createId(state, "popover"),
    kind: "red_spelling",
    mark: stripStoredMark(mark),
    original,
    suggestions,
    label: `Possible spelling issue: "${original}"`,
    actions: {
      applySuggestion: (suggestion: string) =>
        applyRedSuggestion(options, state, mark.id, suggestion),
      ignoreOnce: async () => {
        const removed = removeStoredMark(options, state, mark.id);

        if (!removed) {
          return { applied: false, reason: "missing_mark" };
        }

        closePopover(options, state);
        options.onUserAction?.({ type: "ignore_once", original });

        return { applied: true };
      },
      addToDictionary: async () => {
        await options.typai.addToPersonalDictionary(original);
        removeStoredMark(options, state, mark.id);
        closePopover(options, state);
        options.onUserAction?.({ type: "add_to_dictionary", word: original });

        return { applied: true };
      },
      disableAutocorrect: async () => {
        updateSettings(options, state, { autocorrect: false });
        closePopover(options, state);
        options.onUserAction?.({ type: "disable_autocorrect" });

        return { applied: true };
      },
    },
  };
}

async function applyRedSuggestion(
  options: AttachContenteditableOptions,
  state: AdapterState,
  markId: string,
  suggestion: string,
): Promise<PopoverActionResult> {
  const mark = getCurrentStoredMark(options, state, markId);

  if (mark === null) {
    return { applied: false, reason: "missing_mark" };
  }

  if (!validateStoredMark(options, state, mark)) {
    return { applied: false, reason: "stale_range" };
  }

  const currentText = readElementText(options.element);
  const rangeAfter = {
    start: mark.range.start,
    end: mark.range.start + suggestion.length,
  };
  const nextText =
    currentText.slice(0, mark.range.start) + suggestion + currentText.slice(mark.range.end);

  removeStoredMark(options, state, mark.id);
  commitText(options, state, nextText, rangeAfter.end, "suggestion");

  const transaction: CorrectionTransaction = {
    id: createId(state, "correction"),
    documentVersion: state.documentVersion,
    rangeBefore: {
      start: mark.range.start,
      end: mark.range.end,
      text: mark.text,
    },
    rangeAfter: {
      ...rangeAfter,
      text: suggestion,
    },
    original: mark.original ?? mark.text,
    replacement: suggestion,
    trigger: "popover",
    confidence: 1,
    reasonCodes: mark.reasonCodes ?? [],
    createdAt: Date.now(),
  };

  state.transactions.push(transaction);
  options.onCorrection?.(transaction);

  if (state.settings.keepCorrectionMarksVisible) {
    emitMark(options, state, {
      id: createId(state, "mark"),
      range: rangeAfter,
      kind: "blue_applied_correction",
      correctionEventId: transaction.id,
      original: transaction.original,
      replacement: suggestion,
      reasonCodes: transaction.reasonCodes,
    });
  }
  closePopover(options, state);
  options.onUserAction?.({
    type: "apply_suggestion",
    original: transaction.original,
    replacement: suggestion,
  });

  return { applied: true };
}

function revertBlueCorrection(
  options: AttachContenteditableOptions,
  state: AdapterState,
  markId: string,
): Promise<PopoverActionResult> {
  const mark = getCurrentStoredMark(options, state, markId);

  if (mark === null) {
    return Promise.resolve({ applied: false, reason: "missing_mark" });
  }

  const transaction = findTransaction(state, mark);

  if (transaction === null || !validateStoredMark(options, state, mark)) {
    return Promise.resolve({ applied: false, reason: "stale_range" });
  }

  const currentText = readElementText(options.element);
  const revertedRange = {
    start: mark.range.start,
    end: mark.range.start + transaction.original.length,
  };
  const nextText =
    currentText.slice(0, mark.range.start) +
    transaction.original +
    currentText.slice(mark.range.end);

  removeStoredMark(options, state, mark.id);
  commitText(options, state, nextText, revertedRange.end, "revert");
  closePopover(options, state);
  options.onUserAction?.({
    type: "revert_correction",
    original: transaction.original,
    replacement: transaction.replacement,
  });

  return Promise.resolve({ applied: true });
}

function commitText(
  options: AttachContenteditableOptions,
  state: AdapterState,
  text: string,
  caretOffset: number,
  reason: TypaiTextChange["reason"],
): void {
  writeElementText(options.element, text);
  state.documentVersion += 1;
  state.lastText = text;
  placeCaretAfterRange(options.element, caretOffset);
  pruneAdapterMarks(options, state);
  options.onTextChange?.({
    text,
    caretOffset,
    reason,
  });
}

function getCurrentStoredMark(
  options: AttachContenteditableOptions,
  state: AdapterState,
  markId: string,
): StoredVisualMark | null {
  const mark = state.marks.get(markId);

  if (mark === undefined) {
    return null;
  }

  if (!validateStoredMark(options, state, mark)) {
    removeStoredMark(options, state, mark.id);
    return null;
  }

  return mark;
}

function validateStoredMark(
  options: AttachContenteditableOptions,
  state: AdapterState,
  mark: StoredVisualMark,
): boolean {
  return rangeStillMatches({
    documentVersion: mark.documentVersion,
    currentDocumentVersion: state.documentVersion,
    text: readElementText(options.element),
    range: mark.range,
    expectedText: mark.text,
  });
}

function getPastePlainText(event: Event): string | null {
  const clipboardData = (event as { clipboardData?: unknown }).clipboardData;

  if (clipboardData === undefined || clipboardData === null) {
    return null;
  }

  const getData = (clipboardData as { getData?: unknown }).getData;

  if (typeof getData !== "function") {
    return null;
  }

  const text = getData.call(clipboardData, "text/plain");

  if (typeof text !== "string") {
    return null;
  }

  return normalizePastedText(text);
}

function normalizePastedText(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function pruneAdapterMarks(options: AttachContenteditableOptions, state: AdapterState): void {
  for (const mark of state.marks.values()) {
    if (!validateStoredMark(options, state, mark)) {
      removeStoredMark(options, state, mark.id);
    }
  }
}

function removeStoredMark(
  options: AttachContenteditableOptions,
  state: AdapterState,
  markId: string,
): boolean {
  const mark = state.marks.get(markId);

  if (mark === undefined) {
    return false;
  }

  state.marks.delete(markId);
  options.onMarkRemoved?.(stripStoredMark(mark));

  return true;
}

function closePopover(options: AttachContenteditableOptions, state: AdapterState): void {
  if (state.activePopover === null) {
    return;
  }

  state.activePopover = null;
  options.onPopover?.(null);
}

function focusMarkTrigger(element: HTMLElement, markId: string): boolean {
  const querySelectorAll = (element as { querySelectorAll?: unknown }).querySelectorAll;

  if (typeof querySelectorAll !== "function") {
    return false;
  }

  const markElements = querySelectorAll.call(
    element,
    "[data-mark-id],[data-typai-mark-id]",
  ) as Iterable<HTMLElement>;

  for (const markElement of markElements) {
    const candidateId =
      markElement.getAttribute("data-mark-id") ?? markElement.getAttribute("data-typai-mark-id");

    if (candidateId === markId) {
      markElement.focus();
      return true;
    }
  }

  return false;
}

function findTransaction(
  state: AdapterState,
  mark: StoredVisualMark,
): CorrectionTransaction | null {
  if (mark.correctionEventId === undefined) {
    return null;
  }

  return (
    state.transactions.find((transaction) => transaction.id === mark.correctionEventId) ?? null
  );
}

function createSyntheticTransaction(
  state: AdapterState,
  mark: StoredVisualMark,
  original: string,
  replacement: string,
  kind: VisualMark["kind"],
): CorrectionTransaction {
  return {
    id: mark.correctionEventId ?? createId(state, "correction"),
    documentVersion: mark.documentVersion,
    rangeBefore: {
      start: mark.range.start,
      end: mark.range.start + original.length,
      text: original,
    },
    rangeAfter: {
      ...mark.range,
      text: replacement,
    },
    original,
    replacement,
    trigger: kind === "blue_applied_correction" ? "space" : "popover",
    confidence: 1,
    reasonCodes: mark.reasonCodes ?? [],
    createdAt: Date.now(),
  };
}

function updateSettings(
  options: AttachContenteditableOptions,
  state: AdapterState,
  settings: Partial<TypaiSettings>,
): void {
  state.settings = {
    ...state.settings,
    ...settings,
  };
  options.onSettingsChange?.({ ...state.settings });
}

function resolveSettings(options: AttachContenteditableOptions): TypaiSettings {
  return {
    ...defaultSettings,
    autocorrect:
      options.autocorrect ?? options.settings?.autocorrect ?? defaultSettings.autocorrect,
    spellcheck: options.spellcheck ?? options.settings?.spellcheck ?? defaultSettings.spellcheck,
    keepCorrectionMarksVisible:
      options.settings?.keepCorrectionMarksVisible ?? defaultSettings.keepCorrectionMarksVisible,
    usePersonalDictionary:
      options.settings?.usePersonalDictionary ?? defaultSettings.usePersonalDictionary,
  };
}

function getClickedMarkId(event: Event, element: HTMLElement): string | null {
  const target = event.target;

  if (!isClosestCapable(target)) {
    return null;
  }

  const markElement = target.closest("[data-mark-id],[data-typai-mark-id]");

  if (markElement === null) {
    return null;
  }

  if (
    typeof Node !== "undefined" &&
    markElement instanceof Node &&
    !element.contains(markElement)
  ) {
    return null;
  }

  return markElement.getAttribute("data-mark-id") ?? markElement.getAttribute("data-typai-mark-id");
}

function isClosestCapable(value: unknown): value is {
  closest(selector: string): { getAttribute(name: string): string | null } | null;
} {
  return value !== null && typeof (value as { closest?: unknown }).closest === "function";
}

function syncDocumentVersion(element: HTMLElement, state: AdapterState): boolean {
  const text = readElementText(element);

  if (text === state.lastText) {
    return false;
  }

  state.documentVersion += 1;
  state.lastText = text;

  return true;
}

function readSnapshot(element: HTMLElement, documentVersion: number): ContenteditableSnapshot {
  return {
    text: readElementText(element),
    documentVersion,
  };
}

function readElementText(element: HTMLElement): string {
  return element.textContent ?? "";
}

function writeElementText(element: HTMLElement, text: string): void {
  element.textContent = text;
}

function getInputDelimiter(event: Event, text: string, offset: number): string | null {
  const eventData = getInputEventData(event);
  const candidate =
    eventData !== null && eventData.length > 0 ? eventData.at(-1) : text[offset - 1];

  if (candidate === undefined || !isDelimiter(candidate)) {
    return null;
  }

  return candidate;
}

function getInputEventData(event: Event): string | null {
  const maybeData = (event as { data?: unknown }).data;

  return typeof maybeData === "string" ? maybeData : null;
}

function triggerFromDelimiter(delimiter: string): CorrectionTrigger {
  if (delimiter === "\n") {
    return "newline";
  }

  if (delimiter === " " || delimiter === "\t") {
    return "space";
  }

  return "punctuation";
}

function getCaretOffset(element: HTMLElement, fallbackText: string): number {
  const ownerDocument = element.ownerDocument;
  const selection = ownerDocument?.getSelection?.();

  if (selection === undefined || selection === null || selection.rangeCount === 0) {
    return fallbackText.length;
  }

  const range = selection.getRangeAt(0);

  if (!element.contains(range.endContainer)) {
    return fallbackText.length;
  }

  return (
    getPlainTextOffsetForRangeBoundary(element, range.endContainer, range.endOffset) ??
    fallbackText.length
  );
}

function placeCaretAfterRange(element: HTMLElement, offset: number): void {
  const ownerDocument = element.ownerDocument;
  const selection = ownerDocument?.getSelection?.();

  if (ownerDocument === undefined || selection === undefined || selection === null) {
    return;
  }

  const position = plainTextOffsetToDomPosition(element, offset);

  if (position === null) {
    return;
  }

  const range = ownerDocument.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getSelectedPlainTextRange(element: HTMLElement, fallbackText: string): TypaiRange {
  const selection = element.ownerDocument?.getSelection?.();

  if (selection === undefined || selection === null || selection.rangeCount === 0) {
    return {
      start: fallbackText.length,
      end: fallbackText.length,
    };
  }

  const selectedRange = domRangeToPlainTextRange(element, selection.getRangeAt(0));

  if (selectedRange === null) {
    return {
      start: fallbackText.length,
      end: fallbackText.length,
    };
  }

  return selectedRange;
}

function getPlainTextOffsetForRangeBoundary(
  root: HTMLElement,
  container: Node,
  offset: number,
): number | null {
  if (container.nodeType === textNodeType) {
    let textOffset = 0;

    for (const textNode of getTextNodes(root)) {
      if (textNode === container) {
        const length = textNode.textContent?.length ?? 0;

        return textOffset + Math.max(0, Math.min(offset, length));
      }

      textOffset += textNode.textContent?.length ?? 0;
    }

    return null;
  }

  const childNodes = Array.from(container.childNodes);
  const boundaryChild = childNodes[Math.max(0, Math.min(offset, childNodes.length - 1))];
  let textOffset = 0;

  for (const textNode of getTextNodes(root)) {
    if (
      boundaryChild !== undefined &&
      (textNode === boundaryChild || boundaryChild.contains(textNode))
    ) {
      return textOffset;
    }

    textOffset += textNode.textContent?.length ?? 0;
  }

  return offset >= childNodes.length ? textOffset : null;
}

function getTextNodes(root: Node): Node[] {
  const textNodes: Node[] = [];

  collectTextNodes(root, textNodes);

  return textNodes;
}

function collectTextNodes(node: Node, textNodes: Node[]): void {
  if (node.nodeType === textNodeType) {
    textNodes.push(node);
    return;
  }

  for (const child of Array.from(node.childNodes)) {
    collectTextNodes(child, textNodes);
  }
}

function stripStoredMark(mark: StoredVisualMark): VisualMark {
  return {
    id: mark.id,
    range: mark.range,
    kind: mark.kind,
    correctionEventId: mark.correctionEventId,
    original: mark.original,
    replacement: mark.replacement,
    suggestions: mark.suggestions,
    reasonCodes: mark.reasonCodes,
  };
}

function createId(state: AdapterState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;

  return id;
}

function isWordContinuation(char: string | undefined): boolean {
  return char !== undefined && /^[A-Za-z']$/.test(char);
}
