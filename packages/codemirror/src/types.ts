import type { CorrectionDecision, TypaiCore, TypaiRange } from "@typai/core";

export type TypaiCodeMirrorMarkKind = "red_spelling_issue" | "blue_applied_correction";

export type CodeMirrorTypaiMark = {
  id: string;
  from: number;
  to: number;
  kind: TypaiCodeMirrorMarkKind;
  original?: string;
  replacement?: string;
  suggestions?: string[];
  reasonCodes?: string[];
};

export type CodeMirrorTypaiCorrectionTrigger = "space" | "punctuation" | "newline" | "popover";

export type CodeMirrorTypaiCorrectionTransaction = {
  id: string;
  markId: string;
  documentVersion: number;
  docLengthBefore: number;
  rangeBefore: {
    from: number;
    to: number;
    text: string;
  };
  rangeAfter: {
    from: number;
    to: number;
    text: string;
  };
  original: string;
  replacement: string;
  trigger: CodeMirrorTypaiCorrectionTrigger;
  confidence: number;
  reasonCodes: string[];
  createdAt: number;
};

export type CodeMirrorCompletionMode = "prose" | "prompt" | "markdown" | "command" | "code";

export type CodeMirrorCompletionSnapshot = {
  text: string;
  version: number;
  selection: {
    start: number;
    end: number;
  };
  isComposingIME: boolean;
  mode?: CodeMirrorCompletionMode;
  protected?: boolean;
};

export type CodeMirrorGhostTextClearReason =
  | "typing"
  | "escape"
  | "selection_change"
  | "composition"
  | "blur"
  | "paste"
  | "correction_transaction"
  | "stale"
  | "manual"
  | "protected_context";

export type CodeMirrorCompletionGhostMetadata = {
  requestId?: string;
  providerName?: string;
  model?: string;
  latencyMs?: number;
};

export type CodeMirrorCompletionGhost = {
  text: string;
  from: number;
  snapshot: CodeMirrorCompletionSnapshot;
  metadata?: CodeMirrorCompletionGhostMetadata;
};

export type CodeMirrorCompletionEditor = {
  renderGhostTextAtCaret(
    text: string,
    snapshot?: CodeMirrorCompletionSnapshot,
    metadata?: CodeMirrorCompletionGhostMetadata,
  ): boolean;
  clearGhostText(reason?: CodeMirrorGhostTextClearReason): boolean;
  isGhostTextVisible(): boolean;
  getGhostText(): string | null;
  getSnapshot(): CodeMirrorCompletionSnapshot;
};

export type CodeMirrorCompletionController = {
  connectEditor?(editor: CodeMirrorCompletionEditor): (() => void) | undefined;
  onEditorInput?(snapshot: CodeMirrorCompletionSnapshot): void;
  onEditorSelectionChange?(snapshot: CodeMirrorCompletionSnapshot): void;
  onEditorBlur?(): void;
  onEditorCompositionStart?(): void;
  onCorrectionTransaction?(): void;
  onGhostTextDismiss?(
    reason: CodeMirrorGhostTextClearReason,
    snapshot: CodeMirrorCompletionSnapshot,
  ): void;
  destroy?(): void;
};

export type TypaiCodeMirrorOptions = {
  typai: TypaiCore;
  completion?: CodeMirrorCompletionController;
  completionMode?: CodeMirrorCompletionMode;
  autocorrect?: boolean;
  spellcheck?: boolean;
  marks?: {
    corrected?: boolean;
    spelling?: boolean;
  };
  onDecision?: (event: TypaiCodeMirrorDecisionEvent) => void;
  onCorrection?: (event: TypaiCodeMirrorCorrectionEvent) => void;
  onMark?: (mark: CodeMirrorTypaiMark) => void;
};

export type TypaiCodeMirrorResolvedOptions = {
  typai: TypaiCore;
  completion?: CodeMirrorCompletionController;
  completionMode?: CodeMirrorCompletionMode;
  autocorrect: boolean;
  spellcheck: boolean;
  marks: {
    corrected: boolean;
    spelling: boolean;
  };
  onDecision?: (event: TypaiCodeMirrorDecisionEvent) => void;
  onCorrection?: (event: TypaiCodeMirrorCorrectionEvent) => void;
  onMark?: (mark: CodeMirrorTypaiMark) => void;
};

export type TypaiCodeMirrorDecisionEvent = {
  token: {
    text: string;
    range: TypaiRange;
  };
  decision: CorrectionDecision;
};

export type TypaiCodeMirrorCorrectionEvent = {
  token: {
    text: string;
    range: TypaiRange;
  };
  decision: Extract<CorrectionDecision, { action: "auto_correct" }>;
  applied: boolean;
  reason: "applied" | "autocorrect_disabled" | "stale_range";
  transaction?: CodeMirrorTypaiCorrectionTransaction;
};
