// @vitest-environment jsdom

import {
  COMPLETION_CONFORMANCE_FIXTURES,
  type CompletionConformanceDriver,
  type CompletionCorrectionMarkProbe,
  type CompletionCorrectionTransactionProbe,
  createConformanceTypaiCore,
  runCompletionConformanceSuite,
  waitForCompletionCondition,
} from "@typai/adapter-testkit/src";

import {
  createContenteditableCompletionController,
  createMockCompletionProvider,
} from "../../completion-remote/src";
import {
  attachContenteditable,
  type CompletionTransaction,
  type DetachContenteditable,
  plainTextOffsetToDomPosition,
  type VisualMark,
} from "./index";

runCompletionConformanceSuite(() => new ContenteditableCompletionConformanceDriver(), {
  suiteName: "@typai/contenteditable completion conformance",
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

class ContenteditableCompletionConformanceDriver
  implements
    CompletionConformanceDriver,
    CompletionCorrectionMarkProbe,
    CompletionCorrectionTransactionProbe
{
  name = "@typai/contenteditable completion";

  private element: HTMLElement | null = null;
  private detach: DetachContenteditable | null = null;
  private completion: ReturnType<typeof createContenteditableCompletionController> | null = null;
  private disconnectEditor: (() => void) | null = null;
  private readonly marks: VisualMark[] = [];
  private readonly typai = createConformanceTypaiCore();

  setup(): void {}

  teardown(): void {
    this.detachCurrent();
    document.body.innerHTML = "";
    document.getSelection()?.removeAllRanges();
  }

  reset(value = ""): void {
    this.detachCurrent();
    document.body.innerHTML = "";
    document.getSelection()?.removeAllRanges();
    this.marks.splice(0, this.marks.length);
    this.typai.resetCalls();

    const element = document.createElement("div");

    element.contentEditable = "true";
    element.textContent = value;
    document.body.append(element);
    placeDomSelection(element, value.length);

    const completion = createContenteditableCompletionController({
      provider: createMockCompletionProvider(async (request) => {
        const contextBefore = request.contextBefore;

        if (contextBefore.includes(COMPLETION_CONFORMANCE_FIXTURES.providerErrorText)) {
          throw new Error("mock provider failed");
        }

        if (
          contextBefore.includes(COMPLETION_CONFORMANCE_FIXTURES.stalePromptText) &&
          !contextBefore.includes(COMPLETION_CONFORMANCE_FIXTURES.stalePromptUpdateText)
        ) {
          await delay(25);
          return COMPLETION_CONFORMANCE_FIXTURES.staleGhostText;
        }

        return COMPLETION_CONFORMANCE_FIXTURES.ghostText;
      }),
      debounceMs: 0,
      timeoutMs: 100,
      minPrefixChars: 1,
      maxCompletionChars: 100,
      maxMetricEvents: 100,
      mode: "prompt",
    });

    const detach = attachContenteditable({
      element,
      typai: this.typai,
      completion,
      completionMode: "prompt",
      settings: {
        autocorrect: true,
        spellcheck: true,
        keepCorrectionMarksVisible: true,
        usePersonalDictionary: false,
      },
      onMark: (mark) => this.marks.push(mark),
      onMarkRemoved: (removedMark) => {
        const index = this.marks.findIndex((mark) => mark.id === removedMark.id);

        if (index >= 0) {
          this.marks.splice(index, 1);
        }
      },
    });

    this.element = element;
    this.detach = detach;
    this.completion = completion;
    this.disconnectEditor = completion.connectEditor(detach);
  }

  typeText(text: string): void {
    const element = this.requireElement();
    const nextText = `${this.getText()}${text}`;

    element.textContent = nextText;
    placeDomSelection(element, nextText.length);
    element.dispatchEvent(inputEvent(text.at(-1) ?? ""));
  }

  getText(): string {
    return this.detach?.getSnapshot().text ?? "";
  }

  getGhostText(): string | null {
    if (!this.isGhostVisible()) {
      return null;
    }

    return this.detach?.getGhostTextText() ?? null;
  }

  isGhostVisible(): boolean {
    return this.detach?.isGhostTextVisible() ?? false;
  }

  async waitForGhostText(expected = COMPLETION_CONFORMANCE_FIXTURES.ghostText): Promise<void> {
    await waitForCompletionCondition(
      () => this.getGhostText() === expected,
      `${this.name} did not show expected ghost text.`,
    );
  }

  pressTab(): void {
    this.requireElement().dispatchEvent(keyEvent("Tab"));
  }

  pressEscape(): void {
    this.requireElement().dispatchEvent(keyEvent("Escape"));
  }

  changeSelection(): void {
    const element = this.requireElement();

    placeDomSelection(element, 0);
    document.dispatchEvent(new Event("selectionchange"));
  }

  startComposition(): void {
    this.requireElement().dispatchEvent(new Event("compositionstart"));
  }

  blur(): void {
    this.requireElement().dispatchEvent(new Event("blur"));
  }

  pasteText(text: string): void {
    this.requireElement().dispatchEvent(pasteEvent(text));
  }

  revertLastCompletion(): void {
    const transaction = this.getLastCompletionTransaction();

    if (transaction === null) {
      return;
    }

    this.detach?.revertCompletion(transaction.id);
  }

  getCompletionTransactions(): unknown[] {
    return this.detach?.getCompletionTransactions() ?? [];
  }

  getCompletionMetrics(): unknown[] {
    return this.completion?.remote.getMetricsSnapshot().events ?? [];
  }

  getCorrectionMarks(): unknown[] {
    return [...this.marks];
  }

  triggerCorrectionTransaction(): void {
    this.typeText(COMPLETION_CONFORMANCE_FIXTURES.correctionDismissText);
  }

  private detachCurrent(): void {
    this.disconnectEditor?.();
    this.disconnectEditor = null;
    this.detach?.();
    this.detach = null;
    this.completion = null;
    this.element = null;
  }

  private requireElement(): HTMLElement {
    if (this.element === null) {
      throw new Error("Contenteditable completion driver was not reset.");
    }

    return this.element;
  }

  private getLastCompletionTransaction(): CompletionTransaction | null {
    const transactions = this.detach?.getCompletionTransactions() ?? [];

    return transactions.at(-1) ?? null;
  }
}

function inputEvent(data: string): Event {
  const event = new Event("input");

  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}

function keyEvent(key: string): Event {
  const event = new Event("keydown", {
    cancelable: true,
  });

  Object.defineProperty(event, "key", {
    value: key,
  });

  return event;
}

function pasteEvent(plainText: string): Event {
  const event = new Event("paste", { cancelable: true });

  Object.defineProperty(event, "clipboardData", {
    value: {
      getData(type: string) {
        return type === "text/plain" ? plainText : "";
      },
    },
  });

  return event;
}

function placeDomSelection(element: HTMLElement, offset: number): void {
  const ownerDocument = element.ownerDocument;
  let position = plainTextOffsetToDomPosition(element, offset);

  if (position === null) {
    const anchor = ownerDocument.createTextNode("");

    element.append(anchor);
    position = {
      node: anchor,
      offset: 0,
    };
  }

  const range = ownerDocument.createRange();

  range.setStart(position.node, position.offset);
  range.collapse(true);
  ownerDocument.getSelection()?.removeAllRanges();
  ownerDocument.getSelection()?.addRange(range);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
