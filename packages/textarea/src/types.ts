import type { CorrectionDecision, Token, TypaiCore, TypaiRange } from "@typai/core";

export type TextareaOverlayMode = "overlay-mirror";

export type TextareaRange = TypaiRange;

export type TextareaAdapterSettings = {
  autocorrect: boolean;
  spellcheck: boolean;
  keepCorrectionMarksVisible: boolean;
  usePersonalDictionary: boolean;
};

export type TextareaSnapshot = {
  value: string;
  version: number;
  selectionStart: number;
  selectionEnd: number;
  isComposingIME: boolean;
};

export type TextareaCompletionMode = "prose" | "prompt" | "markdown" | "command" | "code";

export type TextareaCompletionSnapshot = {
  text: string;
  version: number;
  selection: { start: number; end: number };
  isComposingIME: boolean;
  mode?: TextareaCompletionMode;
};

export type TextareaCompletionController = {
  onEditorInput?(snapshot: TextareaCompletionSnapshot): void;
  onEditorSelectionChange?(snapshot: TextareaCompletionSnapshot): void;
  onEditorBlur?(): void;
  onEditorCompositionStart?(): void;
  onCorrectionTransaction?(): void;
  destroy?(): void;
};

export type TextareaGhostTextClearReason =
  | "manual"
  | "typing"
  | "escape"
  | "selection_change"
  | "composition_start"
  | "blur"
  | "paste"
  | "correction_transaction"
  | "stale_snapshot"
  | "empty"
  | "overlay_unavailable"
  | "detach";

export type TextareaMark = {
  id: string;
  range: TextareaRange;
  kind: "red_spelling_issue" | "blue_applied_correction";
  correctionEventId?: string;
  original?: string;
  replacement?: string;
  suggestions?: string[];
  reasonCodes?: string[];
};

export type TextareaCorrectionTransaction = {
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
  trigger: "space" | "punctuation" | "newline";
  confidence: number;
  reasonCodes: string[];
  createdAt: number;
};

export type TextareaDecisionEvent = {
  snapshot: TextareaSnapshot;
  token: Token;
  decision: CorrectionDecision;
};

export type TextareaCorrectionEvent = {
  snapshot: TextareaSnapshot;
  token: Token;
  transaction: TextareaCorrectionTransaction;
};

export type TextareaMarkEvent = {
  snapshot: TextareaSnapshot;
  mark: TextareaMark;
};

export type TextareaMarkRemovedEvent = {
  snapshot: TextareaSnapshot;
  mark: TextareaMark;
};

export type TextareaProtectedSkipEvent = {
  snapshot: TextareaSnapshot;
  token: Token;
};

export type TextareaCorrectionRevertResult = {
  applied: boolean;
  reason?: "missing_transaction" | "not_writable" | "stale_range";
};

export type TextareaPopoverActionResult = {
  applied: boolean;
  reason?: "missing_mark" | "missing_transaction" | "not_writable" | "stale_range";
};

export type AttachTextareaOptions = {
  textarea: HTMLTextAreaElement;
  typai: TypaiCore;
  autocorrect?: boolean;
  spellcheck?: boolean;
  settings?: Partial<TextareaAdapterSettings>;
  overlay?: {
    enabled?: boolean;
    className?: string;
  };
  completion?: TextareaCompletionController;
  onDecision?: (event: TextareaDecisionEvent) => void;
  onCorrection?: (event: TextareaCorrectionEvent) => void;
  onMark?: (event: TextareaMarkEvent) => void;
  onMarkRemoved?: (event: TextareaMarkRemovedEvent) => void;
  onProtectedSkip?: (event: TextareaProtectedSkipEvent) => void;
};

export type DetachTextarea = (() => void) & {
  revertTextareaCorrection(transactionId: string): TextareaCorrectionRevertResult;
  getSettings(): TextareaAdapterSettings;
  updateSettings(settings: Partial<TextareaAdapterSettings>): void;
  resyncOverlay(): void;
  renderTextareaGhostText(text: string, snapshot: TextareaCompletionSnapshot): boolean;
  clearTextareaGhostText(reason?: TextareaGhostTextClearReason): void;
  isTextareaGhostVisible(): boolean;
  getTextareaGhostText(): string | null;
};
