export type CompletionConformanceDriver = {
  name: string;
  setup(): Promise<void> | void;
  teardown(): Promise<void> | void;
  reset(value?: string): Promise<void> | void;
  typeText(text: string): Promise<void> | void;
  getText(): string;
  getGhostText(): string | null;
  isGhostVisible(): boolean;
  waitForGhostText(expected?: string): Promise<void>;
  pressTab(): Promise<void> | void;
  pressEscape(): Promise<void> | void;
  changeSelection?(): Promise<void> | void;
  startComposition?(): Promise<void> | void;
  blur?(): Promise<void> | void;
  pasteText?(text: string): Promise<void> | void;
  revertLastCompletion?(): Promise<void> | void;
  getCompletionTransactions(): unknown[];
  getCompletionMetrics?(): unknown[];
};

export type CompletionConformanceDriverFactory = () =>
  | CompletionConformanceDriver
  | Promise<CompletionConformanceDriver>;

export type CompletionConformanceCapabilities = {
  exactRevert: boolean;
  selectionChangeDismiss: boolean;
  compositionDismiss: boolean;
  staleResponseDrop: boolean;
  providerError: boolean;
  blueCorrectionMarkCheck: boolean;
  correctionTransactionDismiss: boolean;
  metricsPrivacy: boolean;
};

export type CompletionConformanceSkipReasons = Partial<
  Record<keyof CompletionConformanceCapabilities, string>
>;

export type CompletionConformanceOptions = {
  suiteName?: string;
  capabilities?: Partial<CompletionConformanceCapabilities>;
  skipReasons?: CompletionConformanceSkipReasons;
};

export type CompletionCorrectionMarkProbe = {
  getCorrectionMarks(): unknown[];
};

export type CompletionCorrectionTransactionProbe = {
  triggerCorrectionTransaction(): Promise<void> | void;
};
