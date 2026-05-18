// @vitest-environment jsdom

import {
  type AdapterConformanceDriver,
  type AdapterCorrectionTransaction,
  type AdapterMark,
  createConformanceTypaiCore,
  runAdapterConformanceSuite,
} from "@typai/adapter-testkit/src";
import type { TypaiPopover } from "@typai/contenteditable";
import type {
  DetachTextarea,
  TextareaCorrectionEvent,
  TextareaDecisionEvent,
  TextareaMarkEvent,
  TextareaMarkRemovedEvent,
} from "@typai/textarea";
import { act, type ReactElement, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type TypaiContenteditableHookResult,
  type TypaiTextareaHookResult,
  useTypaiContenteditable,
  useTypaiTextarea,
} from "../src";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

runAdapterConformanceSuite(() => new ReactTextareaConformanceDriver(), {
  suiteName: "@typai/react textarea conformance",
  kind: "react-textarea",
  capabilities: {
    compositionGuard: true,
    staleWriteSimulation: true,
    plainSourceText: true,
    completionSurfaceCheck: true,
  },
  skipReasons: {
    redSuggestionApply:
      "React textarea conformance uses the normal hook path without overlay popover DOM",
    codeBlockProtection: "React textarea reuses the textarea adapter without Markdown context",
  },
});

runAdapterConformanceSuite(() => new ReactContenteditableConformanceDriver(), {
  suiteName: "@typai/react contenteditable conformance",
  kind: "react-contenteditable",
  capabilities: {
    redSuggestionApply: true,
    compositionGuard: true,
    staleWriteSimulation: true,
    completionSurfaceCheck: true,
  },
  skipReasons: {
    plainSourceText:
      "React contenteditable source is an HTMLElement text surface, not a textarea value",
    codeBlockProtection:
      "React contenteditable reuses the contenteditable adapter without Markdown context",
  },
});

class ReactTextareaConformanceDriver implements AdapterConformanceDriver {
  name = "@typai/react textarea";
  readonly typai = createConformanceTypaiCore();
  private container: HTMLDivElement | null = null;
  private root: Root | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private adapter: DetachTextarea | null = null;
  private onDecision: ((event: TextareaDecisionEvent) => void) | null = null;
  private readonly marks: AdapterMark[] = [];
  private readonly transactions: AdapterCorrectionTransaction[] = [];

  setup(): void {
    this.container = document.createElement("div");
    document.body.appendChild(this.container);
    this.root = createRoot(this.container);
  }

  teardown(): void {
    if (this.root !== null) {
      act(() => this.root?.unmount());
    }

    this.root = null;
    this.container?.remove();
    this.container = null;
    this.textarea = null;
    this.adapter = null;
  }

  async reset(value = ""): Promise<void> {
    if (this.root === null) {
      throw new Error("React textarea driver setup() was not called.");
    }

    this.textarea = null;
    this.adapter = null;
    this.onDecision = null;
    this.marks.splice(0, this.marks.length);
    this.transactions.splice(0, this.transactions.length);
    this.typai.resetCalls();

    await act(async () => {
      this.root?.render(<ReactTextareaHarness driver={this} initialValue={value} />);
    });
    await flushReact();

    if (this.textarea !== null) {
      this.textarea.selectionStart = value.length;
      this.textarea.selectionEnd = value.length;
    }
  }

  async typeText(text: string): Promise<void> {
    const textarea = this.requireTextarea();

    await act(async () => {
      textarea.value += text;
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
      textarea.dispatchEvent(inputEvent(text.at(-1) ?? ""));
    });
    await flushReact();
  }

  getText(): string {
    return this.requireTextarea().value;
  }

  getMarks(): AdapterMark[] {
    return [...this.marks];
  }

  getTransactions(): AdapterCorrectionTransaction[] {
    return [...this.transactions];
  }

  revertFirstBlueMark(): void {
    const transaction = this.transactions[0];
    const result =
      transaction === undefined
        ? undefined
        : this.adapter?.revertTextareaCorrection(transaction.id);

    if (result?.applied !== true) {
      throw new Error(`Expected React textarea revert to apply, got ${result?.reason}.`);
    }
  }

  async chooseFirstRedSuggestion(): Promise<void> {
    const trigger = document.querySelector<HTMLButtonElement>(
      "[data-testid='textarea-red-mark-trigger']",
    );

    if (trigger === null) {
      throw new Error("Expected React textarea red mark trigger.");
    }

    await act(async () => trigger.click());
    await flushReact();

    const suggestion = document.querySelector<HTMLButtonElement>(
      "[data-testid='textarea-suggestion-item']",
    );

    if (suggestion === null) {
      throw new Error("Expected React textarea suggestion action.");
    }

    await act(async () => suggestion.click());
    await flushReact();
  }

  setComposition(active: boolean): void {
    this.requireTextarea().dispatchEvent(new Event(active ? "compositionstart" : "compositionend"));
  }

  async simulateStaleWrite(): Promise<void> {
    let nestedInputDispatched = false;

    this.onDecision = () => {
      if (nestedInputDispatched) {
        return;
      }

      const textarea = this.requireTextarea();

      nestedInputDispatched = true;
      textarea.value = "teh x";
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
      textarea.dispatchEvent(inputEvent("x"));
      textarea.value = "teh ";
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
    };

    await this.typeText("teh ");
    this.onDecision = null;
  }

  hasGhostTextCompletion(): boolean {
    return document.querySelector(".typai-ghost-text,.typai-ghostText") !== null;
  }

  hasRemoteCompletionPath(): boolean {
    return false;
  }

  setHarness(node: HTMLTextAreaElement | null, hook: TypaiTextareaHookResult): void {
    this.textarea = node;
    this.adapter = hook.adapter;
  }

  handleDecision(event: TextareaDecisionEvent): void {
    this.onDecision?.(event);
  }

  handleCorrection(event: TextareaCorrectionEvent): void {
    this.transactions.push(event.transaction);
  }

  handleMark(event: TextareaMarkEvent): void {
    this.marks.push(event.mark);
  }

  handleMarkRemoved(event: TextareaMarkRemovedEvent): void {
    const index = this.marks.findIndex((mark) => mark.id === event.mark.id);

    if (index >= 0) {
      this.marks.splice(index, 1);
    }
  }

  private requireTextarea(): HTMLTextAreaElement {
    if (this.textarea === null) {
      throw new Error("Expected React textarea node.");
    }

    return this.textarea;
  }
}

class ReactContenteditableConformanceDriver implements AdapterConformanceDriver {
  name = "@typai/react contenteditable";
  readonly typai = createConformanceTypaiCore();
  private container: HTMLDivElement | null = null;
  private root: Root | null = null;
  private element: HTMLElement | null = null;
  private onDecision: (() => void) | null = null;
  private readonly marks: AdapterMark[] = [];
  private readonly transactions: AdapterCorrectionTransaction[] = [];
  private readonly popovers: Array<TypaiPopover | null> = [];

  setup(): void {
    this.container = document.createElement("div");
    document.body.appendChild(this.container);
    this.root = createRoot(this.container);
  }

  teardown(): void {
    if (this.root !== null) {
      act(() => this.root?.unmount());
    }

    this.root = null;
    this.container?.remove();
    this.container = null;
    this.element = null;
  }

  async reset(value = ""): Promise<void> {
    if (this.root === null) {
      throw new Error("React contenteditable driver setup() was not called.");
    }

    this.element = null;
    this.onDecision = null;
    this.marks.splice(0, this.marks.length);
    this.transactions.splice(0, this.transactions.length);
    this.popovers.splice(0, this.popovers.length);
    this.typai.resetCalls();

    await act(async () => {
      this.root?.render(<ReactContenteditableHarness driver={this} initialValue={value} />);
    });
    await flushReact();
  }

  async typeText(text: string): Promise<void> {
    const element = this.requireElement();

    await act(async () => {
      element.textContent = `${element.textContent ?? ""}${text}`;
      element.dispatchEvent(inputEvent(text.at(-1) ?? ""));
    });
    await flushReact();
  }

  getText(): string {
    return this.requireElement().textContent ?? "";
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
      throw new Error("Expected React contenteditable blue correction popover.");
    }

    await popover.actions.revert();
  }

  async chooseFirstRedSuggestion(): Promise<void> {
    this.openRedMark();

    const popover = this.popovers.at(-1);
    const suggestion = popover?.kind === "red_spelling" ? popover.suggestions[0] : undefined;

    if (popover?.kind !== "red_spelling" || suggestion === undefined) {
      throw new Error("Expected React contenteditable red spelling suggestion.");
    }

    await popover.actions.applySuggestion(suggestion);
  }

  setComposition(active: boolean): void {
    this.requireElement().dispatchEvent(new Event(active ? "compositionstart" : "compositionend"));
  }

  async simulateStaleWrite(): Promise<void> {
    this.onDecision = () => {
      const element = this.requireElement();

      element.textContent = "teh changed ";
      element.dispatchEvent(inputEvent("x"));
    };

    await this.typeText("teh ");
    this.onDecision = null;
  }

  hasGhostTextCompletion(): boolean {
    return document.querySelector(".typai-ghost-text,.typai-ghostText") !== null;
  }

  hasRemoteCompletionPath(): boolean {
    return false;
  }

  setHarness(node: HTMLElement | null, _hook: TypaiContenteditableHookResult): void {
    this.element = node;
  }

  handleDecision(): void {
    this.onDecision?.();
  }

  handleCorrection(transaction: AdapterCorrectionTransaction): void {
    this.transactions.push(transaction);
  }

  handleMark(mark: AdapterMark): void {
    this.marks.push(mark);
  }

  handleMarkRemoved(removedMark: AdapterMark): void {
    const index = this.marks.findIndex((mark) => mark.id === removedMark.id);

    if (index >= 0) {
      this.marks.splice(index, 1);
    }
  }

  handlePopover(popover: TypaiPopover | null): void {
    this.popovers.push(popover);
  }

  private clickMark(mark: AdapterMark | undefined): void {
    if (mark === undefined) {
      throw new Error("Expected React contenteditable mark to open.");
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

    this.requireElement().dispatchEvent(event);
  }

  private requireElement(): HTMLElement {
    if (this.element === null) {
      throw new Error("Expected React contenteditable node.");
    }

    return this.element;
  }
}

function ReactTextareaHarness({
  driver,
  initialValue,
}: {
  driver: ReactTextareaConformanceDriver;
  initialValue: string;
}): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hook = useTypaiTextarea({
    typai: driver.typai,
    textareaRef,
    onDecision: (event) => driver.handleDecision(event),
    onCorrection: (event) => driver.handleCorrection(event),
    onMark: (event) => driver.handleMark(event),
    onMarkRemoved: (event) => driver.handleMarkRemoved(event),
  });

  useEffect(() => {
    driver.setHarness(textareaRef.current, hook);
  });

  return <textarea ref={hook.ref} defaultValue={initialValue} aria-label="React textarea" />;
}

function ReactContenteditableHarness({
  driver,
  initialValue,
}: {
  driver: ReactContenteditableConformanceDriver;
  initialValue: string;
}): ReactElement {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hook = useTypaiContenteditable({
    typai: driver.typai,
    elementRef,
    onDecision: () => driver.handleDecision(),
    onCorrection: (transaction) => driver.handleCorrection(transaction),
    onMark: (mark) => driver.handleMark(mark),
    onMarkRemoved: (mark) => driver.handleMarkRemoved(mark),
    onPopover: (popover) => driver.handlePopover(popover),
  });

  useEffect(() => {
    driver.setHarness(elementRef.current, hook);
  });

  return (
    <div ref={hook.ref} contentEditable suppressContentEditableWarning>
      {initialValue}
    </div>
  );
}

async function flushReact(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function inputEvent(data: string): Event {
  const event = new Event("input", { bubbles: true });

  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}
