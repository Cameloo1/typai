import { getTokenBeforeOffset, isProtectedTokenText } from "@typai/core";

import {
  type AdapterConformanceDriver,
  type AdapterCorrectionTransaction,
  type AdapterMark,
  conformanceDecisionForToken,
  createConformanceTypaiCore,
  runAdapterConformanceSuite,
} from "../src/index";

runAdapterConformanceSuite(() => new MemoryAdapterDriver(), {
  suiteName: "@typai/adapter-testkit self conformance",
  kind: "textarea",
  capabilities: {
    redSuggestionApply: true,
    compositionGuard: true,
    staleWriteSimulation: true,
    plainSourceText: true,
    completionSurfaceCheck: true,
  },
  skipReasons: {
    codeBlockProtection: "memory self-test driver has no Markdown/code context model",
  },
});

class MemoryAdapterDriver implements AdapterConformanceDriver {
  name = "memory-adapter";
  private text = "";
  private version = 0;
  private isComposing = false;
  private nextId = 1;
  private readonly marks: AdapterMark[] = [];
  private readonly transactions: AdapterCorrectionTransaction[] = [];
  private readonly typai = createConformanceTypaiCore();

  setup(): void {}

  teardown(): void {}

  reset(value = ""): void {
    this.text = value;
    this.version = 0;
    this.isComposing = false;
    this.nextId = 1;
    this.marks.splice(0, this.marks.length);
    this.transactions.splice(0, this.transactions.length);
    this.typai.resetCalls();
  }

  typeText(text: string): void {
    this.text += text;
    this.version += 1;

    if (this.isComposing) {
      return;
    }

    const delimiter = text.at(-1);

    if (delimiter !== " " && delimiter !== "." && delimiter !== "\n") {
      return;
    }

    const token = getTokenBeforeOffset(this.text, this.text.length);

    if (token === null || token.protected || isProtectedTokenText(token.text)) {
      return;
    }

    const decision = this.typai.checkCompletedToken({ token: token.text });

    if (decision.action === "mark_unresolved") {
      this.marks.push({
        id: this.createId("mark"),
        range: token.range,
        kind: "red_spelling_issue",
        original: decision.original,
        suggestions: decision.suggestions,
      });
      return;
    }

    if (decision.action !== "auto_correct") {
      return;
    }

    const beforeVersion = this.version;
    const beforeText = this.text;
    const rangeAfter = {
      start: token.range.start,
      end: token.range.start + decision.replacement.length,
    };

    if (beforeText.slice(token.range.start, token.range.end) !== token.text) {
      return;
    }

    this.text =
      beforeText.slice(0, token.range.start) +
      decision.replacement +
      beforeText.slice(token.range.end);
    this.version += 1;

    const transaction: AdapterCorrectionTransaction = {
      id: this.createId("correction"),
      documentVersion: this.version,
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
      trigger: "space",
      confidence: decision.confidence,
      reasonCodes: decision.reasonCodes,
      createdAt: Date.now(),
    };

    if (beforeVersion >= this.version) {
      return;
    }

    this.transactions.push(transaction);
    this.marks.push({
      id: this.createId("mark"),
      range: rangeAfter,
      kind: "blue_applied_correction",
      original: decision.original,
      replacement: decision.replacement,
    });
  }

  getText(): string {
    return this.text;
  }

  getMarks(): AdapterMark[] {
    return [...this.marks];
  }

  getTransactions(): AdapterCorrectionTransaction[] {
    return [...this.transactions];
  }

  chooseFirstRedSuggestion(): void {
    const markIndex = this.marks.findIndex((mark) => mark.kind === "red_spelling_issue");
    const mark = this.marks[markIndex];
    const suggestion = mark?.suggestions?.[0];

    if (mark === undefined || suggestion === undefined) {
      return;
    }

    const original = mark.original ?? this.text.slice(mark.range.start, mark.range.end);

    this.text = this.text.slice(0, mark.range.start) + suggestion + this.text.slice(mark.range.end);
    this.version += 1;
    this.marks.splice(markIndex, 1);

    const transaction: AdapterCorrectionTransaction = {
      id: this.createId("correction"),
      documentVersion: this.version,
      rangeBefore: {
        start: mark.range.start,
        end: mark.range.end,
        text: original,
      },
      rangeAfter: {
        start: mark.range.start,
        end: mark.range.start + suggestion.length,
        text: suggestion,
      },
      original,
      replacement: suggestion,
      trigger: "popover",
      confidence: 1,
      reasonCodes: [],
      createdAt: Date.now(),
    };

    this.transactions.push(transaction);
    this.marks.push({
      id: this.createId("mark"),
      range: transaction.rangeAfter,
      kind: "blue_applied_correction",
      original: transaction.original,
      replacement: transaction.replacement,
    });
  }

  revertFirstBlueMark(): void {
    const markIndex = this.marks.findIndex((mark) => mark.kind === "blue_applied_correction");
    const mark = this.marks[markIndex];
    const transaction = this.transactions.find(
      (candidate) =>
        candidate.original === mark?.original && candidate.replacement === mark.replacement,
    );

    if (mark === undefined || transaction === undefined) {
      return;
    }

    this.text =
      this.text.slice(0, mark.range.start) + transaction.original + this.text.slice(mark.range.end);
    this.version += 1;
    this.marks.splice(markIndex, 1);
  }

  setComposition(active: boolean): void {
    this.isComposing = active;
  }

  simulateStaleWrite(): void {
    this.text = "teh ";
    this.version += 1;

    const token = getTokenBeforeOffset(this.text, this.text.length);

    if (token === null) {
      return;
    }

    const snapshotVersion = this.version;
    const decision = conformanceDecisionForToken(token.text);

    this.text = "teh changed ";
    this.version += 1;

    if (
      decision.action !== "auto_correct" ||
      snapshotVersion !== this.version ||
      this.text.slice(token.range.start, token.range.end) !== token.text
    ) {
      return;
    }
  }

  hasGhostTextCompletion(): boolean {
    return false;
  }

  hasRemoteCompletionPath(): boolean {
    return false;
  }

  private createId(prefix: string): string {
    const id = `${prefix}-${this.nextId}`;
    this.nextId += 1;

    return id;
  }
}
