import {
  type AdapterConformanceDriver,
  type AdapterCorrectionTransaction,
  type AdapterMark,
  createConformanceTypaiCore,
  runAdapterConformanceSuite,
} from "@typai/adapter-testkit/src";

import {
  attachTextarea,
  type TextareaCorrectionEvent,
  type TextareaDecisionEvent,
  type TextareaMarkEvent,
  type TextareaMarkRemovedEvent,
} from "../src/index";

runAdapterConformanceSuite(() => new TextareaConformanceDriver(), {
  suiteName: "@typai/textarea adapter conformance",
  kind: "textarea",
  capabilities: {
    compositionGuard: true,
    staleWriteSimulation: true,
    plainSourceText: true,
    completionSurfaceCheck: true,
  },
  skipReasons: {
    redSuggestionApply:
      "unit conformance driver uses a minimal textarea double without popover DOM",
    codeBlockProtection: "textarea adapter has no Markdown/code-block context model",
  },
});

class TestTextarea extends EventTarget {
  nodeName = "TEXTAREA";
  value = "";
  selectionStart = 0;
  selectionEnd = 0;
  disabled = false;
  readOnly = false;
  form: EventTarget | null = null;

  setSelectionRange(selectionStart: number, selectionEnd: number): void {
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;
  }
}

class TextareaConformanceDriver implements AdapterConformanceDriver {
  name = "@typai/textarea";
  private textarea = new TestTextarea();
  private detach: ReturnType<typeof attachTextarea> | null = null;
  private onDecision: ((event: TextareaDecisionEvent) => void) | null = null;
  private readonly typai = createConformanceTypaiCore();
  private readonly marks: AdapterMark[] = [];
  private readonly transactions: AdapterCorrectionTransaction[] = [];

  setup(): void {}

  teardown(): void {
    this.detach?.();
    this.detach = null;
  }

  reset(value = ""): void {
    this.detach?.();
    this.textarea = new TestTextarea();
    this.textarea.value = value;
    this.textarea.selectionStart = value.length;
    this.textarea.selectionEnd = value.length;
    this.onDecision = null;
    this.marks.splice(0, this.marks.length);
    this.transactions.splice(0, this.transactions.length);
    this.typai.resetCalls();
    this.detach = attachTextarea({
      textarea: this.textarea as unknown as HTMLTextAreaElement,
      typai: this.typai,
      onDecision: (event) => this.onDecision?.(event),
      onCorrection: (event) => this.recordCorrection(event),
      onMark: (event) => this.recordMark(event),
      onMarkRemoved: (event) => this.removeMark(event),
    });
  }

  typeText(text: string): void {
    this.textarea.value += text;
    this.textarea.selectionStart = this.textarea.value.length;
    this.textarea.selectionEnd = this.textarea.value.length;
    this.textarea.dispatchEvent(inputEvent(text.at(-1) ?? ""));
  }

  getText(): string {
    return this.textarea.value;
  }

  getMarks(): AdapterMark[] {
    return [...this.marks];
  }

  getTransactions(): AdapterCorrectionTransaction[] {
    return [...this.transactions];
  }

  revertFirstBlueMark(): void {
    const transaction = this.transactions[0];

    if (transaction === undefined) {
      throw new Error("Expected a correction transaction to revert.");
    }

    const result = this.detach?.revertTextareaCorrection(transaction.id);

    if (result?.applied !== true) {
      throw new Error(`Expected textarea revert to apply, got ${result?.reason ?? "no_result"}.`);
    }
  }

  setComposition(active: boolean): void {
    this.textarea.dispatchEvent(new Event(active ? "compositionstart" : "compositionend"));
  }

  simulateStaleWrite(): void {
    let nestedInputDispatched = false;

    this.onDecision = () => {
      if (nestedInputDispatched) {
        return;
      }

      nestedInputDispatched = true;
      this.textarea.value = "teh x";
      this.textarea.selectionStart = this.textarea.value.length;
      this.textarea.selectionEnd = this.textarea.value.length;
      this.textarea.dispatchEvent(inputEvent("x"));
      this.textarea.value = "teh ";
      this.textarea.selectionStart = this.textarea.value.length;
      this.textarea.selectionEnd = this.textarea.value.length;
    };

    this.typeText("teh ");
    this.onDecision = null;
  }

  hasGhostTextCompletion(): boolean {
    return false;
  }

  hasRemoteCompletionPath(): boolean {
    return false;
  }

  private recordCorrection(event: TextareaCorrectionEvent): void {
    this.transactions.push(event.transaction);
  }

  private recordMark(event: TextareaMarkEvent): void {
    this.marks.push(event.mark);
  }

  private removeMark(event: TextareaMarkRemovedEvent): void {
    const index = this.marks.findIndex((mark) => mark.id === event.mark.id);

    if (index >= 0) {
      this.marks.splice(index, 1);
    }
  }
}

function inputEvent(data: string): Event {
  const event = new Event("input");

  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}
