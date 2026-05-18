export type TypaiAdapterKind =
  | "contenteditable"
  | "textarea"
  | "react-textarea"
  | "react-contenteditable"
  | "codemirror";

export type AdapterSnapshot = {
  text: string;
  version: number;
  selection: {
    start: number;
    end: number;
  };
  isComposingIME: boolean;
};

export type AdapterRange = {
  start: number;
  end: number;
};

export type AdapterMark = {
  id: string;
  range: AdapterRange;
  kind: "red_spelling_issue" | "blue_applied_correction";
  original?: string;
  replacement?: string;
  suggestions?: string[];
};

export type AdapterCorrectionTransaction = {
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
  trigger: "space" | "punctuation" | "newline" | "popover";
  confidence: number;
  reasonCodes: string[];
  createdAt: number;
};

export type AdapterConformanceDriver = {
  name: string;
  setup(): Promise<void> | void;
  teardown(): Promise<void> | void;
  reset(value?: string): Promise<void> | void;
  typeText(text: string): Promise<void> | void;
  pasteText?(text: string): Promise<void> | void;
  getText(): string;
  getMarks(): AdapterMark[];
  getTransactions(): AdapterCorrectionTransaction[];
  getDebugState?(): unknown;
  openBlueMark?(index?: number): Promise<void> | void;
  openRedMark?(index?: number): Promise<void> | void;
  revertFirstBlueMark?(): Promise<void> | void;
  chooseFirstRedSuggestion?(): Promise<void> | void;
  setComposition?(active: boolean): Promise<void> | void;
  simulateStaleWrite?(): Promise<void> | void;
  hasGhostTextCompletion?(): boolean;
  hasRemoteCompletionPath?(): boolean;
};

export type AdapterConformanceDriverFactory = () =>
  | AdapterConformanceDriver
  | Promise<AdapterConformanceDriver>;

export type AdapterConformanceCapabilities = {
  blueRevert: boolean;
  redSuggestionApply: boolean;
  compositionGuard: boolean;
  staleWriteSimulation: boolean;
  plainSourceText: boolean;
  codeBlockProtection: boolean;
  completionSurfaceCheck: boolean;
};

export type AdapterConformanceSkipReasons = Partial<
  Record<keyof AdapterConformanceCapabilities, string>
>;

export type AdapterConformanceOptions = {
  kind?: TypaiAdapterKind;
  suiteName?: string;
  capabilities?: Partial<AdapterConformanceCapabilities>;
  skipReasons?: AdapterConformanceSkipReasons;
};
