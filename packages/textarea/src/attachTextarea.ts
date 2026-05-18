import type { CorrectionDecision, Token, TypaiCore } from "@typai/core";
import { getTokenBeforeOffset, isDelimiter, isProtectedTokenText } from "@typai/core";
import {
  createTextareaGhostTextRenderer,
  type TextareaGhostTextRenderer,
} from "./completion/textareaGhostTextRenderer";
import {
  addTextareaEventListener,
  createTextareaEventDisposables,
} from "./internals/textareaEvents";
import { isValidTextareaRange, rangeStillMatches } from "./internals/textareaRanges";
import { getTextareaSnapshot } from "./internals/textareaSnapshot";
import {
  canCreateOverlayMirror,
  createOverlayMirror,
  type TextareaOverlayMirror,
} from "./overlay/createOverlayMirror";
import type {
  AttachTextareaOptions,
  DetachTextarea,
  TextareaAdapterSettings,
  TextareaCompletionAcceptResult,
  TextareaCompletionRenderMetadata,
  TextareaCompletionRevertResult,
  TextareaCompletionSnapshot,
  TextareaCompletionTransaction,
  TextareaCorrectionRevertResult,
  TextareaCorrectionTransaction,
  TextareaGhostTextClearReason,
  TextareaMark,
  TextareaPopoverActionResult,
  TextareaSnapshot,
} from "./types";

type TextareaOverlaySettings = {
  enabled: boolean;
  className?: string;
};

type StoredTextareaMark = TextareaMark & {
  documentVersion: number;
  text: string;
};

type TextareaAdapterState = {
  options: AttachTextareaOptions;
  version: number;
  isComposingIME: boolean;
  lastValue: string;
  nextId: number;
  settings: TextareaAdapterSettings;
  overlaySettings: TextareaOverlaySettings;
  snapshot: TextareaSnapshot;
  marks: Map<string, StoredTextareaMark>;
  transactions: TextareaCorrectionTransaction[];
  completionTransactions: TextareaCompletionTransaction[];
  overlay: TextareaOverlayMirror | null;
  ghostRenderer: TextareaGhostTextRenderer | null;
  triggerRoot: HTMLElement | null;
  popoverElement: HTMLElement | null;
  liveRegion: HTMLElement | null;
};

const defaultSettings: TextareaAdapterSettings = {
  autocorrect: true,
  spellcheck: true,
  keepCorrectionMarksVisible: true,
  usePersonalDictionary: true,
};

export const TYPAI_TEXTAREA_VERSION = "0.0.0-dev";

export function attachTextarea(options: AttachTextareaOptions): DetachTextarea {
  const attachOptions = validateAttachOptions(options);
  const { textarea } = attachOptions;
  const state: TextareaAdapterState = {
    options: attachOptions,
    version: 0,
    isComposingIME: false,
    lastValue: textarea.value,
    nextId: 1,
    settings: resolveSettings(attachOptions),
    overlaySettings: resolveOverlaySettings(attachOptions),
    snapshot: getTextareaSnapshot(textarea, 0, false),
    marks: new Map(),
    transactions: [],
    completionTransactions: [],
    overlay: null,
    ghostRenderer: null,
    triggerRoot: null,
    popoverElement: null,
    liveRegion: null,
  };
  const disposables = createTextareaEventDisposables();

  state.ghostRenderer = createTextareaGhostTextRenderer({
    textarea,
    getOverlay: () => state.overlay,
    isSnapshotFresh: (snapshot) => isFreshCompletionSnapshot(state, snapshot),
  });

  if (state.overlaySettings.enabled && canCreateOverlayMirror(textarea)) {
    const overlay = createOverlayMirror({
      textarea,
      className: state.overlaySettings.className,
    });

    state.overlay = overlay;
    createOverlayInteractionLayer(attachOptions, state);
    renderOverlay(state);
    disposables.add(() => overlay.destroy());
  }

  disposables.add(() => state.ghostRenderer?.destroy());

  disposables.add(
    addTextareaEventListener(textarea, "compositionstart", () => {
      state.isComposingIME = true;
      state.snapshot = getTextareaSnapshot(textarea, state.version, state.isComposingIME);
      clearTextareaGhostText(state, "composition_start");
      attachOptions.completion?.onEditorCompositionStart?.();
      renderOverlay(state);
    }),
  );

  disposables.add(
    addTextareaEventListener(textarea, "compositionend", () => {
      const previousVersion = state.version;

      state.isComposingIME = false;
      syncTextareaSnapshot(textarea, state);

      if (state.version !== previousVersion) {
        pruneStaleMarks(attachOptions, state);
      }

      renderOverlay(state);
    }),
  );

  disposables.add(
    addTextareaEventListener(textarea, "input", (event) => {
      handleTextareaInput(attachOptions, state, event);
    }),
  );

  disposables.add(
    addTextareaEventListener(textarea, "keydown", (event) => {
      const key = getKeyboardEventKey(event);

      if (key === "Tab" && state.ghostRenderer?.isTextareaGhostVisible() === true) {
        event.preventDefault();
        acceptTextareaCompletion(attachOptions, state);
        return;
      }

      if (key === "Escape") {
        clearTextareaGhostText(state, "escape");
      }
    }),
  );

  disposables.add(
    addTextareaEventListener(textarea, "select", () => {
      handleTextareaSelectionChange(attachOptions, state);
    }),
  );

  disposables.add(
    addDocumentSelectionChangeListener(textarea, () => {
      handleTextareaSelectionChange(attachOptions, state);
    }),
  );

  disposables.add(
    addTextareaEventListener(textarea, "paste", () => {
      clearTextareaGhostText(state, "paste");
    }),
  );

  disposables.add(
    addTextareaEventListener(textarea, "blur", () => {
      clearTextareaGhostText(state, "blur");
      attachOptions.completion?.onEditorBlur?.();
    }),
  );

  disposables.add(addTextareaFormResetListener(attachOptions, state));

  let detached = false;

  const detach = (() => {
    if (detached) {
      return;
    }

    detached = true;
    closePopover(attachOptions, state, false);
    disposables.disposeAll();
    attachOptions.completion?.destroy?.();
  }) as DetachTextarea;

  detach.revertTextareaCorrection = (transactionId) =>
    revertTextareaCorrection(attachOptions, state, transactionId);
  detach.getSettings = () => ({ ...state.settings });
  detach.updateSettings = (settings) => {
    state.settings = {
      ...state.settings,
      ...settings,
    };
  };
  detach.resyncOverlay = () => {
    state.overlay?.resyncOverlay();
    renderOverlay(state);
    state.ghostRenderer?.resyncTextareaGhostText();
  };
  detach.renderTextareaGhostText = (text, snapshot, metadata) =>
    state.ghostRenderer?.renderTextareaGhostText(text, snapshot, metadata) ?? false;
  detach.clearTextareaGhostText = (reason) => {
    clearTextareaGhostText(state, reason ?? "manual");
  };
  detach.isTextareaGhostVisible = () => state.ghostRenderer?.isTextareaGhostVisible() ?? false;
  detach.getTextareaGhostText = () => state.ghostRenderer?.getTextareaGhostText() ?? null;
  detach.acceptTextareaCompletion = () => acceptTextareaCompletion(attachOptions, state);
  detach.revertTextareaCompletion = (transactionId) =>
    revertTextareaCompletion(attachOptions, state, transactionId);
  detach.getTextareaCompletionTransactions = () => [...state.completionTransactions];

  return detach;
}

export function isTextareaDelimiterInput(event: Event): boolean {
  const data = getInputEventData(event);

  if (data === null || data.length === 0) {
    return false;
  }

  return isDelimiter(data.at(-1) ?? "");
}

export function getCompletedTokenBeforeSelection(snapshot: TextareaSnapshot): Token | null {
  if (snapshot.selectionStart !== snapshot.selectionEnd) {
    return null;
  }

  return getTokenBeforeOffset(snapshot.value, snapshot.selectionStart);
}

function handleTextareaSelectionChange(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
): void {
  const previousVersion = state.version;
  const snapshot = syncTextareaSnapshot(options.textarea, state);
  const proposal = state.ghostRenderer?.getTextareaGhostProposal() ?? null;
  const visibleGhostStillMatches =
    proposal !== null &&
    state.ghostRenderer?.isTextareaGhostVisible() === true &&
    isFreshCompletionSnapshot(state, proposal.snapshot);

  if (state.version !== previousVersion) {
    pruneStaleMarks(options, state);
    renderOverlay(state);
  }

  if (visibleGhostStillMatches) {
    state.ghostRenderer?.resyncTextareaGhostText();
  } else {
    clearTextareaGhostText(state, "selection_change");
  }
  options.completion?.onEditorSelectionChange?.(toTextareaCompletionSnapshot(snapshot));
}

function handleTextareaInput(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  event: Event,
): void {
  clearTextareaGhostText(state, "typing");
  const previousVersion = state.version;
  const snapshot = syncTextareaSnapshot(options.textarea, state);

  if (state.version !== previousVersion) {
    pruneStaleMarks(options, state);
  }

  renderOverlay(state);
  options.completion?.onEditorInput?.(toTextareaCompletionSnapshot(snapshot));

  if (snapshot.isComposingIME || !isTextareaDelimiterInput(event)) {
    return;
  }

  if (!isTextareaWritable(options.textarea)) {
    return;
  }

  const token = getCompletedTokenBeforeSelection(snapshot);

  if (token === null) {
    return;
  }

  if (token.protected || isProtectedTokenText(token.text)) {
    removeMarksOverlappingRange(options, state, token.range);
    renderOverlay(state);
    options.onProtectedSkip?.({ snapshot, token });
    return;
  }

  const decision = options.typai.checkCompletedToken({ token: token.text });

  options.onDecision?.({ snapshot, token, decision });

  if (decision.action === "mark_unresolved") {
    if (!state.settings.spellcheck) {
      return;
    }

    emitMark(options, state, snapshot, {
      id: createId(state, "mark"),
      range: token.range,
      kind: "red_spelling_issue",
      original: decision.original,
      suggestions: decision.suggestions,
      reasonCodes: decision.reasonCodes,
    });
    return;
  }

  if (decision.action !== "auto_correct") {
    return;
  }

  if (!state.settings.autocorrect) {
    if (state.settings.spellcheck) {
      emitMark(options, state, snapshot, {
        id: createId(state, "mark"),
        range: token.range,
        kind: "red_spelling_issue",
        original: decision.original,
        replacement: decision.replacement,
        suggestions: [decision.replacement],
        reasonCodes: decision.reasonCodes,
      });
    }
    return;
  }

  applyCorrectionToTextarea(options, state, snapshot, token, decision);
}

function clearTextareaGhostText(
  state: TextareaAdapterState,
  reason: TextareaGhostTextClearReason,
  emitDismiss = true,
): void {
  const proposal = state.ghostRenderer?.getTextareaGhostProposal() ?? null;

  state.ghostRenderer?.clearTextareaGhostText(reason);

  if (emitDismiss && proposal !== null) {
    state.options.completion?.onCompletionDismissed?.({
      snapshot: state.snapshot,
      reason,
      ghostText: proposal.text,
      requestId: proposal.metadata.requestId,
      providerName: proposal.metadata.providerName,
      model: proposal.metadata.model,
    });
  }
}

function toTextareaCompletionSnapshot(snapshot: TextareaSnapshot): TextareaCompletionSnapshot {
  return {
    text: snapshot.value,
    version: snapshot.version,
    selection: {
      start: snapshot.selectionStart,
      end: snapshot.selectionEnd,
    },
    isComposingIME: snapshot.isComposingIME,
  };
}

function isFreshCompletionSnapshot(
  state: TextareaAdapterState,
  snapshot: TextareaCompletionSnapshot,
): boolean {
  if (snapshot.isComposingIME || state.isComposingIME) {
    return false;
  }

  if (snapshot.version !== state.version || snapshot.text !== state.snapshot.value) {
    return false;
  }

  if (snapshot.selection.start !== snapshot.selection.end) {
    return false;
  }

  return (
    snapshot.selection.start === state.snapshot.selectionStart &&
    snapshot.selection.end === state.snapshot.selectionEnd
  );
}

function acceptTextareaCompletion(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
): TextareaCompletionAcceptResult {
  const proposal = state.ghostRenderer?.getTextareaGhostProposal() ?? null;

  if (proposal === null) {
    return { applied: false, reason: "no_visible_ghost" };
  }

  if (proposal.text.length === 0) {
    clearTextareaGhostText(state, "empty");
    return { applied: false, reason: "empty_text" };
  }

  if (!isTextareaWritable(options.textarea)) {
    return { applied: false, reason: "not_writable" };
  }

  const previousVersion = state.version;
  const currentSnapshot = syncTextareaSnapshot(options.textarea, state);

  if (state.version !== previousVersion) {
    pruneStaleMarks(options, state);
    renderOverlay(state);
  }

  if (
    proposal.snapshot.selection.start !== proposal.snapshot.selection.end ||
    currentSnapshot.selectionStart !== currentSnapshot.selectionEnd
  ) {
    clearTextareaGhostText(state, "stale_snapshot");
    return { applied: false, reason: "non_collapsed_selection" };
  }

  if (!isFreshCompletionSnapshot(state, proposal.snapshot)) {
    clearTextareaGhostText(state, "stale_snapshot");
    return { applied: false, reason: "stale_snapshot" };
  }

  const insertAt = currentSnapshot.selectionStart;
  const nextValue =
    options.textarea.value.slice(0, insertAt) +
    proposal.text +
    options.textarea.value.slice(insertAt);
  const transaction = createTextareaCompletionTransaction(
    state,
    proposal.metadata,
    currentSnapshot,
    insertAt,
    proposal.text,
  );
  const nextSelection = {
    selectionStart: transaction.rangeAfter.end,
    selectionEnd: transaction.rangeAfter.end,
  };

  clearTextareaGhostText(state, "manual", false);
  const committedSnapshot = commitTextareaCompletionValue(options, state, nextValue, nextSelection);

  state.completionTransactions.push(transaction);
  options.completion?.onCompletionAccepted?.({
    snapshot: committedSnapshot,
    transaction,
  });

  return { applied: true, transaction };
}

function revertTextareaCompletion(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  transactionId: string,
): TextareaCompletionRevertResult {
  const transaction = state.completionTransactions.find(
    (candidate) => candidate.id === transactionId,
  );

  if (transaction === undefined) {
    return { applied: false, reason: "missing_transaction" };
  }

  if (!isTextareaWritable(options.textarea)) {
    return { applied: false, reason: "not_writable" };
  }

  if (
    !isValidTextareaRange(options.textarea.value, transaction.rangeAfter) ||
    options.textarea.value.slice(transaction.rangeAfter.start, transaction.rangeAfter.end) !==
      transaction.insertedText
  ) {
    return { applied: false, reason: "stale_range" };
  }

  const nextValue =
    options.textarea.value.slice(0, transaction.rangeAfter.start) +
    options.textarea.value.slice(transaction.rangeAfter.end);
  const nextSelection = {
    selectionStart: transaction.rangeAfter.start,
    selectionEnd: transaction.rangeAfter.start,
  };
  const committedSnapshot = commitTextareaCompletionValue(options, state, nextValue, nextSelection);

  options.completion?.onCompletionReverted?.({
    snapshot: committedSnapshot,
    transaction,
  });

  return { applied: true, transaction };
}

function createTextareaCompletionTransaction(
  state: TextareaAdapterState,
  metadata: TextareaCompletionRenderMetadata,
  snapshot: TextareaSnapshot,
  insertAt: number,
  insertedText: string,
): TextareaCompletionTransaction {
  return {
    id: createId(state, "completion"),
    requestId: metadata.requestId ?? createId(state, "completion-request"),
    editorVersion: snapshot.version,
    rangeBefore: {
      start: insertAt,
      end: insertAt,
      text: "",
    },
    rangeAfter: {
      start: insertAt,
      end: insertAt + insertedText.length,
      text: insertedText,
    },
    insertedText,
    createdAt: Date.now(),
    providerName: metadata.providerName,
    model: metadata.model,
    latencyMs: metadata.latencyMs,
  };
}

function commitTextareaCompletionValue(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  nextValue: string,
  nextSelection: { selectionStart: number; selectionEnd: number },
): TextareaSnapshot {
  options.textarea.value = nextValue;
  setTextareaSelection(options.textarea, nextSelection.selectionStart, nextSelection.selectionEnd);
  state.version += 1;
  state.lastValue = options.textarea.value;
  state.snapshot = getTextareaSnapshot(options.textarea, state.version, state.isComposingIME);
  pruneStaleMarks(options, state);
  renderOverlay(state);

  return state.snapshot;
}

function emitMark(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  snapshot: TextareaSnapshot,
  mark: TextareaMark,
): void {
  if (mark.range.start === mark.range.end) {
    return;
  }

  const storedMark = storeMark(options, state, mark);

  if (storedMark === null) {
    return;
  }

  renderOverlay(state);

  if (storedMark.id !== mark.id) {
    return;
  }

  options.onMark?.({ snapshot, mark: stripStoredMark(storedMark) });

  if (storedMark.kind === "red_spelling_issue") {
    announce(state, `Spelling issue marked: ${storedMark.original ?? storedMark.text}`);
  }
}

function applyCorrectionToTextarea(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  snapshot: TextareaSnapshot,
  token: Token,
  decision: Extract<CorrectionDecision, { action: "auto_correct" }>,
): TextareaCorrectionTransaction | null {
  if (!shouldApplyAutoCorrection(decision)) {
    if (state.settings.spellcheck) {
      emitMark(options, state, snapshot, {
        id: createId(state, "mark"),
        range: token.range,
        kind: "red_spelling_issue",
        original: decision.original,
        replacement: decision.replacement,
        suggestions: [decision.replacement],
        reasonCodes: decision.reasonCodes,
      });
    }

    return null;
  }

  if (
    state.isComposingIME ||
    !isTextareaWritable(options.textarea) ||
    snapshot.selectionStart !== snapshot.selectionEnd ||
    !rangeStillMatches({
      textarea: options.textarea,
      range: token.range,
      expectedText: token.text,
      version: snapshot.version,
      currentVersion: state.version,
    })
  ) {
    return null;
  }

  const rangeAfter = {
    start: token.range.start,
    end: token.range.start + decision.replacement.length,
  };
  const nextValue =
    options.textarea.value.slice(0, token.range.start) +
    decision.replacement +
    options.textarea.value.slice(token.range.end);
  const nextSelection = adjustSelectionForReplacement(
    snapshot,
    token.range,
    decision.replacement.length,
  );
  const committedSnapshot = commitTextareaValue(options, state, nextValue, nextSelection);
  const transaction = createTextareaCorrectionTransaction(
    state,
    snapshot,
    committedSnapshot,
    token,
    decision,
  );

  state.transactions.push(transaction);
  options.onCorrection?.({ snapshot: committedSnapshot, token, transaction });

  if (state.settings.keepCorrectionMarksVisible) {
    emitMark(options, state, committedSnapshot, {
      id: createId(state, "mark"),
      range: rangeAfter,
      kind: "blue_applied_correction",
      correctionEventId: transaction.id,
      original: decision.original,
      replacement: decision.replacement,
      reasonCodes: decision.reasonCodes,
    });
  }

  announce(state, `Corrected ${transaction.original} to ${transaction.replacement}`);

  return transaction;
}

function createTextareaCorrectionTransaction(
  state: TextareaAdapterState,
  snapshot: TextareaSnapshot,
  committedSnapshot: TextareaSnapshot,
  token: Token,
  decision: Extract<CorrectionDecision, { action: "auto_correct" }>,
): TextareaCorrectionTransaction {
  return {
    id: createId(state, "correction"),
    documentVersion: committedSnapshot.version,
    rangeBefore: {
      start: token.range.start,
      end: token.range.end,
      text: token.text,
    },
    rangeAfter: {
      start: token.range.start,
      end: token.range.start + decision.replacement.length,
      text: decision.replacement,
    },
    original: decision.original,
    replacement: decision.replacement,
    trigger: triggerFromSnapshot(snapshot),
    confidence: decision.confidence,
    reasonCodes: decision.reasonCodes,
    createdAt: Date.now(),
  };
}

function revertTextareaCorrection(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  transactionId: string,
): TextareaCorrectionRevertResult {
  const transaction = state.transactions.find((candidate) => candidate.id === transactionId);

  if (transaction === undefined) {
    return { applied: false, reason: "missing_transaction" };
  }

  if (!isTextareaWritable(options.textarea)) {
    return { applied: false, reason: "not_writable" };
  }

  if (
    !rangeStillMatches({
      textarea: options.textarea,
      range: transaction.rangeAfter,
      expectedText: transaction.replacement,
      version: transaction.documentVersion,
      currentVersion: state.version,
    })
  ) {
    return { applied: false, reason: "stale_range" };
  }

  const nextValue =
    options.textarea.value.slice(0, transaction.rangeAfter.start) +
    transaction.original +
    options.textarea.value.slice(transaction.rangeAfter.end);
  const nextSelection = adjustCurrentSelectionForReplacement(
    options.textarea,
    transaction.rangeAfter,
    transaction.original.length,
  );

  removeMarksForCorrection(options, state, transaction.id);
  commitTextareaValue(options, state, nextValue, nextSelection);

  return { applied: true };
}

async function applyRedSuggestion(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  markId: string,
  suggestion: string,
): Promise<TextareaPopoverActionResult> {
  if (!isTextareaWritable(options.textarea)) {
    return { applied: false, reason: "not_writable" };
  }

  const mark = getCurrentStoredMark(options, state, markId);

  if (mark === null) {
    return { applied: false, reason: "missing_mark" };
  }

  if (!validateStoredMark(options, state, mark)) {
    removeStoredMark(options, state, mark.id);
    renderOverlay(state);
    return { applied: false, reason: "stale_range" };
  }

  const nextValue =
    options.textarea.value.slice(0, mark.range.start) +
    suggestion +
    options.textarea.value.slice(mark.range.end);
  const nextSelection = adjustCurrentSelectionForReplacement(
    options.textarea,
    mark.range,
    suggestion.length,
  );
  const transaction: TextareaCorrectionTransaction = {
    id: createId(state, "correction"),
    documentVersion: state.version + 1,
    rangeBefore: {
      start: mark.range.start,
      end: mark.range.end,
      text: mark.text,
    },
    rangeAfter: {
      start: mark.range.start,
      end: mark.range.start + suggestion.length,
      text: suggestion,
    },
    original: mark.original ?? mark.text,
    replacement: suggestion,
    trigger: "punctuation",
    confidence: 1,
    reasonCodes: mark.reasonCodes ?? [],
    createdAt: Date.now(),
  };

  removeStoredMark(options, state, mark.id);
  const committedSnapshot = commitTextareaValue(options, state, nextValue, nextSelection);
  const committedTransaction = {
    ...transaction,
    documentVersion: committedSnapshot.version,
  };

  state.transactions.push(committedTransaction);
  options.onCorrection?.({
    snapshot: committedSnapshot,
    token: storedMarkToToken(mark),
    transaction: committedTransaction,
  });

  if (state.settings.keepCorrectionMarksVisible) {
    emitMark(options, state, committedSnapshot, {
      id: createId(state, "mark"),
      range: committedTransaction.rangeAfter,
      kind: "blue_applied_correction",
      correctionEventId: committedTransaction.id,
      original: committedTransaction.original,
      replacement: suggestion,
      reasonCodes: committedTransaction.reasonCodes,
    });
  }

  closePopover(options, state, true);
  announce(state, `Applied suggestion ${suggestion}`);

  return { applied: true };
}

function commitTextareaValue(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  nextValue: string,
  nextSelection: { selectionStart: number; selectionEnd: number },
): TextareaSnapshot {
  clearTextareaGhostText(state, "correction_transaction");
  options.textarea.value = nextValue;
  setTextareaSelection(options.textarea, nextSelection.selectionStart, nextSelection.selectionEnd);
  state.version += 1;
  state.lastValue = options.textarea.value;
  state.snapshot = getTextareaSnapshot(options.textarea, state.version, state.isComposingIME);
  pruneStaleMarks(options, state);
  renderOverlay(state);
  options.completion?.onCorrectionTransaction?.();

  return state.snapshot;
}

function adjustSelectionForReplacement(
  snapshot: TextareaSnapshot,
  range: Token["range"],
  replacementLength: number,
): { selectionStart: number; selectionEnd: number } {
  return adjustSelectionOffsets(
    snapshot.selectionStart,
    snapshot.selectionEnd,
    range,
    replacementLength,
  );
}

function adjustCurrentSelectionForReplacement(
  textarea: HTMLTextAreaElement,
  range: Token["range"],
  replacementLength: number,
): { selectionStart: number; selectionEnd: number } {
  return adjustSelectionOffsets(
    textarea.selectionStart,
    textarea.selectionEnd,
    range,
    replacementLength,
  );
}

function adjustSelectionOffsets(
  selectionStart: number,
  selectionEnd: number,
  range: Token["range"],
  replacementLength: number,
): { selectionStart: number; selectionEnd: number } {
  const delta = replacementLength - (range.end - range.start);

  return {
    selectionStart: adjustSelectionOffset(selectionStart, range, delta, replacementLength),
    selectionEnd: adjustSelectionOffset(selectionEnd, range, delta, replacementLength),
  };
}

function adjustSelectionOffset(
  offset: number,
  range: Token["range"],
  delta: number,
  replacementLength: number,
): number {
  if (offset <= range.start) {
    return offset;
  }

  if (offset >= range.end) {
    return offset + delta;
  }

  return range.start + replacementLength;
}

function setTextareaSelection(
  textarea: HTMLTextAreaElement,
  selectionStart: number,
  selectionEnd: number,
): void {
  const safeStart = Math.max(0, Math.min(selectionStart, textarea.value.length));
  const safeEnd = Math.max(0, Math.min(selectionEnd, textarea.value.length));

  if (typeof textarea.setSelectionRange === "function") {
    textarea.setSelectionRange(safeStart, safeEnd);
    return;
  }

  textarea.selectionStart = safeStart;
  textarea.selectionEnd = safeEnd;
}

function shouldApplyAutoCorrection(
  decision: Extract<CorrectionDecision, { action: "auto_correct" }>,
): boolean {
  return (
    decision.reasonCodes.includes("COMMON_TYPO_MATCH") ||
    decision.reasonCodes.includes("ALWAYS_CORRECT_RULE")
  );
}

function storeMark(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  mark: TextareaMark,
): StoredTextareaMark | null {
  if (!isValidTextareaRange(options.textarea.value, mark.range)) {
    return null;
  }

  const text = options.textarea.value.slice(mark.range.start, mark.range.end);

  if (text.length === 0) {
    return null;
  }

  const duplicate = findDuplicateMark(state, mark, text);

  if (duplicate !== null) {
    return duplicate;
  }

  const storedMark: StoredTextareaMark = {
    ...mark,
    documentVersion: state.version,
    text,
  };

  state.marks.set(storedMark.id, storedMark);

  return storedMark;
}

function findDuplicateMark(
  state: TextareaAdapterState,
  mark: TextareaMark,
  text: string,
): StoredTextareaMark | null {
  for (const storedMark of state.marks.values()) {
    if (
      storedMark.kind === mark.kind &&
      storedMark.range.start === mark.range.start &&
      storedMark.range.end === mark.range.end &&
      storedMark.text === text &&
      storedMark.original === mark.original &&
      storedMark.replacement === mark.replacement
    ) {
      return storedMark;
    }
  }

  return null;
}

function pruneStaleMarks(options: AttachTextareaOptions, state: TextareaAdapterState): void {
  for (const mark of state.marks.values()) {
    if (!storedMarkStillMatches(options.textarea.value, mark)) {
      removeStoredMark(options, state, mark.id);
    }
  }
}

function storedMarkStillMatches(value: string, mark: StoredTextareaMark): boolean {
  return (
    isValidTextareaRange(value, mark.range) &&
    value.slice(mark.range.start, mark.range.end) === mark.text
  );
}

function removeMarksForCorrection(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  transactionId: string,
): void {
  for (const mark of state.marks.values()) {
    if (mark.correctionEventId === transactionId) {
      removeStoredMark(options, state, mark.id);
    }
  }
}

function removeMarksOverlappingRange(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  range: Token["range"],
): void {
  for (const mark of state.marks.values()) {
    if (rangesOverlap(mark.range, range)) {
      removeStoredMark(options, state, mark.id);
    }
  }
}

function rangesOverlap(left: Token["range"], right: Token["range"]): boolean {
  return left.start < right.end && right.start < left.end;
}

function removeStoredMark(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  markId: string,
): boolean {
  const mark = state.marks.get(markId);

  if (mark === undefined) {
    return false;
  }

  state.marks.delete(markId);
  options.onMarkRemoved?.({ snapshot: state.snapshot, mark: stripStoredMark(mark) });

  return true;
}

function stripStoredMark(mark: StoredTextareaMark): TextareaMark {
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

function createOverlayInteractionLayer(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
): void {
  const root = state.overlay?.root;
  const ownerDocument = options.textarea.ownerDocument;

  if (root === undefined || root === null || ownerDocument === undefined) {
    return;
  }

  const triggerRoot = ownerDocument.createElement("div");
  const liveRegion = ownerDocument.createElement("div");

  triggerRoot.className = "typai-textarea-mark-triggers";
  triggerRoot.setAttribute("data-typai-textarea-mark-triggers", "true");
  liveRegion.className = "typai-textarea-live-region";
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  visuallyHide(liveRegion);

  root.appendChild(triggerRoot);
  root.appendChild(liveRegion);
  state.triggerRoot = triggerRoot;
  state.liveRegion = liveRegion;
}

function renderMarkTriggers(options: AttachTextareaOptions, state: TextareaAdapterState): void {
  const triggerRoot = state.triggerRoot;

  if (triggerRoot === null) {
    return;
  }

  clearChildren(triggerRoot);

  for (const mark of state.marks.values()) {
    const trigger = createMarkTrigger(options, state, mark);

    triggerRoot.appendChild(trigger);
  }
}

function createMarkTrigger(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  mark: StoredTextareaMark,
): HTMLElement {
  const ownerDocument = options.textarea.ownerDocument;
  const trigger = ownerDocument.createElement("button");

  trigger.setAttribute("type", "button");
  trigger.setAttribute("data-typai-textarea-mark-trigger", mark.id);
  trigger.setAttribute(
    "data-testid",
    mark.kind === "blue_applied_correction"
      ? "textarea-blue-mark-trigger"
      : "textarea-red-mark-trigger",
  );
  trigger.setAttribute("aria-label", labelForMarkTrigger(mark));
  trigger.textContent = labelForMarkTrigger(mark);
  visuallyHide(trigger);
  trigger.addEventListener("click", () => openPopoverForMark(options, state, mark.id));
  trigger.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key !== "Enter" && key !== " ") {
      return;
    }

    event.preventDefault();
    openPopoverForMark(options, state, mark.id);
  });

  return trigger;
}

function openPopoverForMark(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  markId: string,
): void {
  const mark = getCurrentStoredMark(options, state, markId);

  if (mark === null) {
    closePopover(options, state, true);
    renderOverlay(state);
    return;
  }

  closePopover(options, state, false);

  const ownerDocument = options.textarea.ownerDocument;
  const root = state.overlay?.root ?? options.textarea.parentElement;

  if (root === undefined || root === null) {
    return;
  }

  const popover =
    mark.kind === "blue_applied_correction"
      ? createBluePopover(options, state, mark)
      : createRedPopover(options, state, mark);

  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "false");
  popover.setAttribute("data-typai-textarea-popover", mark.id);
  popover.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key !== "Escape") {
      return;
    }

    event.preventDefault();
    closePopover(options, state, true);
  });
  root.appendChild(popover);
  state.popoverElement = popover;
  positionPopover(state, mark, popover);
  ownerDocument.defaultView?.setTimeout?.(() => focusFirstPopoverAction(popover), 0);
}

function createBluePopover(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  mark: StoredTextareaMark,
): HTMLElement {
  const transaction = findTransactionForMark(state, mark);
  const original = transaction?.original ?? mark.original ?? mark.text;
  const replacement = transaction?.replacement ?? mark.replacement ?? mark.text;
  const popover = createPopoverShell(
    options,
    `Corrected ${original} to ${replacement}`,
    `Corrected "${original}" -> "${replacement}"`,
  );

  popover.setAttribute("data-testid", "textarea-blue-popover");
  appendPopoverButton(
    popover,
    `Revert to "${original}"`,
    async () => {
      const result = revertTextareaCorrection(options, state, transaction?.id ?? "");

      if (result.applied) {
        closePopover(options, state, true);
        announce(state, "Reverted correction");
      }

      return result;
    },
    "textarea-revert-action",
  );
  appendPopoverButton(
    popover,
    `Always correct "${original}" to "${replacement}"`,
    async () => {
      await options.typai.setAlwaysCorrect(original, replacement);
      closePopover(options, state, true);
      announce(state, `Always correct ${original} to ${replacement}`);

      return { applied: true };
    },
    "textarea-always-correct-action",
  );
  appendPopoverButton(
    popover,
    "Don't correct this again",
    async () => {
      await options.typai.setNeverCorrect(original, replacement);
      const result = revertTextareaCorrection(options, state, transaction?.id ?? "");

      closePopover(options, state, true);
      announce(state, "Disabled this correction");

      return result.applied ? result : { applied: true };
    },
    "textarea-never-correct-action",
  );
  appendPopoverButton(
    popover,
    `Add "${original}" to dictionary`,
    async () => {
      if (state.settings.usePersonalDictionary) {
        await options.typai.addToPersonalDictionary(original);
      }

      const result = revertTextareaCorrection(options, state, transaction?.id ?? "");

      closePopover(options, state, true);
      announce(state, "Added word to dictionary");

      return result.applied ? result : { applied: true };
    },
    "textarea-add-dictionary-action",
  );

  return popover;
}

function createRedPopover(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  mark: StoredTextareaMark,
): HTMLElement {
  const original = mark.original ?? mark.text;
  const suggestions = mark.suggestions ?? [];
  const popover = createPopoverShell(
    options,
    `Possible spelling issue: ${original}`,
    `Possible spelling issue: "${original}"`,
  );

  popover.setAttribute("data-testid", "textarea-red-popover");
  for (const suggestion of suggestions) {
    appendPopoverButton(
      popover,
      suggestion,
      () => applyRedSuggestion(options, state, mark.id, suggestion),
      "textarea-suggestion-item",
    );
  }

  appendPopoverButton(
    popover,
    "Ignore once",
    async () => {
      const removed = removeStoredMark(options, state, mark.id);

      renderOverlay(state);
      closePopover(options, state, true);
      announce(state, "Ignored spelling issue");

      return removed ? { applied: true } : { applied: false, reason: "missing_mark" };
    },
    "textarea-ignore-once-action",
  );
  appendPopoverButton(
    popover,
    "Add to dictionary",
    async () => {
      if (state.settings.usePersonalDictionary) {
        await options.typai.addToPersonalDictionary(original);
      }

      const removed = removeStoredMark(options, state, mark.id);

      renderOverlay(state);
      closePopover(options, state, true);
      announce(state, "Added word to dictionary");

      return removed ? { applied: true } : { applied: false, reason: "missing_mark" };
    },
    "textarea-add-dictionary-action",
  );
  appendPopoverButton(
    popover,
    "Disable autocorrect",
    async () => {
      state.settings = {
        ...state.settings,
        autocorrect: false,
      };
      closePopover(options, state, true);
      announce(state, "Autocorrect disabled");

      return { applied: true };
    },
    "textarea-disable-autocorrect-action",
  );

  return popover;
}

function createPopoverShell(
  options: AttachTextareaOptions,
  label: string,
  text: string,
): HTMLElement {
  const ownerDocument = options.textarea.ownerDocument;
  const popover = ownerDocument.createElement("div");
  const message = ownerDocument.createElement("p");

  popover.className = "typai-textarea-popover";
  popover.setAttribute("aria-label", label);
  popover.style.setProperty("position", "absolute");
  popover.style.setProperty("z-index", "3");
  popover.style.setProperty("background", "Canvas");
  popover.style.setProperty("color", "CanvasText");
  popover.style.setProperty("border", "1px solid currentColor");
  popover.style.setProperty("padding", "8px");
  message.textContent = text;
  popover.appendChild(message);

  return popover;
}

function appendPopoverButton(
  popover: HTMLElement,
  label: string,
  action: () => Promise<TextareaPopoverActionResult> | TextareaPopoverActionResult,
  testId?: string,
): HTMLButtonElement {
  const button = popover.ownerDocument.createElement("button");
  const run = () => {
    void Promise.resolve(action());
  };

  button.setAttribute("type", "button");
  if (testId !== undefined) {
    button.setAttribute("data-testid", testId);
  }
  button.textContent = label;
  button.addEventListener("click", run);
  button.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key !== "Enter" && key !== " ") {
      return;
    }

    event.preventDefault();
    run();
  });
  popover.appendChild(button);

  return button as HTMLButtonElement;
}

function closePopover(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  restoreFocus: boolean,
): void {
  if (state.popoverElement === null) {
    return;
  }

  state.popoverElement.remove();
  state.popoverElement = null;

  if (restoreFocus) {
    focusTextarea(options.textarea);
  }
}

function positionPopover(
  state: TextareaAdapterState,
  mark: StoredTextareaMark,
  popover: HTMLElement,
): void {
  const markElement = findMirrorMarkElement(state, mark.id);
  const root = state.overlay?.root;

  if (markElement === null || root === undefined || root === null) {
    popover.style.setProperty("top", "100%");
    popover.style.setProperty("left", "0");
    return;
  }

  const markRect = getElementRect(markElement);
  const rootRect = getElementRect(root);

  if (markRect === null || rootRect === null) {
    popover.style.setProperty("top", "100%");
    popover.style.setProperty("left", "0");
    return;
  }

  popover.style.setProperty("top", `${Math.max(0, markRect.bottom - rootRect.top)}px`);
  popover.style.setProperty("left", `${Math.max(0, markRect.left - rootRect.left)}px`);
}

function findMirrorMarkElement(state: TextareaAdapterState, markId: string): HTMLElement | null {
  const querySelectorAll = state.overlay?.mirror.querySelectorAll;

  if (querySelectorAll === undefined) {
    return null;
  }

  const elements = querySelectorAll.call(
    state.overlay?.mirror,
    "[data-typai-textarea-mark-id]",
  ) as Iterable<HTMLElement>;

  for (const element of elements) {
    if (element.getAttribute("data-typai-textarea-mark-id") === markId) {
      return element;
    }
  }

  return null;
}

function getElementRect(element: HTMLElement): DOMRect | null {
  if (typeof element.getBoundingClientRect !== "function") {
    return null;
  }

  return element.getBoundingClientRect();
}

function focusFirstPopoverAction(popover: HTMLElement): void {
  const querySelector = popover.querySelector;

  if (querySelector === undefined) {
    return;
  }

  const firstButton = querySelector.call(popover, "button") as HTMLElement | null;

  firstButton?.focus?.();
}

function getCurrentStoredMark(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  markId: string,
): StoredTextareaMark | null {
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
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
  mark: StoredTextareaMark,
): boolean {
  return rangeStillMatches({
    textarea: options.textarea,
    range: mark.range,
    expectedText: mark.text,
    version: mark.documentVersion,
    currentVersion: state.version,
  });
}

function findTransactionForMark(
  state: TextareaAdapterState,
  mark: StoredTextareaMark,
): TextareaCorrectionTransaction | null {
  if (mark.correctionEventId === undefined) {
    return null;
  }

  return (
    state.transactions.find((transaction) => transaction.id === mark.correctionEventId) ?? null
  );
}

function storedMarkToToken(mark: StoredTextareaMark): Token {
  return {
    text: mark.text,
    normalized: mark.text.toLowerCase(),
    range: mark.range,
    language: "en-US",
    protected: false,
    tokenType: "word",
  };
}

function labelForMarkTrigger(mark: StoredTextareaMark): string {
  return mark.kind === "blue_applied_correction"
    ? `Review correction ${mark.original ?? mark.text} to ${mark.replacement ?? mark.text}`
    : `Review spelling issue ${mark.original ?? mark.text}`;
}

function announce(state: TextareaAdapterState, message: string): void {
  if (state.liveRegion !== null) {
    state.liveRegion.textContent = message;
  }
}

function visuallyHide(element: HTMLElement): void {
  element.style.setProperty("position", "absolute");
  element.style.setProperty("width", "1px");
  element.style.setProperty("height", "1px");
  element.style.setProperty("overflow", "hidden");
  element.style.setProperty("clip", "rect(0 0 0 0)");
  element.style.setProperty("white-space", "nowrap");
}

function clearChildren(element: HTMLElement): void {
  while (element.childNodes.length > 0) {
    element.removeChild(element.childNodes[0] as Node);
  }
}

function focusTextarea(textarea: HTMLTextAreaElement): void {
  textarea.focus?.();
}

function isTextareaWritable(textarea: HTMLTextAreaElement): boolean {
  return textarea.disabled !== true && textarea.readOnly !== true;
}

function addTextareaFormResetListener(
  options: AttachTextareaOptions,
  state: TextareaAdapterState,
): () => void {
  const form = options.textarea.form;

  if (!isEventTargetWithListeners(form)) {
    return () => {};
  }

  const onReset = () => {
    closePopover(options, state, false);
    clearTextareaGhostText(state, "typing");
    queueAfterNativeFormReset(options.textarea, () => {
      const previousVersion = state.version;

      syncTextareaSnapshot(options.textarea, state);

      if (state.version !== previousVersion) {
        pruneStaleMarks(options, state);
      }

      renderOverlay(state);
    });
  };

  form.addEventListener("reset", onReset);

  return () => form.removeEventListener("reset", onReset);
}

function addDocumentSelectionChangeListener(
  textarea: HTMLTextAreaElement,
  listener: () => void,
): () => void {
  const ownerDocument = textarea.ownerDocument;

  if (!isEventTargetWithListeners(ownerDocument)) {
    return () => {};
  }

  const onSelectionChange = () => {
    listener();
  };

  ownerDocument.addEventListener("selectionchange", onSelectionChange);

  return () => ownerDocument.removeEventListener("selectionchange", onSelectionChange);
}

function queueAfterNativeFormReset(textarea: HTMLTextAreaElement, callback: () => void): void {
  const setTimeoutFromWindow = textarea.ownerDocument?.defaultView?.setTimeout;

  if (typeof setTimeoutFromWindow === "function") {
    setTimeoutFromWindow(callback, 0);
    return;
  }

  setTimeout(callback, 0);
}

function isEventTargetWithListeners(
  value: unknown,
): value is Pick<EventTarget, "addEventListener" | "removeEventListener"> {
  return (
    isRecord(value) &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}

function syncTextareaSnapshot(
  textarea: HTMLTextAreaElement,
  state: TextareaAdapterState,
): TextareaSnapshot {
  if (textarea.value !== state.lastValue) {
    state.version += 1;
    state.lastValue = textarea.value;
  }

  state.snapshot = getTextareaSnapshot(textarea, state.version, state.isComposingIME);

  return state.snapshot;
}

function resolveSettings(options: AttachTextareaOptions): TextareaAdapterSettings {
  return {
    ...defaultSettings,
    ...options.settings,
    autocorrect:
      options.autocorrect ?? options.settings?.autocorrect ?? defaultSettings.autocorrect,
    spellcheck: options.spellcheck ?? options.settings?.spellcheck ?? defaultSettings.spellcheck,
  };
}

function resolveOverlaySettings(options: AttachTextareaOptions): TextareaOverlaySettings {
  return {
    enabled: options.overlay?.enabled ?? true,
    className: options.overlay?.className,
  };
}

function validateAttachOptions(options: AttachTextareaOptions): AttachTextareaOptions {
  const rawOptions = options as unknown;

  if (!isRecord(rawOptions)) {
    throw new TypeError("attachTextarea requires an options object.");
  }

  const textarea = rawOptions.textarea;
  const typai = rawOptions.typai;

  if (!isTextareaElement(textarea)) {
    throw new TypeError("attachTextarea requires options.textarea to be an HTMLTextAreaElement.");
  }

  if (!isTypaiCore(typai)) {
    throw new TypeError("attachTextarea requires options.typai to be an initialized TypaiCore.");
  }

  return rawOptions as AttachTextareaOptions;
}

function getInputEventData(event: Event): string | null {
  const maybeData = (event as { data?: unknown }).data;

  return typeof maybeData === "string" ? maybeData : null;
}

function getKeyboardEventKey(event: Event): string | null {
  const maybeKey = (event as { key?: unknown }).key;

  return typeof maybeKey === "string" ? maybeKey : null;
}

function triggerFromSnapshot(snapshot: TextareaSnapshot): TextareaCorrectionTransaction["trigger"] {
  const delimiter = snapshot.value[snapshot.selectionStart - 1];

  if (delimiter === "\n") {
    return "newline";
  }

  if (delimiter === " " || delimiter === "\t") {
    return "space";
  }

  return "punctuation";
}

function createId(state: TextareaAdapterState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;

  return id;
}

function renderOverlay(state: TextareaAdapterState): void {
  state.overlay?.render(state.snapshot.value, [...state.marks.values()].map(stripStoredMark));
  renderMarkTriggers(state.options, state);
}

function isTextareaElement(value: unknown): value is HTMLTextAreaElement {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement) {
    return true;
  }

  return (
    value.nodeName === "TEXTAREA" &&
    typeof value.value === "string" &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}

function isTypaiCore(value: unknown): value is TypaiCore {
  return (
    isRecord(value) &&
    typeof value.checkCompletedToken === "function" &&
    typeof value.suggestToken === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
