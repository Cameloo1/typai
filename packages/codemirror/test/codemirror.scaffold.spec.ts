// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { CorrectionDecision, CorrectionRule, TypaiCore } from "@typai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CodeMirrorCompletionController,
  type CodeMirrorCompletionEditor,
  type CodeMirrorCompletionSnapshot,
  type CodeMirrorGhostTextClearReason,
  createTypaiCodeMirrorExtension,
  getTypaiCodeMirrorGhostTextContent,
  getTypaiCodeMirrorMarks,
  getTypaiCodeMirrorRuntimeSettings,
  getTypaiCodeMirrorViewTransactions,
  isTypaiCodeMirrorGhostTextVisible,
  openFirstTypaiCodeMirrorBluePopover,
  openFirstTypaiCodeMirrorRedPopover,
  openTypaiCodeMirrorPopoverForMark,
  renderTypaiCodeMirrorGhostText,
  revertFirstTypaiCodeMirrorCorrection,
  typaiCodeMirrorBlueCorrectedClass,
  typaiCodeMirrorGhostTextClass,
  typaiCodeMirrorRedSpellingClass,
} from "../src";

const views: EditorView[] = [];

let typai: TypaiCore;

beforeEach(async () => {
  typai = createFakeTypaiCore();
});

afterEach(() => {
  for (const view of views.splice(0, views.length)) {
    view.destroy();
  }

  document.body.replaceChildren();
});

describe("@typai/codemirror scaffold", () => {
  it("creates a CodeMirror extension", () => {
    const extension = createTypaiCodeMirrorExtension({ typai });

    expect(extension).toBeDefined();
  });

  it("initializes an editor with the extension", () => {
    const view = createEditor();

    expect(view.state.doc.toString()).toBe("");
  });

  it("typing an unresolved token creates a red decoration", async () => {
    const onMark = vi.fn();
    const view = createEditor({ onMark });

    await typeText(view, "zzzzword ");

    expect(view.state.doc.toString()).toBe("zzzzword ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        from: 0,
        to: 8,
        kind: "red_spelling_issue",
        original: "zzzzword",
      }),
    ]);
    expect(view.dom.querySelector(`.${typaiCodeMirrorRedSpellingClass}`)?.textContent).toBe(
      "zzzzword",
    );
    expect(onMark).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "red_spelling_issue",
        original: "zzzzword",
      }),
    );
  });

  it("does not mark valid words", async () => {
    const view = createEditor();

    await typeText(view, "form ");

    expect(view.state.doc.toString()).toBe("form ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(view.dom.querySelector(`.${typaiCodeMirrorRedSpellingClass}`)).toBeNull();
    expect(view.dom.querySelector(`.${typaiCodeMirrorBlueCorrectedClass}`)).toBeNull();
  });

  it("autocorrects common typos with a blue decoration", async () => {
    const onCorrection = vi.fn();
    const onMark = vi.fn();
    const view = createEditor({ onCorrection, onMark });

    await typeText(view, "teh ");

    expect(view.state.doc.toString()).toBe("the ");
    expect(view.state.selection.main.head).toBe(4);
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        from: 0,
        to: 3,
        kind: "blue_applied_correction",
        original: "teh",
        replacement: "the",
      }),
    ]);
    expect(view.dom.querySelector(`.${typaiCodeMirrorBlueCorrectedClass}`)?.textContent).toBe(
      "the",
    );
    expect(onCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        applied: true,
        reason: "applied",
        transaction: expect.objectContaining({
          original: "teh",
          replacement: "the",
        }),
      }),
    );
    expect(onMark).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "blue_applied_correction",
        original: "teh",
        replacement: "the",
      }),
    );
  });

  it("records CodeMirror correction transactions", async () => {
    const view = createEditor();

    await typeText(view, "teh ");

    expect(getTypaiCodeMirrorViewTransactions(view)).toEqual([
      expect.objectContaining({
        original: "teh",
        replacement: "the",
        trigger: "space",
        rangeBefore: {
          from: 0,
          to: 3,
          text: "teh",
        },
        rangeAfter: {
          from: 0,
          to: 3,
          text: "the",
        },
      }),
    ]);
  });

  it("reverts the first blue correction exactly", async () => {
    const view = createEditor();

    await typeText(view, "teh ");

    expect(revertFirstTypaiCodeMirrorCorrection(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("teh ");
    expect(view.state.selection.main.head).toBe(3);
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("opens a blue popover from a blue mark command", async () => {
    const view = createEditor();

    await typeText(view, "teh ");

    expect(openFirstTypaiCodeMirrorBluePopover(view)).toBe(true);

    const popover = getPopover("codemirror-blue-popover");

    expect(popover).not.toBeNull();
    expect(popover?.getAttribute("role")).toBe("dialog");
    expect(popover?.textContent).toContain('Corrected "teh" -> "the".');
    expect(getPopoverAction(popover, "revert")).toBe(document.activeElement);
  });

  it("opens a blue popover from keyboard focus on a mark", async () => {
    const view = createEditor();

    await typeText(view, "teh ");

    const markElement = view.dom.querySelector<HTMLElement>(
      `.${typaiCodeMirrorBlueCorrectedClass}`,
    );

    expect(markElement).not.toBeNull();
    markElement?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
    );

    expect(getPopover("codemirror-blue-popover")).not.toBeNull();
  });

  it("reverts exactly from the blue popover", async () => {
    const view = createEditor();

    await typeText(view, "teh ");
    openFirstTypaiCodeMirrorBluePopover(view);
    clickPopoverAction("codemirror-blue-popover", "revert");
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe("teh ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(getPopover("codemirror-blue-popover")).toBeNull();
  });

  it("writes an always-correct rule from the blue popover", async () => {
    const view = createEditor();

    await typeText(view, "teh ");
    openFirstTypaiCodeMirrorBluePopover(view);
    clickPopoverAction("codemirror-blue-popover", "always-correct");
    await flushMicrotasks();

    expect(typai.getCorrectionRule("teh", "the")).toMatchObject({
      original: "teh",
      replacement: "the",
      status: "always",
    });

    const nextView = createEditor();

    await typeText(nextView, "teh ");

    expect(nextView.state.doc.toString()).toBe("the ");
  });

  it("writes a never-correct rule and suppresses future autocorrect", async () => {
    const view = createEditor();

    await typeText(view, "teh ");
    openFirstTypaiCodeMirrorBluePopover(view);
    clickPopoverAction("codemirror-blue-popover", "never-correct");
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe("teh ");
    expect(typai.getCorrectionRule("teh", "the")).toMatchObject({
      original: "teh",
      replacement: "the",
      status: "never",
    });

    const nextView = createEditor();

    await typeText(nextView, "teh ");

    expect(nextView.state.doc.toString()).toBe("teh ");
    expect(getTypaiCodeMirrorMarks(nextView.state)).toEqual([]);
  });

  it("adds the original to the dictionary from the blue popover and reverts", async () => {
    const view = createEditor();

    await typeText(view, "teh ");
    openFirstTypaiCodeMirrorBluePopover(view);
    clickPopoverAction("codemirror-blue-popover", "add-original-to-dictionary");
    await flushMicrotasks();

    expect(typai.isInPersonalDictionary("teh")).toBe(true);
    expect(view.state.doc.toString()).toBe("teh ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("does not mark protected email tokens", async () => {
    const view = createEditor();

    await typeText(view, "user@example.com ");

    expect(view.state.doc.toString()).toBe("user@example.com ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("does not mark inline Markdown code", async () => {
    const onDecision = vi.fn();
    const view = createEditor({ extensions: [markdown()], onDecision });

    await typeText(view, "`zzzzword` ");

    expect(view.state.doc.toString()).toBe("`zzzzword` ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("does not mark fenced Markdown code blocks", async () => {
    const onCorrection = vi.fn();
    const onDecision = vi.fn();
    const view = createEditor({ extensions: [markdown()], onCorrection, onDecision });

    await typeText(view, "```ts\nzzzzword ");

    expect(view.state.doc.toString()).toBe("```ts\nzzzzword ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onDecision).not.toHaveBeenCalled();
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it("does not autocorrect fenced Markdown code blocks", async () => {
    const onCorrection = vi.fn();
    const view = createEditor({ extensions: [markdown()], onCorrection });

    await typeText(view, "```ts\nteh ");

    expect(view.state.doc.toString()).toBe("```ts\nteh ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it("does not autocorrect inline Markdown code", async () => {
    const onCorrection = vi.fn();
    const view = createEditor({ extensions: [markdown()], onCorrection });

    await typeText(view, "`teh` ");

    expect(view.state.doc.toString()).toBe("`teh` ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it("does not mark Markdown link destinations", async () => {
    const onDecision = vi.fn();
    const view = createEditor({ extensions: [markdown()], onDecision });

    await typeText(view, "[site](");
    onDecision.mockClear();
    await typeText(view, "zzzzword ");

    expect(view.state.doc.toString()).toBe("[site](zzzzword ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("does not mark URL scheme prefixes while a URL is being typed", async () => {
    const view = createEditor();

    await typeText(view, "https://example.com ");

    expect(view.state.doc.toString()).toBe("https://example.com ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("marks normal Markdown prose and preserves suggestions", async () => {
    const view = createEditor({ extensions: [markdown()] });

    await typeText(view, "Please keep reciept ");

    expect(view.state.doc.toString()).toBe("Please keep reciept ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        from: 12,
        to: 19,
        kind: "red_spelling_issue",
        original: "reciept",
        suggestions: ["receipt"],
      }),
    ]);
  });

  it("does not autocorrect edit-distance suggestions", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");

    expect(view.state.doc.toString()).toBe("reciept ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        kind: "red_spelling_issue",
        original: "reciept",
        suggestions: ["receipt"],
      }),
    ]);
    expect(view.dom.querySelector(`.${typaiCodeMirrorBlueCorrectedClass}`)).toBeNull();
  });

  it("opens a red popover for edit-distance suggestions", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");

    expect(openFirstTypaiCodeMirrorRedPopover(view)).toBe(true);

    const popover = getPopover("codemirror-red-popover");

    expect(popover).not.toBeNull();
    expect(popover?.getAttribute("role")).toBe("dialog");
    expect(popover?.textContent).toContain('Possible spelling issue: "reciept".');
    expect(getPopoverAction(popover, "choose-suggestion")?.textContent).toBe("receipt");
  });

  it("applies a red suggestion with keyboard activation and creates a blue mark", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");
    openFirstTypaiCodeMirrorRedPopover(view);

    const suggestion = getRequiredPopoverAction("codemirror-red-popover", "choose-suggestion");

    suggestion.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
    );
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe("receipt ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        kind: "blue_applied_correction",
        original: "reciept",
        replacement: "receipt",
      }),
    ]);
    expect(getTypaiCodeMirrorViewTransactions(view)).toEqual([
      expect.objectContaining({
        original: "reciept",
        replacement: "receipt",
        trigger: "popover",
      }),
    ]);
  });

  it("ignores one red mark without changing text", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");
    openFirstTypaiCodeMirrorRedPopover(view);
    clickPopoverAction("codemirror-red-popover", "ignore-once");
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe("reciept ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("adds a red spelling issue to the dictionary and suppresses future red marks", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");
    openFirstTypaiCodeMirrorRedPopover(view);
    clickPopoverAction("codemirror-red-popover", "add-to-dictionary");
    await flushMicrotasks();

    expect(typai.isInPersonalDictionary("reciept")).toBe(true);
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);

    const nextView = createEditor();

    await typeText(nextView, "reciept ");

    expect(nextView.state.doc.toString()).toBe("reciept ");
    expect(getTypaiCodeMirrorMarks(nextView.state)).toEqual([]);
  });

  it("disables autocorrect while leaving spellcheck behavior available", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");
    openFirstTypaiCodeMirrorRedPopover(view);
    clickPopoverAction("codemirror-red-popover", "disable-autocorrect");
    await flushMicrotasks();

    expect(getTypaiCodeMirrorRuntimeSettings(view.state)).toMatchObject({
      autocorrect: false,
    });

    await typeText(view, "teh ");

    expect(view.state.doc.toString()).toBe("reciept teh ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "red_spelling_issue",
          original: "teh",
          suggestions: ["the"],
        }),
      ]),
    );
  });

  it("prevents stale popover action mutations", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");
    openFirstTypaiCodeMirrorRedPopover(view);

    const suggestion = getRequiredPopoverAction("codemirror-red-popover", "choose-suggestion");

    view.dispatch({
      changes: { from: 0, to: 7, insert: "changed" },
      selection: { anchor: 7 },
    });
    suggestion.click();
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe("changed ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("closes popovers with Escape", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");
    openFirstTypaiCodeMirrorRedPopover(view);

    const popover = getRequiredPopover("codemirror-red-popover");

    popover.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }),
    );

    expect(getPopover("codemirror-red-popover")).toBeNull();
  });

  it("does not open a popover for stale or missing mark ids", async () => {
    const view = createEditor();

    await typeText(view, "reciept ");

    expect(openTypaiCodeMirrorPopoverForMark(view, "missing")).toBe(false);
    expect(getPopover("codemirror-red-popover")).toBeNull();
  });

  it("does not mark shell-like command lines", async () => {
    const onDecision = vi.fn();
    const view = createEditor({ extensions: [markdown()], onDecision });

    await typeText(view, "npm install zzzzword ");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("does not mark protected CVE tokens", async () => {
    const view = createEditor({ extensions: [markdown()] });

    await typeText(view, "CVE-2024-1234 ");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("does not mark snake_case identifiers", async () => {
    const view = createEditor({ extensions: [markdown()] });

    await typeText(view, "snake_case_identifier ");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("does not mark camelCase code-like identifiers", async () => {
    const view = createEditor({ extensions: [markdown()] });

    await typeText(view, "camelCaseIdentifier ");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("falls back to Markdown heuristics without a Markdown language extension", async () => {
    const onDecision = vi.fn();
    const view = createEditor({ onDecision });

    await typeText(view, "```\nzzzzword ");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("keeps the decoration range over the completed token", async () => {
    const view = createEditor();

    await typeText(view, "hello zzzzword ");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        from: 6,
        to: 14,
        original: "zzzzword",
      }),
    ]);
  });

  it("maps decorations through outside document changes and clears invalid ranges", async () => {
    const view = createEditor();

    await typeText(view, "zzzzword ");
    view.dispatch({
      changes: { from: 0, insert: "A " },
      selection: { anchor: 2 },
    });

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([
      expect.objectContaining({
        from: 2,
        to: 10,
        original: "zzzzword",
      }),
    ]);

    view.dispatch({
      changes: { from: 2, to: 3, insert: "x" },
      selection: { anchor: 3 },
    });

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
  });

  it("prevents stale queued corrections", async () => {
    const onCorrection = vi.fn();
    const view = createEditor({ onCorrection });

    typeTextWithoutFlush(view, "teh ");
    view.dispatch({
      changes: { from: 0, to: 3, insert: "zzz" },
      selection: { anchor: 4 },
    });
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe("zzz ");
    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(view.dom.querySelector(`.${typaiCodeMirrorBlueCorrectedClass}`)).toBeNull();
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it("applies corrections through CodeMirror transactions", async () => {
    const typaiCorrectionDocs: string[] = [];
    const view = createEditor({
      extensions: [
        EditorView.updateListener.of((update) => {
          if (
            update.transactions.some((transaction) =>
              transaction.isUserEvent("input.typai.correct"),
            )
          ) {
            typaiCorrectionDocs.push(update.state.doc.toString());
          }
        }),
      ],
    });

    await typeText(view, "teh ");

    expect(typaiCorrectionDocs).toEqual(["the "]);
  });

  it("renders completion ghost text through a CodeMirror decoration widget", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");

    expect(getGhostElement(view)?.textContent).toBe(" there");
    expect(getGhostElement(view)?.getAttribute("aria-hidden")).toBe("true");
    expect(isTypaiCodeMirrorGhostTextVisible(view)).toBe(true);
    expect(getTypaiCodeMirrorGhostTextContent(view)).toBe(" there");
  });

  it("does not include ghost text in the CodeMirror document before accept", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");

    expect(getGhostElement(view)?.textContent).toBe(" there");
    expect(view.state.doc.toString()).toBe("Hello");
  });

  it("dismisses CodeMirror ghost text with Escape", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }),
    );
    await flushMicrotasks();

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("escape");
    expect(view.state.doc.toString()).toBe("Hello");
  });

  it("dismisses CodeMirror ghost text on further typing without accepting it", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    completion.renderOnInput = false;
    await typeText(view, "!");

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("typing");
    expect(view.state.doc.toString()).toBe("Hello!");
  });

  it("dismisses CodeMirror ghost text on selection change", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    view.dispatch({ selection: { anchor: 0 } });
    await flushMicrotasks();

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("selection_change");
  });

  it("dismisses CodeMirror ghost text on compositionstart", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    view.contentDOM.dispatchEvent(new Event("compositionstart", { bubbles: true }));
    await flushMicrotasks();

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("composition");
    expect(completion.compositionStarts).toBe(1);
  });

  it("dismisses CodeMirror ghost text on blur and paste", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    view.contentDOM.dispatchEvent(new Event("blur", { bubbles: true }));
    await flushMicrotasks();

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("blur");
    expect(completion.blurs).toBe(1);

    completion.editor?.renderGhostTextAtCaret(" again", completion.editor.getSnapshot());
    expect(getGhostElement(view)?.textContent).toBe(" again");

    view.contentDOM.dispatchEvent(new Event("paste", { bubbles: true }));
    await flushMicrotasks();

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("paste");
  });

  it("drops stale CodeMirror ghost responses", async () => {
    const completion = createMockCompletionController({
      ghostText: " stale",
      renderOnInput: false,
    });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    const staleSnapshot = completion.editor?.getSnapshot();
    await typeText(view, "!");

    expect(
      staleSnapshot === undefined
        ? false
        : completion.editor?.renderGhostTextAtCaret(" stale", staleSnapshot),
    ).toBe(false);
    expect(getGhostElement(view)).toBeNull();
    expect(view.state.doc.toString()).toBe("Hello!");
  });

  it("dismisses CodeMirror ghost text on correction transactions", async () => {
    const completion = createMockCompletionController({
      ghostText: " there",
      renderOnInput: false,
    });
    const view = createEditor({ completion });

    await typeText(view, "Hello");
    const snapshot = completion.editor?.getSnapshot();

    expect(snapshot).toBeDefined();
    expect(renderTypaiCodeMirrorGhostText(view, " there", snapshot)).toBe(true);
    expect(getGhostElement(view)?.textContent).toBe(" there");

    view.dispatch({
      changes: { from: 0, to: 5, insert: "Hi" },
      selection: { anchor: 2 },
      userEvent: "input.typai.correct",
    });
    await flushMicrotasks();

    expect(getGhostElement(view)).toBeNull();
    expect(completion.dismissReasons).toContain("correction_transaction");
    expect(completion.correctionTransactions).toBe(1);
  });

  it("suppresses CodeMirror completion in protected code contexts", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({
      doc: "```ts\n",
      extensions: [markdown()],
      completion,
    });

    await typeText(view, "const value = 1");

    expect(getGhostElement(view)).toBeNull();
    expect(completion.inputSnapshots).toEqual([]);
  });

  it("does not create blue correction marks for CodeMirror ghost text", async () => {
    const completion = createMockCompletionController({ ghostText: " there" });
    const view = createEditor({ completion });

    await typeText(view, "Hello");

    expect(getTypaiCodeMirrorMarks(view.state)).toEqual([]);
    expect(view.dom.querySelector(`.${typaiCodeMirrorBlueCorrectedClass}`)).toBeNull();
  });

  it("keeps @typai/core free of completion-remote imports", () => {
    const coreSource = readSourceTree(join("..", "core", "src"));

    expect(coreSource).not.toContain("@typai/completion-remote");
    expect(coreSource).not.toContain("completion-remote");
  });

  it("does not create ghost text decorations without completion configured", async () => {
    const view = createEditor();

    await typeText(view, "zzzzword ");

    expect(view.dom.querySelector(`.${typaiCodeMirrorGhostTextClass}`)).toBeNull();
    expect(view.dom.querySelector(".typai-cm-ghostText")).toBeNull();
  });
});

type TypaiExtensionOptions = Parameters<typeof createTypaiCodeMirrorExtension>[0];

type CreateEditorOptions = Partial<TypaiExtensionOptions> & {
  doc?: string;
  extensions?: Extension[];
};

function createEditor(options: CreateEditorOptions = {}): EditorView {
  const { doc = "", extensions = [], ...typaiOptions } = options;
  const parent = document.createElement("div");
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [
        ...extensions,
        createTypaiCodeMirrorExtension({
          typai,
          ...typaiOptions,
        }),
      ],
    }),
  });

  document.body.appendChild(parent);
  views.push(view);

  return view;
}

type MockCompletionController = CodeMirrorCompletionController & {
  editor: CodeMirrorCompletionEditor | null;
  ghostText: string;
  renderOnInput: boolean;
  inputSnapshots: CodeMirrorCompletionSnapshot[];
  selectionSnapshots: CodeMirrorCompletionSnapshot[];
  dismissReasons: CodeMirrorGhostTextClearReason[];
  compositionStarts: number;
  blurs: number;
  correctionTransactions: number;
  disconnected: boolean;
  destroyed: boolean;
};

function createMockCompletionController(
  options: { ghostText?: string; renderOnInput?: boolean } = {},
): MockCompletionController {
  const controller: MockCompletionController = {
    editor: null,
    ghostText: options.ghostText ?? " completion",
    renderOnInput: options.renderOnInput ?? true,
    inputSnapshots: [],
    selectionSnapshots: [],
    dismissReasons: [],
    compositionStarts: 0,
    blurs: 0,
    correctionTransactions: 0,
    disconnected: false,
    destroyed: false,
    connectEditor(editor) {
      controller.editor = editor;

      return () => {
        controller.disconnected = true;
        controller.editor = null;
      };
    },
    onEditorInput(snapshot) {
      controller.inputSnapshots.push(snapshot);

      if (controller.renderOnInput && !snapshot.protected) {
        controller.editor?.renderGhostTextAtCaret(controller.ghostText, snapshot, {
          requestId: "mock-codemirror-completion",
          providerName: "mock",
        });
      }
    },
    onEditorSelectionChange(snapshot) {
      controller.selectionSnapshots.push(snapshot);
    },
    onEditorCompositionStart() {
      controller.compositionStarts += 1;
    },
    onEditorBlur() {
      controller.blurs += 1;
    },
    onCorrectionTransaction() {
      controller.correctionTransactions += 1;
    },
    onGhostTextDismiss(reason) {
      controller.dismissReasons.push(reason);
    },
    destroy() {
      controller.destroyed = true;
    },
  };

  return controller;
}

async function typeText(view: EditorView, text: string): Promise<void> {
  typeTextWithoutFlush(view, text);
  await flushMicrotasks();
}

function typeTextWithoutFlush(view: EditorView, text: string): void {
  for (const char of text) {
    const head = view.state.selection.main.head;

    view.dispatch({
      changes: { from: head, insert: char },
      selection: { anchor: head + char.length },
      userEvent: "input.type",
    });
  }
}

function getGhostElement(view: EditorView): HTMLElement | null {
  return view.dom.querySelector<HTMLElement>(`.${typaiCodeMirrorGhostTextClass}`);
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function getPopover(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function getRequiredPopover(testId: string): HTMLElement {
  const popover = getPopover(testId);

  if (popover === null) {
    throw new Error(`Expected ${testId} to exist.`);
  }

  return popover;
}

function getPopoverAction(
  popover: HTMLElement | null,
  actionName: string,
): HTMLButtonElement | null {
  return (
    popover?.querySelector<HTMLButtonElement>(`[data-typai-popover-action="${actionName}"]`) ?? null
  );
}

function getRequiredPopoverAction(testId: string, actionName: string): HTMLButtonElement {
  const action = getPopoverAction(getRequiredPopover(testId), actionName);

  if (action === null) {
    throw new Error(`Expected ${actionName} action in ${testId}.`);
  }

  return action;
}

function clickPopoverAction(testId: string, actionName: string): void {
  getRequiredPopoverAction(testId, actionName).click();
}

function readSourceTree(root: string): string {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(root, entry.name);

      if (entry.isDirectory()) {
        return readSourceTree(child);
      }

      if (!entry.name.endsWith(".ts")) {
        return [];
      }

      return readFileSync(child, "utf8");
    })
    .join("\n");
}

function createFakeTypaiCore(): TypaiCore {
  const personalDictionary = new Set<string>();
  const correctionRules = new Map<string, CorrectionRule>();

  const correctionRuleKey = (original: string, replacement: string) =>
    `${original}\u0000${replacement}`;
  const setCorrectionRule = (
    original: string,
    replacement: string,
    status: CorrectionRule["status"],
  ) => {
    const existingRule = correctionRules.get(correctionRuleKey(original, replacement));
    const createdAt = existingRule?.createdAt ?? Date.now();

    correctionRules.set(correctionRuleKey(original, replacement), {
      original,
      replacement,
      status,
      createdAt,
      updatedAt: Date.now(),
    });
  };
  const findCorrectionRule = (original: string, replacement?: string) => {
    if (replacement !== undefined) {
      return correctionRules.get(correctionRuleKey(original, replacement)) ?? null;
    }

    return [...correctionRules.values()].find((rule) => rule.original === original) ?? null;
  };

  return {
    checkCompletedToken({ token }) {
      if (personalDictionary.has(token)) {
        return {
          action: "do_nothing",
          reasonCodes: ["mock_personal_dictionary"],
        };
      }

      const alwaysRule = [...correctionRules.values()].find(
        (rule) => rule.original === token && rule.status === "always",
      );

      if (alwaysRule !== undefined) {
        return {
          action: "auto_correct",
          original: alwaysRule.original,
          replacement: alwaysRule.replacement,
          confidence: 1,
          mark: "blue_applied_correction",
          reasonCodes: ["mock_always_correct"],
        };
      }

      return checkFakeToken(token, findCorrectionRule);
    },
    suggestToken({ token }) {
      if (token === "zzzzword") {
        return {
          suggestions: [],
          scores: [],
          reasonCodes: ["mock_unresolved"],
        };
      }

      return {
        suggestions: [],
        scores: [],
        reasonCodes: ["mock_no_suggestions"],
      };
    },
    getLoadedDictionaryWordCount() {
      return 0;
    },
    clearLoadedDictionary() {},
    async addToPersonalDictionary(word) {
      personalDictionary.add(word);
    },
    async removeFromPersonalDictionary() {},
    isInPersonalDictionary(word) {
      return personalDictionary.has(word);
    },
    async setAlwaysCorrect(original, replacement) {
      setCorrectionRule(original, replacement, "always");
    },
    async setNeverCorrect(original, replacement) {
      setCorrectionRule(original, replacement, "never");
    },
    async clearCorrectionRule() {},
    getCorrectionRule(original, replacement) {
      return findCorrectionRule(original, replacement);
    },
    async exportTypaiMemory() {
      return {
        version: 1,
        exportedAt: new Date(0).toISOString(),
        personalDictionary: [...personalDictionary].map((word) => ({ word })),
        correctionRules: [...correctionRules.values()],
      };
    },
    async importTypaiMemory() {},
    async resetTypaiMemory() {},
  };
}

function checkFakeToken(
  token: string,
  getCorrectionRule: (original: string, replacement?: string) => CorrectionRule | null,
): CorrectionDecision {
  if (token === "teh") {
    const neverRule = getCorrectionRule("teh", "the");

    if (neverRule?.status === "never") {
      return {
        action: "do_nothing",
        reasonCodes: ["mock_never_correct"],
      };
    }

    return {
      action: "auto_correct",
      original: "teh",
      replacement: "the",
      confidence: 1,
      mark: "blue_applied_correction",
      reasonCodes: ["mock_common_typo"],
    };
  }

  if (token === "zzzzword") {
    return {
      action: "mark_unresolved",
      original: "zzzzword",
      suggestions: [],
      mark: "red_spelling_issue",
      reasonCodes: ["mock_unresolved"],
    };
  }

  if (token === "reciept") {
    return {
      action: "mark_unresolved",
      original: "reciept",
      suggestions: ["receipt"],
      mark: "red_spelling_issue",
      reasonCodes: ["mock_edit_distance_suggestion"],
    };
  }

  return {
    action: "do_nothing",
    reasonCodes: ["mock_noop"],
  };
}
