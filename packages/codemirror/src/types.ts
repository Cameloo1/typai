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

export type TypaiCodeMirrorOptions = {
  typai: TypaiCore;
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
