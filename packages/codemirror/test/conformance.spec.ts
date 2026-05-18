// @vitest-environment jsdom

import { markdown } from "@codemirror/lang-markdown";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  type AdapterConformanceDriver,
  type AdapterCorrectionTransaction,
  type AdapterMark,
  createConformanceTypaiCore,
  runAdapterConformanceSuite,
} from "@typai/adapter-testkit/src";
import {
  applyFirstTypaiCodeMirrorRedSuggestion,
  createTypaiCodeMirrorExtension,
  getTypaiCodeMirrorViewMarks,
  getTypaiCodeMirrorViewTransactions,
  revertFirstTypaiCodeMirrorCorrection,
} from "../src";

runAdapterConformanceSuite(() => new CodeMirrorConformanceDriver(), {
  suiteName: "@typai/codemirror adapter conformance",
  kind: "codemirror",
  capabilities: {
    redSuggestionApply: true,
    staleWriteSimulation: true,
    codeBlockProtection: true,
    completionSurfaceCheck: true,
  },
  skipReasons: {
    compositionGuard: "CodeMirror composition state is not directly writable in jsdom tests",
    plainSourceText: "CodeMirror source is the editor document, not a textarea value",
  },
});

class CodeMirrorConformanceDriver implements AdapterConformanceDriver {
  name = "@typai/codemirror";
  private readonly typai = createConformanceTypaiCore();
  private parent: HTMLDivElement | null = null;
  private view: EditorView | null = null;
  private readonly extensions: Extension[] = [markdown()];

  setup(): void {
    this.parent = document.createElement("div");
    document.body.appendChild(this.parent);
  }

  teardown(): void {
    this.view?.destroy();
    this.view = null;
    this.parent?.remove();
    this.parent = null;
  }

  reset(value = ""): void {
    if (this.parent === null) {
      throw new Error("CodeMirror conformance driver setup() was not called.");
    }

    this.view?.destroy();
    this.typai.resetCalls();
    this.view = new EditorView({
      parent: this.parent,
      state: EditorState.create({
        doc: value,
        selection: { anchor: value.length },
        extensions: [
          ...this.extensions,
          createTypaiCodeMirrorExtension({
            typai: this.typai,
          }),
        ],
      }),
    });
  }

  async typeText(text: string): Promise<void> {
    this.typeTextWithoutFlush(text);
    await flushMicrotasks();
  }

  getText(): string {
    return this.requireView().state.doc.toString();
  }

  getMarks(): AdapterMark[] {
    return getTypaiCodeMirrorViewMarks(this.requireView()).map((mark) => ({
      id: mark.id,
      range: {
        start: mark.from,
        end: mark.to,
      },
      kind: mark.kind,
      original: mark.original,
      replacement: mark.replacement,
      suggestions: mark.suggestions,
    }));
  }

  getTransactions(): AdapterCorrectionTransaction[] {
    return getTypaiCodeMirrorViewTransactions(this.requireView()).map((transaction) => ({
      id: transaction.id,
      documentVersion: transaction.documentVersion,
      rangeBefore: {
        start: transaction.rangeBefore.from,
        end: transaction.rangeBefore.to,
        text: transaction.rangeBefore.text,
      },
      rangeAfter: {
        start: transaction.rangeAfter.from,
        end: transaction.rangeAfter.to,
        text: transaction.rangeAfter.text,
      },
      original: transaction.original,
      replacement: transaction.replacement,
      trigger: transaction.trigger,
      confidence: transaction.confidence,
      reasonCodes: transaction.reasonCodes,
      createdAt: transaction.createdAt,
    }));
  }

  revertFirstBlueMark(): void {
    if (!revertFirstTypaiCodeMirrorCorrection(this.requireView())) {
      throw new Error("Expected CodeMirror blue correction revert to apply.");
    }
  }

  chooseFirstRedSuggestion(): void {
    if (!applyFirstTypaiCodeMirrorRedSuggestion(this.requireView())) {
      throw new Error("Expected CodeMirror red suggestion to apply.");
    }
  }

  async simulateStaleWrite(): Promise<void> {
    const view = this.requireView();

    this.typeTextWithoutFlush("teh ");
    view.dispatch({
      changes: { from: 0, to: 3, insert: "zzz" },
      selection: { anchor: 4 },
    });
    await flushMicrotasks();
  }

  hasGhostTextCompletion(): boolean {
    return (
      this.requireView().dom.querySelector(".typai-cm-ghost-text,.typai-cm-ghostText") !== null
    );
  }

  hasRemoteCompletionPath(): boolean {
    return false;
  }

  private typeTextWithoutFlush(text: string): void {
    const view = this.requireView();

    for (const char of text) {
      const head = view.state.selection.main.head;

      view.dispatch({
        changes: { from: head, insert: char },
        selection: { anchor: head + char.length },
        userEvent: "input.type",
      });
    }
  }

  private requireView(): EditorView {
    if (this.view === null) {
      throw new Error("Expected CodeMirror view.");
    }

    return this.view;
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
