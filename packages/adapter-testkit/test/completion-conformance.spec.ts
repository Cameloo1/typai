import {
  COMPLETION_CONFORMANCE_FIXTURES,
  type CompletionConformanceDriver,
  type CompletionCorrectionMarkProbe,
  type CompletionCorrectionTransactionProbe,
  runCompletionConformanceSuite,
  waitForCompletionCondition,
} from "../src/index";

runCompletionConformanceSuite(() => new MemoryCompletionDriver(), {
  suiteName: "@typai/adapter-testkit completion self conformance",
  capabilities: {
    exactRevert: true,
    selectionChangeDismiss: true,
    compositionDismiss: true,
    staleResponseDrop: true,
    providerError: true,
    blueCorrectionMarkCheck: true,
    correctionTransactionDismiss: true,
    metricsPrivacy: true,
  },
});

type CompletionMetric = {
  type: string;
  contextBeforeLength?: number;
  completionLength?: number;
  reason?: string;
};

type CompletionTransaction = {
  id: string;
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
  insertedText: string;
};

class MemoryCompletionDriver
  implements
    CompletionConformanceDriver,
    CompletionCorrectionMarkProbe,
    CompletionCorrectionTransactionProbe
{
  name = "memory-completion";

  private text = "";
  private ghostText: string | null = null;
  private ghostOffset = 0;
  private requestId = 0;
  private activeRequestId = 0;
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly transactions: CompletionTransaction[] = [];
  private readonly metrics: CompletionMetric[] = [];

  setup(): void {}

  teardown(): void {
    this.clearTimer();
  }

  reset(value = ""): void {
    this.clearTimer();
    this.text = value;
    this.ghostText = null;
    this.ghostOffset = value.length;
    this.requestId = 0;
    this.activeRequestId = 0;
    this.transactions.splice(0, this.transactions.length);
    this.metrics.splice(0, this.metrics.length);
  }

  typeText(text: string): void {
    this.dismissGhost("typing");
    this.text += text;
    this.scheduleCompletion();
  }

  getText(): string {
    return this.text;
  }

  getGhostText(): string | null {
    return this.ghostText;
  }

  isGhostVisible(): boolean {
    return this.ghostText !== null;
  }

  async waitForGhostText(expected = COMPLETION_CONFORMANCE_FIXTURES.ghostText): Promise<void> {
    await waitForCompletionCondition(
      () => this.ghostText === expected,
      `${this.name} did not show expected ghost text.`,
    );
  }

  pressTab(): void {
    if (this.ghostText === null) {
      return;
    }

    const insertedText = this.ghostText;
    const rangeBefore = {
      start: this.ghostOffset,
      end: this.ghostOffset,
      text: "",
    };
    const rangeAfter = {
      start: this.ghostOffset,
      end: this.ghostOffset + insertedText.length,
      text: insertedText,
    };

    this.text = `${this.text.slice(0, this.ghostOffset)}${insertedText}${this.text.slice(
      this.ghostOffset,
    )}`;
    this.ghostText = null;
    this.transactions.push({
      id: `completion-${this.transactions.length + 1}`,
      rangeBefore,
      rangeAfter,
      insertedText,
    });
    this.metrics.push({
      type: "ghost_accepted",
      completionLength: insertedText.length,
    });
  }

  pressEscape(): void {
    this.dismissGhost("escape");
  }

  changeSelection(): void {
    this.dismissGhost("selection_change");
  }

  startComposition(): void {
    this.dismissGhost("composition");
  }

  revertLastCompletion(): void {
    const transaction = this.transactions.at(-1);

    if (transaction === undefined) {
      return;
    }

    if (
      this.text.slice(transaction.rangeAfter.start, transaction.rangeAfter.end) !==
      transaction.insertedText
    ) {
      return;
    }

    this.text =
      this.text.slice(0, transaction.rangeAfter.start) +
      this.text.slice(transaction.rangeAfter.end);
    this.metrics.push({ type: "completion_reverted" });
  }

  getCompletionTransactions(): unknown[] {
    return this.transactions.map((transaction) => ({ ...transaction }));
  }

  getCompletionMetrics(): unknown[] {
    return this.metrics.map((event) => ({ ...event }));
  }

  getCorrectionMarks(): unknown[] {
    return [];
  }

  triggerCorrectionTransaction(): void {
    this.dismissGhost("correction_transaction");
    this.text += " the ";
  }

  private scheduleCompletion(): void {
    this.clearTimer();
    const nextRequestId = this.requestId + 1;

    this.requestId = nextRequestId;
    this.activeRequestId = nextRequestId;
    this.metrics.push({
      type: "request_scheduled",
      contextBeforeLength: this.text.length,
    });

    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = null;
      this.resolveCompletion(nextRequestId, this.text);
    }, 0);
  }

  private resolveCompletion(requestId: number, contextBefore: string): void {
    if (contextBefore.includes(COMPLETION_CONFORMANCE_FIXTURES.providerErrorText)) {
      if (requestId === this.activeRequestId) {
        this.metrics.push({ type: "provider_error", reason: "provider_error" });
      }

      return;
    }

    if (
      contextBefore.includes(COMPLETION_CONFORMANCE_FIXTURES.stalePromptText) &&
      !contextBefore.includes(COMPLETION_CONFORMANCE_FIXTURES.stalePromptUpdateText)
    ) {
      setTimeout(() => {
        this.showOrDropCompletion(
          requestId,
          COMPLETION_CONFORMANCE_FIXTURES.staleGhostText,
          contextBefore,
        );
      }, 25);
      return;
    }

    this.showOrDropCompletion(requestId, COMPLETION_CONFORMANCE_FIXTURES.ghostText, contextBefore);
  }

  private showOrDropCompletion(requestId: number, text: string, contextBefore: string): void {
    if (requestId !== this.activeRequestId) {
      this.metrics.push({
        type: "stale_response_dropped",
        completionLength: text.length,
      });
      return;
    }

    this.ghostText = text;
    this.ghostOffset = contextBefore.length;
    this.metrics.push({
      type: "ghost_shown",
      contextBeforeLength: contextBefore.length,
      completionLength: text.length,
    });
  }

  private dismissGhost(reason: string): void {
    if (this.ghostText === null) {
      return;
    }

    this.ghostText = null;
    this.metrics.push({ type: "ghost_dismissed", reason });
  }

  private clearTimer(): void {
    if (this.scheduledTimer === null) {
      return;
    }

    clearTimeout(this.scheduledTimer);
    this.scheduledTimer = null;
  }
}
