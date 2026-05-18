import {
  type AdapterConformanceDriver,
  type AdapterCorrectionTransaction,
  type AdapterMark,
  createConformanceTypaiCore,
  runAdapterConformanceSuite,
} from "@typai/adapter-testkit/src";

import { attachContenteditable, type TypaiPopover } from "./index";

runAdapterConformanceSuite(() => new ContenteditableConformanceDriver(), {
  suiteName: "@typai/contenteditable adapter conformance",
  kind: "contenteditable",
  capabilities: {
    compositionGuard: true,
    staleWriteSimulation: true,
  },
});

class TestEditable extends EventTarget {
  textContent: string | null = "";
  ownerDocument = undefined;
  firstChild = null;

  contains(): boolean {
    return false;
  }

  focus(): void {}
}

class ContenteditableConformanceDriver implements AdapterConformanceDriver {
  name = "@typai/contenteditable";
  private element = new TestEditable();
  private detach: ReturnType<typeof attachContenteditable> | null = null;
  private onDecision: (() => void) | null = null;
  private readonly typai = createConformanceTypaiCore();
  private readonly marks: AdapterMark[] = [];
  private readonly transactions: AdapterCorrectionTransaction[] = [];
  private readonly popovers: Array<TypaiPopover | null> = [];

  setup(): void {}

  teardown(): void {
    this.detach?.();
    this.detach = null;
  }

  reset(value = ""): void {
    this.detach?.();
    this.element = new TestEditable();
    this.element.textContent = value;
    this.onDecision = null;
    this.marks.splice(0, this.marks.length);
    this.transactions.splice(0, this.transactions.length);
    this.popovers.splice(0, this.popovers.length);
    this.typai.resetCalls();
    this.detach = attachContenteditable({
      element: this.element as unknown as HTMLElement,
      typai: this.typai,
      onDecision: () => this.onDecision?.(),
      onCorrection: (transaction) => this.transactions.push(transaction),
      onMark: (mark) => this.marks.push(mark),
      onMarkRemoved: (removedMark) => {
        const index = this.marks.findIndex((mark) => mark.id === removedMark.id);

        if (index >= 0) {
          this.marks.splice(index, 1);
        }
      },
      onPopover: (popover) => this.popovers.push(popover),
    });
  }

  typeText(text: string): void {
    this.element.textContent = `${this.element.textContent ?? ""}${text}`;
    this.element.dispatchEvent(inputEvent(text.at(-1) ?? ""));
  }

  pasteText(text: string): void {
    const event = new Event("paste", { cancelable: true });

    Object.defineProperty(event, "clipboardData", {
      value: {
        getData(type: string) {
          return type === "text/plain" ? text : "";
        },
      },
    });

    this.element.dispatchEvent(event);
  }

  getText(): string {
    return this.element.textContent ?? "";
  }

  getMarks(): AdapterMark[] {
    return [...this.marks];
  }

  getTransactions(): AdapterCorrectionTransaction[] {
    return [...this.transactions];
  }

  openBlueMark(index = 0): void {
    const mark = this.marks.filter((candidate) => candidate.kind === "blue_applied_correction")[
      index
    ];

    this.clickMark(mark);
  }

  openRedMark(index = 0): void {
    const mark = this.marks.filter((candidate) => candidate.kind === "red_spelling_issue")[index];

    this.clickMark(mark);
  }

  async revertFirstBlueMark(): Promise<void> {
    this.openBlueMark();

    const popover = this.popovers.at(-1);

    if (popover?.kind !== "blue_correction") {
      throw new Error("Expected a blue correction popover.");
    }

    await popover.actions.revert();
  }

  async chooseFirstRedSuggestion(): Promise<void> {
    this.openRedMark();

    const popover = this.popovers.at(-1);
    const suggestion = popover?.kind === "red_spelling" ? popover.suggestions[0] : undefined;

    if (popover?.kind !== "red_spelling" || suggestion === undefined) {
      throw new Error("Expected a red spelling popover with a suggestion.");
    }

    await popover.actions.applySuggestion(suggestion);
  }

  setComposition(active: boolean): void {
    this.element.dispatchEvent(new Event(active ? "compositionstart" : "compositionend"));
  }

  simulateStaleWrite(): void {
    this.onDecision = () => {
      this.element.textContent = "teh changed ";
      this.element.dispatchEvent(inputEvent("x"));
    };

    this.typeText("teh ");
    this.onDecision = null;
  }

  private clickMark(mark: AdapterMark | undefined): void {
    if (mark === undefined) {
      throw new Error("Expected a mark to open.");
    }

    const event = new Event("click");

    Object.defineProperty(event, "target", {
      value: {
        closest() {
          return {
            getAttribute(name: string) {
              return name === "data-mark-id" ? mark.id : null;
            },
          };
        },
      },
    });

    this.element.dispatchEvent(event);
  }
}

function inputEvent(data: string): Event {
  const event = new Event("input");

  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}
