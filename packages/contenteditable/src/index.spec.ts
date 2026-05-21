// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CorrectionDecision, TypaiCore } from "@typai/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  attachContenteditable,
  type CompletionEditorSnapshot,
  type CompletionTransaction,
  type CorrectionTransaction,
  plainTextOffsetToDomPosition,
  rangeStillMatches,
  type TypaiPopover,
  type TypaiUserAction,
  type VisualMark,
} from "./index";

afterEach(() => {
  document.body.innerHTML = "";
  document.getSelection()?.removeAllRanges();
});

class TestEditable extends EventTarget {
  textContent: string | null = "";
  ownerDocument = undefined;
  firstChild = null;

  contains() {
    return false;
  }
}

describe("attachContenteditable", () => {
  it("returns a detach function", () => {
    const element = new TestEditable();
    const detach = attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
    });

    expect(detach).toEqual(expect.any(Function));
    detach();
  });

  it("does not correct during IME composition", () => {
    const element = new TestEditable();
    const corrections: CorrectionTransaction[] = [];
    const typai = createStubTypai();

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
    });

    element.dispatchEvent(new Event("compositionstart"));
    element.textContent = "teh ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("teh ");
    expect(corrections).toHaveLength(0);
    expect(typai.calls).toEqual([]);
  });

  it("auto-corrects a completed token after a delimiter", () => {
    const element = new TestEditable();
    const corrections: CorrectionTransaction[] = [];
    const marks: VisualMark[] = [];
    const textChanges: Array<{ text: string; caretOffset: number }> = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
      onCorrection: (transaction) => corrections.push(transaction),
      onMark: (mark) => marks.push(mark),
      onTextChange: (change) =>
        textChanges.push({ text: change.text, caretOffset: change.caretOffset }),
    });

    element.textContent = "teh ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("the ");
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      rangeBefore: { start: 0, end: 3, text: "teh" },
      rangeAfter: { start: 0, end: 3, text: "the" },
      original: "teh",
      replacement: "the",
      trigger: "space",
      confidence: 0.99,
      reasonCodes: ["COMMON_TYPO_MATCH"],
    });
    expect(marks).toEqual([
      expect.objectContaining({
        range: { start: 0, end: 3 },
        kind: "blue_applied_correction",
        correctionEventId: corrections[0]?.id,
      }),
    ]);
    expect(element.textContent?.slice(marks[0]?.range.start, marks[0]?.range.end)).toBe("the");
    expect(textChanges).toContainEqual({ text: "the ", caretOffset: 4 });
  });

  it("keeps a punctuation-triggered blue mark after the following space", () => {
    const element = new TestEditable();
    const marks: VisualMark[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
      onMark: (mark) => marks.push(mark),
      onMarkRemoved: (removedMark) => {
        const index = marks.findIndex((mark) => mark.id === removedMark.id);

        if (index >= 0) {
          marks.splice(index, 1);
        }
      },
    });

    element.textContent = "teh.";
    element.dispatchEvent(inputEvent("."));

    expect(element.textContent).toBe("the.");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      range: { start: 0, end: 3 },
      kind: "blue_applied_correction",
    });

    element.textContent = `${element.textContent} `;
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("the. ");
    expect(marks).toHaveLength(1);
    expect(element.textContent?.slice(marks[0]?.range.start, marks[0]?.range.end)).toBe("the");
  });

  it("does not write when a reentrant input changes the document version before apply", () => {
    const element = new TestEditable();
    const corrections: CorrectionTransaction[] = [];
    const marks: VisualMark[] = [];
    const typai = createStubTypai({
      beforeDecision(token) {
        if (token === "teh") {
          element.textContent = "teh changed ";
          element.dispatchEvent(inputEvent("x"));
        }
      },
    });

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
      onMark: (mark) => marks.push(mark),
    });

    element.textContent = "teh ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("teh changed ");
    expect(corrections).toHaveLength(0);
    expect(marks).toHaveLength(0);
  });

  it("does not write when the captured range text no longer matches the token", () => {
    const element = new TestEditable();
    const corrections: CorrectionTransaction[] = [];
    const marks: VisualMark[] = [];
    const typai = createStubTypai({
      beforeDecision(token) {
        if (token === "teh") {
          element.textContent = "abc ";
        }
      },
    });

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
      onMark: (mark) => marks.push(mark),
    });

    element.textContent = "teh ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("abc ");
    expect(corrections).toHaveLength(0);
    expect(marks).toHaveLength(0);
  });

  it("does not write when the range text became part of a different token", () => {
    const element = new TestEditable();
    const corrections: CorrectionTransaction[] = [];
    const marks: VisualMark[] = [];
    const typai = createStubTypai({
      beforeDecision(token) {
        if (token === "teh") {
          element.textContent = "tehword ";
        }
      },
    });

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
      onMark: (mark) => marks.push(mark),
    });

    element.textContent = "teh ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("tehword ");
    expect(corrections).toHaveLength(0);
    expect(marks).toHaveLength(0);
  });

  it("does not call Typai for a protected email token", () => {
    const element = new TestEditable();
    const typai = createStubTypai();
    const protectedSkips: string[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onProtectedSkip: (token) => protectedSkips.push(token.text),
    });

    element.textContent = "user@example.com ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("user@example.com ");
    expect(typai.calls).toEqual([]);
    expect(protectedSkips).toEqual(["user@example.com"]);
  });

  it.each(["form", "lead", "to", "its"])("does not correct valid word %s", (token) => {
    const element = new TestEditable();
    const typai = createStubTypai();
    const corrections: CorrectionTransaction[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
    });

    element.textContent = `${token} `;
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe(`${token} `);
    expect(typai.calls).toEqual([token]);
    expect(corrections).toHaveLength(0);
  });

  it.each([
    "user@example.com",
    "https://example.com",
    "/etc/passwd",
    "snake_case_identifier",
    "CVE-2024-1234",
  ])("does not write protected token %s", (token) => {
    const element = new TestEditable();
    const typai = createStubTypai();
    const corrections: CorrectionTransaction[] = [];
    const marks: VisualMark[] = [];
    const protectedSkips: string[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
      onMark: (mark) => marks.push(mark),
      onProtectedSkip: (skippedToken) => protectedSkips.push(skippedToken.text),
    });

    element.textContent = `${token} `;
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe(`${token} `);
    expect(typai.calls).toEqual([]);
    expect(corrections).toHaveLength(0);
    expect(marks).toHaveLength(0);
    expect(protectedSkips).toEqual([token]);
  });

  it("does not mark an in-progress URL scheme before the full URL is typed", () => {
    const element = new TestEditable();
    const typai = createStubTypai();
    const marks: VisualMark[] = [];
    const protectedSkips: string[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onMark: (mark) => marks.push(mark),
      onProtectedSkip: (skippedToken) => protectedSkips.push(skippedToken.text),
    });

    element.textContent = "https:";
    element.dispatchEvent(inputEvent(":"));

    expect(typai.calls).toEqual([]);
    expect(marks).toHaveLength(0);
    expect(protectedSkips).toEqual(["https"]);

    element.textContent = "https://example.com ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("https://example.com ");
    expect(typai.calls).toEqual([]);
    expect(marks).toHaveLength(0);
    expect(protectedSkips.at(-1)).toBe("https://example.com");
  });

  it("emits an unresolved mark without mutating text", () => {
    const element = new TestEditable();
    const marks: VisualMark[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
      onMark: (mark) => marks.push(mark),
    });

    element.textContent = "zzzzword ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("zzzzword ");
    expect(marks).toEqual([
      expect.objectContaining({
        range: { start: 0, end: 8 },
        kind: "red_spelling_issue",
      }),
    ]);
    expect(element.textContent?.slice(marks[0]?.range.start, marks[0]?.range.end)).toBe("zzzzword");
  });

  it("opens a blue correction popover on blue mark click", () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    clickMark(harness.element, harness.marks[0]);

    expect(latestPopover(harness)?.kind).toBe("blue_correction");
    expect(latestPopover(harness)).toMatchObject({
      label: 'Corrected "teh" -> "the"',
    });
  });

  it("opens a blue correction popover from keyboard activation", () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");

    expect(pressMarkKey(harness.element, harness.marks[0], "Enter")).toBe(true);
    expectPopoverKind(latestPopover(harness), "blue_correction");
  });

  it("closes an open popover on Escape", () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    pressMarkKey(harness.element, harness.marks[0], "Enter");

    expectPopoverKind(latestPopover(harness), "blue_correction");
    harness.element.dispatchEvent(keyEvent("Escape"));

    expect(latestPopover(harness)).toBeNull();
  });

  it("blue popover revert restores the original token exactly", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "blue_correction");
    const result = await popover.actions.revert();

    expect(result.applied).toBe(true);
    expect(harness.element.textContent).toBe("teh ");
    expect(harness.marks).toHaveLength(0);
    expect(harness.actions).toContainEqual({
      type: "revert_correction",
      original: "teh",
      replacement: "the",
    });
  });

  it("blue popover always-correct action updates the TypaiCore rule", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "blue_correction");
    const result = await popover.actions.alwaysCorrect();

    expect(result.applied).toBe(true);
    expect(harness.typai.getCorrectionRule("teh", "the")).toMatchObject({
      original: "teh",
      replacement: "the",
      status: "always",
    });
  });

  it("blue popover never-correct action suppresses future autocorrect", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "blue_correction");
    await popover.actions.neverCorrect();
    harness.marks.splice(0, harness.marks.length);

    typeCompletedToken(harness.element, "teh ");

    expect(harness.element.textContent).toBe("teh ");
    expect(harness.corrections).toHaveLength(1);
    expect(harness.marks).toEqual([
      expect.objectContaining({
        kind: "red_spelling_issue",
        original: "teh",
        suggestions: ["the"],
      }),
    ]);
  });

  it("blue popover add-to-dictionary reverts and suppresses future original token checks", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "blue_correction");
    await popover.actions.addOriginalToDictionary();
    harness.marks.splice(0, harness.marks.length);

    expect(harness.element.textContent).toBe("teh ");
    expect(harness.typai.isInPersonalDictionary("teh")).toBe(true);

    typeCompletedToken(harness.element, "teh ");

    expect(harness.element.textContent).toBe("teh ");
    expect(harness.marks).toHaveLength(0);
  });

  it("opens a red spelling popover with suggestions", () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");

    expect(popover.original).toBe("reciept");
    expect(popover.suggestions).toEqual(["receipt", "recipe"]);
    expect(popover.label).toBe('Possible spelling issue: "reciept"');
  });

  it("opens a red spelling popover from keyboard activation", () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");

    expect(pressMarkKey(harness.element, harness.marks[0], " ")).toBe(true);
    expectPopoverKind(latestPopover(harness), "red_spelling");
  });

  it("red popover suggestion click applies a replacement and creates a blue mark", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");
    const result = await popover.actions.applySuggestion("receipt");

    expect(result.applied).toBe(true);
    expect(harness.element.textContent).toBe("receipt ");
    expect(harness.corrections.at(-1)).toMatchObject({
      original: "reciept",
      replacement: "receipt",
      trigger: "popover",
    });
    expect(harness.marks).toEqual([
      expect.objectContaining({
        kind: "blue_applied_correction",
        original: "reciept",
        replacement: "receipt",
      }),
    ]);
  });

  it("red popover suggestion validates the current range before applying", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");
    clickMark(harness.element, harness.marks[0]);
    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");

    harness.element.textContent = "receipt already ";
    harness.element.dispatchEvent(inputEvent("y"));

    const result = await popover.actions.applySuggestion("receipt");

    expect(result).toEqual({ applied: false, reason: "missing_mark" });
    expect(harness.element.textContent).toBe("receipt already ");
    expect(harness.corrections).toHaveLength(0);
  });

  it("red popover ignore once removes only the current red mark", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");
    await popover.actions.ignoreOnce();

    expect(harness.marks).toHaveLength(0);

    typeCompletedToken(harness.element, "reciept ");

    expect(harness.marks).toEqual([
      expect.objectContaining({
        kind: "red_spelling_issue",
        original: "reciept",
      }),
    ]);
  });

  it("red popover add-to-dictionary removes red mark and suppresses future red marks", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");
    await popover.actions.addToDictionary();

    expect(harness.marks).toHaveLength(0);
    expect(harness.typai.isInPersonalDictionary("reciept")).toBe(true);

    typeCompletedToken(harness.element, "reciept ");

    expect(harness.marks).toHaveLength(0);
  });

  it("red popover disable-autocorrect keeps spellcheck marks enabled", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "zzzzword ");
    clickMark(harness.element, harness.marks[0]);

    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");
    await popover.actions.disableAutocorrect();
    harness.marks.splice(0, harness.marks.length);

    typeCompletedToken(harness.element, "teh ");

    expect(harness.element.textContent).toBe("teh ");
    expect(harness.detach.getSettings().autocorrect).toBe(false);
    expect(harness.marks).toEqual([
      expect.objectContaining({
        kind: "red_spelling_issue",
        original: "teh",
        suggestions: ["the"],
      }),
    ]);
  });

  it("stale range prevents suggestion application", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "reciept ");
    clickMark(harness.element, harness.marks[0]);
    harness.element.textContent = "changed ";

    const popover = expectPopoverKind(latestPopover(harness), "red_spelling");
    const result = await popover.actions.applySuggestion("receipt");

    expect(result.applied).toBe(false);
    expect(harness.element.textContent).toBe("changed ");
    expect(harness.corrections).toHaveLength(0);
  });

  it("editing a blue-marked word invalidates the stored mark", () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");

    expect(harness.marks).toHaveLength(1);

    harness.element.textContent = "then ";
    harness.element.dispatchEvent(inputEvent("n"));

    expect(harness.marks).toHaveLength(0);
    expect(latestPopover(harness)).toBeNull();
  });

  it("stale blue mark click does not mutate the wrong text", async () => {
    const harness = createHarness();

    typeCompletedToken(harness.element, "teh ");
    clickMark(harness.element, harness.marks[0]);
    harness.element.textContent = "other ";

    const popover = expectPopoverKind(latestPopover(harness), "blue_correction");
    const result = await popover.actions.revert();

    expect(result).toEqual({ applied: false, reason: "missing_mark" });
    expect(harness.element.textContent).toBe("other ");
  });

  it("pastes plain text without running autocorrect across the paste", () => {
    const element = new TestEditable();
    const typai = createStubTypai();
    const corrections: CorrectionTransaction[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
      onCorrection: (transaction) => corrections.push(transaction),
    });

    element.dispatchEvent(pasteEvent("teh https://example.com ", "<b>teh</b>"));

    expect(element.textContent).toBe("teh https://example.com ");
    expect(typai.calls).toEqual([]);
    expect(corrections).toHaveLength(0);
  });

  it("paste strips HTML by using text/plain clipboard data", () => {
    const element = new TestEditable();

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
    });

    element.dispatchEvent(pasteEvent("bold text ", "<strong>bold text</strong>"));

    expect(element.textContent).toBe("bold text ");
    expect(element.textContent).not.toContain("<strong>");
  });

  it("removes listeners on detach", () => {
    const element = new TestEditable();
    const typai = createStubTypai();
    const detach = attachContenteditable({
      element: element as unknown as HTMLElement,
      typai,
    });

    detach();
    element.textContent = "teh ";
    element.dispatchEvent(inputEvent(" "));

    expect(element.textContent).toBe("teh ");
    expect(typai.calls).toEqual([]);
  });

  it("records finite on-delimiter latency without a strict timing threshold", () => {
    const element = new TestEditable();

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
    });

    element.textContent = "teh ";
    const startedAt = performance.now();
    element.dispatchEvent(inputEvent(" "));
    const elapsed = performance.now() - startedAt;

    expect(Number.isFinite(elapsed)).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it("notifies an optional structural completion controller on editor input", () => {
    const element = new TestEditable();
    const snapshots: CompletionEditorSnapshot[] = [];

    attachContenteditable({
      element: element as unknown as HTMLElement,
      typai: createStubTypai(),
      completionMode: "prompt",
      completion: {
        onEditorInput: (snapshot) => snapshots.push(snapshot),
      },
    });

    element.textContent = "continue this";
    element.dispatchEvent(inputEvent("s"));

    expect(snapshots).toEqual([
      expect.objectContaining({
        text: "continue this",
        version: 1,
        selection: { start: 13, end: 13 },
        isComposingIME: false,
        mode: "prompt",
      }),
    ]);
  });
});

describe("contenteditable ghost text", () => {
  it("renders ghost text at the caret", () => {
    const element = createDomEditable("Can you help me");
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
    });

    detach.renderGhostTextAtCaret(" understand this", detach.getSnapshot());

    const ghost = getGhostElement(element);

    expect(ghost?.textContent).toBe(" understand this");
    expect(detach.isGhostTextVisible()).toBe(true);
    expect(detach.getGhostTextText()).toBe(" understand this");
  });

  it("does not include ghost text in getSnapshot().text", () => {
    const element = createDomEditable("Can you help me");
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
    });

    detach.renderGhostTextAtCaret(" understand this", detach.getSnapshot());

    expect(element.textContent).toBe("Can you help me understand this");
    expect(detach.getSnapshot().text).toBe("Can you help me");
  });

  it("marks ghost text as visual-only DOM", () => {
    const element = createDomEditable("Prompt");
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());

    const ghost = getGhostElement(element);

    expect(ghost?.getAttribute("contenteditable")).toBe("false");
    expect(ghost?.getAttribute("aria-hidden")).toBe("true");
    expect(ghost?.className).toBe("typai-ghost-text");
  });

  it("removes ghost text on typing", () => {
    const element = createDomEditable("Prompt");
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    element.textContent = "Prompt!";
    element.dispatchEvent(inputEvent("!"));

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(dismissReasons).toEqual(["typing"]);
  });

  it("removes ghost text on selection change", () => {
    const element = createDomEditable("Prompt");
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    placeDomSelection(element, 0);
    document.dispatchEvent(new Event("selectionchange"));

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(dismissReasons).toEqual(["selection_change"]);
  });

  it("removes ghost text on compositionstart", () => {
    const element = createDomEditable("Prompt");
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    element.dispatchEvent(new Event("compositionstart"));

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(dismissReasons).toEqual(["composition"]);
  });

  it("removes ghost text on blur", () => {
    const element = createDomEditable("Prompt");
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    element.dispatchEvent(new Event("blur"));

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(dismissReasons).toEqual(["blur"]);
  });

  it("removes ghost text on Escape and emits dismissal", () => {
    const element = createDomEditable("Prompt");
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());

    const event = keyEvent("Escape");
    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(dismissReasons).toEqual(["escape"]);
  });

  it("removes ghost text on paste", () => {
    const element = createDomEditable("Prompt");
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    element.dispatchEvent(pasteEvent(" pasted"));

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(detach.getSnapshot().text).toBe("Prompt pasted");
    expect(dismissReasons).toEqual(["paste"]);
  });

  it("leaves Tab alone when no ghost text is visible", () => {
    const element = createDomEditable("Prompt");
    attachContenteditable({
      element,
      typai: createStubTypai(),
    });

    const event = keyEvent("Tab");
    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(element.textContent).toBe("Prompt");
  });

  it("accepts visible ghost text on Tab", () => {
    const element = createDomEditable("Prompt");
    const acceptedSnapshots: CompletionEditorSnapshot[] = [];
    const acceptedTransactions: CompletionTransaction[] = [];
    const marks: VisualMark[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      onMark: (mark) => marks.push(mark),
      onCompletionAccepted: (transaction) => acceptedTransactions.push(transaction),
      completion: {
        onGhostTextAccept: (snapshot) => acceptedSnapshots.push(snapshot),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot(), {
      requestId: "request-1",
      providerName: "mock-provider",
      model: "mock-model",
      latencyMs: 42,
    });

    const event = keyEvent("Tab");
    element.dispatchEvent(event);
    const transaction = detach.getCompletionTransactions()[0];

    expect(event.defaultPrevented).toBe(true);
    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(detach.getSnapshot().text).toBe("Prompt draft");
    expect(transaction).toMatchObject({
      requestId: "request-1",
      rangeBefore: { start: 6, end: 6, text: "" },
      rangeAfter: { start: 6, end: 12, text: " draft" },
      insertedText: " draft",
      providerName: "mock-provider",
      model: "mock-model",
      latencyMs: 42,
    });
    expect(acceptedTransactions).toEqual([transaction]);
    expect(marks).toHaveLength(0);
    expect(acceptedSnapshots).toEqual([
      expect.objectContaining({
        text: "Prompt",
        selection: { start: 6, end: 6 },
      }),
    ]);
  });

  it.each([" ", "Enter"])("does not accept visible ghost text on %s", (key) => {
    const element = createDomEditable("Prompt");
    const acceptedSnapshots: CompletionEditorSnapshot[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      completion: {
        onGhostTextAccept: (snapshot) => acceptedSnapshots.push(snapshot),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());

    const event = keyEvent(key);
    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(detach.isGhostTextVisible()).toBe(true);
    expect(detach.getSnapshot().text).toBe("Prompt");
    expect(acceptedSnapshots).toHaveLength(0);
  });

  it("exactly reverts an accepted completion transaction", () => {
    const element = createDomEditable("Prompt");
    const revertedTransactions: CompletionTransaction[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      onCompletionReverted: (transaction) => revertedTransactions.push(transaction),
      completion: {
        onCompletionReverted: (transaction) => revertedTransactions.push(transaction),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot(), {
      requestId: "request-2",
    });
    element.dispatchEvent(keyEvent("Tab"));

    const transaction = detach.getCompletionTransactions()[0];
    const result = detach.revertCompletion(transaction?.id ?? "");

    expect(result).toEqual({ applied: true, transaction });
    expect(detach.getSnapshot().text).toBe("Prompt");
    expect(revertedTransactions).toEqual([transaction, transaction]);
  });

  it("blocks stale ghost accept safely", () => {
    const element = createDomEditable("Prompt");
    const acceptedTransactions: CompletionTransaction[] = [];
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      onCompletionAccepted: (transaction) => acceptedTransactions.push(transaction),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    element.textContent = "Prompt changed";

    const event = keyEvent("Tab");
    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(detach.isGhostTextVisible()).toBe(false);
    expect(detach.getSnapshot().text).toBe("Prompt changed");
    expect(detach.getCompletionTransactions()).toHaveLength(0);
    expect(acceptedTransactions).toHaveLength(0);
    expect(dismissReasons).toEqual(["stale"]);
  });

  it("fails completion revert safely when the accepted range changed", () => {
    const element = createDomEditable("Prompt");
    const revertedTransactions: CompletionTransaction[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      onCompletionReverted: (transaction) => revertedTransactions.push(transaction),
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    element.dispatchEvent(keyEvent("Tab"));

    const transaction = detach.getCompletionTransactions()[0];
    element.textContent = "Prompt changed draft";
    const result = detach.revertCompletion(transaction?.id ?? "");

    expect(result).toEqual({ applied: false, reason: "stale_range" });
    expect(detach.getSnapshot().text).toBe("Prompt changed draft");
    expect(revertedTransactions).toHaveLength(0);
  });

  it("typing after accepted completion resumes normal correction", () => {
    const element = createDomEditable("Prompt");
    const corrections: CorrectionTransaction[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      onCorrection: (transaction) => corrections.push(transaction),
    });

    detach.renderGhostTextAtCaret(" teh", detach.getSnapshot());
    element.dispatchEvent(keyEvent("Tab"));

    expect(detach.getSnapshot().text).toBe("Prompt teh");
    expect(corrections).toHaveLength(0);

    element.textContent = `${detach.getSnapshot().text} `;
    placeDomSelection(element, element.textContent.length);
    element.dispatchEvent(inputEvent(" "));

    expect(detach.getSnapshot().text).toBe("Prompt the ");
    expect(corrections).toHaveLength(1);
    expect(detach.getCompletionTransactions()).toHaveLength(1);
  });

  it("removes ghost text on correction transaction", async () => {
    const element = createDomEditable("reciept ");
    const marks: VisualMark[] = [];
    const popovers: Array<TypaiPopover | null> = [];
    const dismissReasons: string[] = [];
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
      onMark: (mark) => marks.push(mark),
      onPopover: (popover) => popovers.push(popover),
      completion: {
        onGhostTextDismiss: (reason) => dismissReasons.push(reason),
      },
    });

    element.dispatchEvent(inputEvent(" "));
    placeDomSelection(element, element.textContent?.length ?? 0);
    detach.renderGhostTextAtCaret(" please", detach.getSnapshot());
    clickMark(element, marks[0]);

    const popover = expectPopoverKind(popovers.at(-1) ?? null, "red_spelling");
    await popover.actions.applySuggestion("receipt");

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(getGhostElement(element)).toBeNull();
    expect(dismissReasons).toEqual(["correction_transaction"]);

    const event = keyEvent("Tab");
    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(detach.getSnapshot().text).toBe("receipt ");
  });

  it("clearGhostText is idempotent", () => {
    const element = createDomEditable("Prompt");
    const detach = attachContenteditable({
      element,
      typai: createStubTypai(),
    });

    detach.renderGhostTextAtCaret(" draft", detach.getSnapshot());
    detach.clearGhostText("manual");
    detach.clearGhostText("manual");

    expect(detach.isGhostTextVisible()).toBe(false);
    expect(detach.getGhostTextText()).toBe("");
  });

  it("does not import completion-remote from contenteditable or core", () => {
    const contenteditableSource = readFileSync("src/index.ts", "utf8");
    const coreSource = readDirectoryText("../core/src");

    expect(contenteditableSource).not.toContain("@typai/completion-remote");
    expect(coreSource).not.toContain("@typai/completion-remote");
  });
});

describe("rangeStillMatches", () => {
  it("returns false when the document version changed", () => {
    expect(
      rangeStillMatches({
        documentVersion: 1,
        currentDocumentVersion: 2,
        text: "teh ",
        range: { start: 0, end: 3 },
        expectedText: "teh",
      }),
    ).toBe(false);
  });

  it("returns false when the token text changed", () => {
    expect(
      rangeStillMatches({
        documentVersion: 1,
        currentDocumentVersion: 1,
        text: "the ",
        range: { start: 0, end: 3 },
        expectedText: "teh",
      }),
    ).toBe(false);
  });

  it("returns false when the range no longer maps to the same token", () => {
    expect(
      rangeStillMatches({
        documentVersion: 1,
        currentDocumentVersion: 1,
        text: "tehword ",
        range: { start: 0, end: 3 },
        expectedText: "teh",
      }),
    ).toBe(false);
  });

  it("returns true when version and token text still match", () => {
    expect(
      rangeStillMatches({
        documentVersion: 1,
        currentDocumentVersion: 1,
        text: "teh ",
        range: { start: 0, end: 3 },
        expectedText: "teh",
      }),
    ).toBe(true);
  });
});

describe("plain text DOM mapping", () => {
  it("maps offsets across multiple text nodes and marked spans", () => {
    const first = fakeText("hello ");
    const marked = fakeElement([fakeText("the")]);
    const last = fakeText(" world");
    const root = fakeElement([first, marked, last]);

    expect(positionText(plainTextOffsetToDomPosition(root as unknown as Node, 0))).toEqual({
      text: "hello ",
      offset: 0,
    });
    expect(positionText(plainTextOffsetToDomPosition(root as unknown as Node, 8))).toEqual({
      text: "the",
      offset: 2,
    });
    expect(positionText(plainTextOffsetToDomPosition(root as unknown as Node, 13))).toEqual({
      text: " world",
      offset: 4,
    });
  });
});

function inputEvent(data: string): Event {
  const event = new Event("input");
  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}

function pasteEvent(plainText: string, html = ""): Event {
  const event = new Event("paste", { cancelable: true });
  const clipboardData = {
    getData(type: string) {
      return type === "text/html" ? html : plainText;
    },
  };

  Object.defineProperty(event, "clipboardData", {
    value: clipboardData,
  });

  return event;
}

function createDomEditable(text: string): HTMLElement {
  const element = document.createElement("div");

  element.contentEditable = "true";
  element.textContent = text;
  document.body.append(element);
  placeDomSelection(element, text.length);

  return element;
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

function getGhostElement(element: HTMLElement): HTMLElement | null {
  return element.querySelector<HTMLElement>('[data-typai-ghost="true"]');
}

function readDirectoryText(root: string): string {
  let text = "";

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      text += readDirectoryText(entryPath);
      continue;
    }

    if (entry.name.endsWith(".ts")) {
      text += readFileSync(entryPath, "utf8");
    }
  }

  return text;
}

type StubTypaiOptions = {
  beforeDecision?: (token: string) => void;
};

type StubTypai = TypaiCore & {
  calls: string[];
};

function createStubTypai(options: StubTypaiOptions = {}): StubTypai {
  const calls: string[] = [];
  const personalDictionary = new Set<string>();
  const alwaysRules = new Map<string, string>();
  const neverRules = new Map<string, string>();

  return {
    calls,
    checkCompletedToken(input) {
      const normalizedToken = input.token.toLowerCase();
      calls.push(input.token);
      options.beforeDecision?.(input.token);

      if (personalDictionary.has(normalizedToken)) {
        return {
          action: "do_nothing",
          reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
        };
      }

      const alwaysReplacement = alwaysRules.get(normalizedToken);

      if (alwaysReplacement !== undefined) {
        return {
          action: "auto_correct",
          original: input.token,
          replacement: alwaysReplacement,
          confidence: 1,
          mark: "blue_applied_correction",
          reasonCodes: ["ALWAYS_CORRECT_RULE"],
        };
      }

      return decisionForToken(input.token, neverRules);
    },
    suggestToken() {
      return {
        suggestions: [],
        scores: [],
        reasonCodes: [],
      };
    },
    getLoadedDictionaryWordCount() {
      return 0;
    },
    getLoadedDictionaryByteSize() {
      return 0;
    },
    getDeleteIndexEntryCount() {
      return 0;
    },
    getDeleteIndexMemoryEstimateBytes() {
      return 0;
    },
    clearLoadedDictionary() {},
    async addToPersonalDictionary(word) {
      personalDictionary.add(word.toLowerCase());
    },
    async removeFromPersonalDictionary() {},
    isInPersonalDictionary(word) {
      return personalDictionary.has(word.toLowerCase());
    },
    async setAlwaysCorrect(original, replacement) {
      alwaysRules.set(original.toLowerCase(), replacement);
    },
    async setNeverCorrect(original, replacement) {
      neverRules.set(original.toLowerCase(), replacement);
    },
    async clearCorrectionRule() {},
    getCorrectionRule(original, replacement) {
      const normalizedOriginal = original.toLowerCase();
      const alwaysReplacement = alwaysRules.get(normalizedOriginal);
      const neverReplacement = neverRules.get(normalizedOriginal);

      if (
        alwaysReplacement !== undefined &&
        (replacement === undefined || replacement === alwaysReplacement)
      ) {
        return {
          original: normalizedOriginal,
          replacement: alwaysReplacement,
          status: "always",
          createdAt: 1,
          updatedAt: 1,
        };
      }

      if (
        neverReplacement !== undefined &&
        (replacement === undefined || replacement === neverReplacement)
      ) {
        return {
          original: normalizedOriginal,
          replacement: neverReplacement,
          status: "never",
          createdAt: 1,
          updatedAt: 1,
        };
      }

      return null;
    },
    async exportTypaiMemory() {
      return {
        version: 1,
        exportedAt: new Date(0).toISOString(),
        personalDictionary: [...personalDictionary].map((word) => ({ word, createdAt: 1 })),
        correctionRules: [],
      };
    },
    async importTypaiMemory() {},
    async resetTypaiMemory() {
      personalDictionary.clear();
      alwaysRules.clear();
      neverRules.clear();
    },
  };
}

function decisionForToken(
  token: string,
  neverRules = new Map<string, string>(),
): CorrectionDecision {
  if (neverRules.get(token.toLowerCase()) === "the") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: ["the"],
      mark: "red_spelling_issue",
      reasonCodes: ["COMMON_TYPO_MATCH", "NEVER_CORRECT_RULE"],
    };
  }

  if (token === "teh") {
    return {
      action: "auto_correct",
      original: "teh",
      replacement: "the",
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH"],
    };
  }

  if (token === "reciept") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: ["receipt", "recipe"],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD", "EDIT_DISTANCE_SUGGESTIONS"],
    };
  }

  if (token === "zzzzword") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: [],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD"],
    };
  }

  return {
    action: "do_nothing",
    reasonCodes: ["KNOWN_VALID_WORD"],
  };
}

type Harness = {
  element: TestEditable;
  typai: StubTypai;
  marks: VisualMark[];
  corrections: CorrectionTransaction[];
  popovers: Array<TypaiPopover | null>;
  actions: TypaiUserAction[];
  detach: ReturnType<typeof attachContenteditable>;
};

function createHarness(): Harness {
  const element = new TestEditable();
  const typai = createStubTypai();
  const marks: VisualMark[] = [];
  const corrections: CorrectionTransaction[] = [];
  const popovers: Array<TypaiPopover | null> = [];
  const actions: TypaiUserAction[] = [];
  const detach = attachContenteditable({
    element: element as unknown as HTMLElement,
    typai,
    onCorrection: (transaction) => corrections.push(transaction),
    onMark: (mark) => marks.push(mark),
    onMarkRemoved: (removedMark) => {
      const index = marks.findIndex((mark) => mark.id === removedMark.id);

      if (index >= 0) {
        marks.splice(index, 1);
      }
    },
    onPopover: (popover) => popovers.push(popover),
    onUserAction: (action) => actions.push(action),
  });

  return {
    element,
    typai,
    marks,
    corrections,
    popovers,
    actions,
    detach,
  };
}

function typeCompletedToken(element: TestEditable, text: string): void {
  element.textContent = text;
  element.dispatchEvent(inputEvent(text.at(-1) ?? " "));
}

function clickMark(element: EventTarget, mark: VisualMark | undefined): void {
  if (mark === undefined) {
    throw new Error("Expected a mark to click.");
  }

  const event = new Event("click");
  const target = {
    closest() {
      return {
        getAttribute(name: string) {
          return name === "data-mark-id" ? mark.id : null;
        },
      };
    },
  };

  Object.defineProperty(event, "target", {
    value: target,
  });

  element.dispatchEvent(event);
}

function pressMarkKey(
  element: TestEditable,
  mark: VisualMark | undefined,
  key: "Enter" | " ",
): boolean {
  if (mark === undefined) {
    throw new Error("Expected a mark to activate.");
  }

  const event = keyEvent(key);
  const target = {
    closest() {
      return {
        getAttribute(name: string) {
          return name === "data-mark-id" ? mark.id : null;
        },
      };
    },
  };

  Object.defineProperty(event, "target", {
    value: target,
  });

  element.dispatchEvent(event);

  return event.defaultPrevented;
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

function latestPopover(harness: Harness): TypaiPopover | null {
  return harness.popovers.at(-1) ?? null;
}

function expectPopoverKind<K extends TypaiPopover["kind"]>(
  popover: TypaiPopover | null,
  kind: K,
): Extract<TypaiPopover, { kind: K }> {
  expect(popover).not.toBeNull();
  expect(popover?.kind).toBe(kind);

  return popover as Extract<TypaiPopover, { kind: K }>;
}

type FakeNode = {
  nodeType: number;
  textContent: string;
  childNodes: FakeNode[];
  contains(node: FakeNode): boolean;
};

function fakeText(text: string): FakeNode {
  const node: FakeNode = {
    nodeType: 3,
    textContent: text,
    childNodes: [],
    contains(candidate) {
      return candidate === node;
    },
  };

  return node;
}

function fakeElement(children: FakeNode[]): FakeNode {
  const node: FakeNode = {
    nodeType: 1,
    textContent: children.map((child) => child.textContent).join(""),
    childNodes: children,
    contains(candidate) {
      return candidate === node || children.some((child) => child.contains(candidate));
    },
  };

  return node;
}

function positionText(position: { node: Text; offset: number } | null) {
  if (position === null) {
    return null;
  }

  return {
    text: position.node.textContent,
    offset: position.offset,
  };
}
