import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TypaiCore } from "@typai/core";
import { describe, expect, it } from "vitest";

import {
  type AttachTextareaOptions,
  attachTextarea,
  rangeStillMatches,
  type TextareaCorrectionEvent,
  type TextareaDecisionEvent,
  type TextareaMarkEvent,
  type TextareaMarkRemovedEvent,
  type TextareaProtectedSkipEvent,
} from "../src/index";

class TestTextarea extends EventTarget {
  nodeName = "TEXTAREA";
  value = "";
  selectionStart = 0;
  selectionEnd = 0;
  disabled = false;
  readOnly = false;
  form: EventTarget | null = null;
  addedListeners: string[] = [];
  removedListeners: string[] = [];

  setSelectionRange(selectionStart: number, selectionEnd: number): void {
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.addedListeners.push(type);
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.removedListeners.push(type);
    super.removeEventListener(type, callback, options);
  }
}

describe("attachTextarea event core", () => {
  it("exports attachTextarea", () => {
    expect(attachTextarea).toEqual(expect.any(Function));
  });

  it("returns a detach function", () => {
    const textarea = createTextarea();
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
    });

    expect(detach).toEqual(expect.any(Function));
    detach();
  });

  it("attaches and detaches textarea listeners", () => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const detach = attachTextarea({
      textarea,
      typai,
    });

    expect(textarea.addedListeners).toEqual([
      "scroll",
      "compositionstart",
      "compositionend",
      "input",
      "keydown",
      "select",
      "paste",
      "blur",
    ]);

    detach();
    typeTextareaValue(textarea, "teh ");

    expect(textarea.removedListeners).toEqual([
      "blur",
      "paste",
      "select",
      "keydown",
      "input",
      "compositionend",
      "compositionstart",
      "scroll",
    ]);
    expect(typai.calls).toEqual([]);
  });

  it("allows detach to be called twice safely", () => {
    const textarea = createTextarea();
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
    });

    expect(() => {
      detach();
      detach();
    }).not.toThrow();
  });

  it("exposes and updates textarea adapter settings", () => {
    const textarea = createTextarea();
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
      settings: {
        keepCorrectionMarksVisible: false,
      },
    });

    expect(detach.getSettings()).toMatchObject({
      autocorrect: true,
      spellcheck: true,
      keepCorrectionMarksVisible: false,
      usePersonalDictionary: true,
    });

    detach.updateSettings({ autocorrect: false });

    expect(detach.getSettings()).toMatchObject({
      autocorrect: false,
      spellcheck: true,
      keepCorrectionMarksVisible: false,
      usePersonalDictionary: true,
    });
  });

  it("works without a completion controller configured", () => {
    const textarea = createTextarea("hello");
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
    });

    expect(detach.isTextareaGhostVisible()).toBe(false);
    expect(detach.getTextareaGhostText()).toBeNull();
    expect(
      detach.renderTextareaGhostText(" world", {
        text: "hello",
        version: 0,
        selection: { start: 5, end: 5 },
        isComposingIME: false,
      }),
    ).toBe(false);

    detach.clearTextareaGhostText();
    typeTextareaValue(textarea, "hello ");

    expect(textarea.value).toBe("hello ");

    detach();
  });

  it("emits structural completion editor callbacks", () => {
    const textarea = createTextarea();
    const inputSnapshots: unknown[] = [];
    const selectionSnapshots: unknown[] = [];
    const events: string[] = [];
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
      completion: {
        onEditorInput(snapshot) {
          inputSnapshots.push(snapshot);
        },
        onEditorSelectionChange(snapshot) {
          selectionSnapshots.push(snapshot);
        },
        onEditorBlur() {
          events.push("blur");
        },
        onEditorCompositionStart() {
          events.push("compositionstart");
        },
        onCorrectionTransaction() {
          events.push("correction_transaction");
        },
        destroy() {
          events.push("destroy");
        },
      },
    });

    typeTextareaValue(textarea, "hello");
    textarea.selectionStart = 2;
    textarea.selectionEnd = 2;
    textarea.dispatchEvent(new Event("select"));
    textarea.dispatchEvent(new Event("compositionstart"));
    textarea.dispatchEvent(new Event("blur"));
    detach();

    expect(inputSnapshots).toEqual([
      {
        text: "hello",
        version: 1,
        selection: { start: 5, end: 5 },
        isComposingIME: false,
      },
    ]);
    expect(selectionSnapshots).toEqual([
      {
        text: "hello",
        version: 1,
        selection: { start: 2, end: 2 },
        isComposingIME: false,
      },
    ]);
    expect(events).toEqual(["compositionstart", "blur", "destroy"]);
  });

  it("@typai/core does not import completion-remote", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const coreRoot = join(currentDir, "..", "..", "core");
    const files = [...collectSourceFiles(join(coreRoot, "src")), join(coreRoot, "package.json")];
    const combinedSource = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(combinedSource).not.toContain("@typai/completion-remote");
    expect(combinedSource).not.toContain("completion-remote");
  });

  it("fails clearly for a non-textarea element", () => {
    expect(() =>
      attachTextarea({
        textarea: new EventTarget() as HTMLTextAreaElement,
        typai: createStubTypai(),
      }),
    ).toThrow(/HTMLTextAreaElement/);
  });

  it("can import and use @typai/core types", () => {
    const textarea = createTextarea();
    const typai: TypaiCore = createStubTypai();
    const options: AttachTextareaOptions = {
      textarea,
      typai,
    };

    expect(options.typai).toBe(typai);
    expect(typeof typai.checkCompletedToken).toBe("function");
  });

  it("increments document version on input when value changes", () => {
    const textarea = createTextarea();
    const decisions: TextareaDecisionEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onDecision: (event) => decisions.push(event),
    });

    typeTextareaValue(textarea, "form ");
    typeTextareaValue(textarea, "form test ");

    expect(decisions.map((event) => event.snapshot.version)).toEqual([1, 2]);
  });

  it("composition guard prevents decisions during IME composition", () => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const decisions: TextareaDecisionEvent[] = [];

    attachTextarea({
      textarea,
      typai,
      onDecision: (event) => decisions.push(event),
    });

    textarea.dispatchEvent(new Event("compositionstart"));
    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("teh ");
    expect(decisions).toHaveLength(0);
    expect(typai.calls).toEqual([]);
  });

  it("readonly textarea is not mutated or checked", () => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const corrections: TextareaCorrectionEvent[] = [];

    textarea.readOnly = true;
    attachTextarea({
      textarea,
      typai,
      onCorrection: (event) => corrections.push(event),
    });

    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("teh ");
    expect(typai.calls).toEqual([]);
    expect(corrections).toHaveLength(0);
  });

  it("disabled textarea is not mutated or checked", () => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const corrections: TextareaCorrectionEvent[] = [];

    textarea.disabled = true;
    attachTextarea({
      textarea,
      typai,
      onCorrection: (event) => corrections.push(event),
    });

    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("teh ");
    expect(typai.calls).toEqual([]);
    expect(corrections).toHaveLength(0);
  });

  it('"teh " becomes "the " and creates a blue correction mark', () => {
    const textarea = createTextarea();
    const decisions: TextareaDecisionEvent[] = [];
    const corrections: TextareaCorrectionEvent[] = [];
    const marks: TextareaMarkEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onDecision: (event) => decisions.push(event),
      onCorrection: (event) => corrections.push(event),
      onMark: (event) => marks.push(event),
    });

    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("the ");
    expect(textarea.selectionStart).toBe(4);
    expect(textarea.selectionEnd).toBe(4);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.token.text).toBe("teh");
    expect(decisions[0]?.decision).toMatchObject({
      action: "auto_correct",
      original: "teh",
      replacement: "the",
    });
    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.transaction).toMatchObject({
      documentVersion: 2,
      rangeBefore: { start: 0, end: 3, text: "teh" },
      rangeAfter: { start: 0, end: 3, text: "the" },
      original: "teh",
      replacement: "the",
      trigger: "space",
    });
    expect(marks).toEqual([
      expect.objectContaining({
        mark: expect.objectContaining({
          range: { start: 0, end: 3 },
          kind: "blue_applied_correction",
          original: "teh",
          replacement: "the",
        }),
      }),
    ]);
    expect(textarea.value.slice(marks[0]?.mark.range.start, marks[0]?.mark.range.end)).toBe("the");
  });

  it("revert restores the original token exactly and removes the blue mark", () => {
    const textarea = createTextarea();
    const corrections: TextareaCorrectionEvent[] = [];
    const removedMarks: TextareaMarkRemovedEvent[] = [];
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
      onCorrection: (event) => corrections.push(event),
      onMarkRemoved: (event) => removedMarks.push(event),
    });

    typeTextareaValue(textarea, "teh ");

    const transactionId = corrections[0]?.transaction.id;

    expect(transactionId).toEqual(expect.any(String));
    expect(detach.revertTextareaCorrection(transactionId ?? "")).toEqual({ applied: true });
    expect(textarea.value).toBe("teh ");
    expect(removedMarks).toEqual([
      expect.objectContaining({
        mark: expect.objectContaining({
          kind: "blue_applied_correction",
          correctionEventId: transactionId,
        }),
      }),
    ]);
  });

  it('"zzzzword " produces a red mark event', () => {
    const textarea = createTextarea();
    const marks: TextareaMarkEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onMark: (event) => marks.push(event),
    });

    typeTextareaValue(textarea, "zzzzword ");

    expect(textarea.value).toBe("zzzzword ");
    expect(marks).toEqual([
      expect.objectContaining({
        snapshot: expect.objectContaining({ version: 1 }),
        mark: expect.objectContaining({
          range: { start: 0, end: 8 },
          kind: "red_spelling_issue",
          original: "zzzzword",
        }),
      }),
    ]);
  });

  it('"reciept " remains unchanged and creates a red suggestions mark', () => {
    const textarea = createTextarea();
    const marks: TextareaMarkEvent[] = [];
    const corrections: TextareaCorrectionEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onMark: (event) => marks.push(event),
      onCorrection: (event) => corrections.push(event),
    });

    typeTextareaValue(textarea, "reciept ");

    expect(textarea.value).toBe("reciept ");
    expect(corrections).toHaveLength(0);
    expect(marks).toEqual([
      expect.objectContaining({
        mark: expect.objectContaining({
          range: { start: 0, end: 7 },
          kind: "red_spelling_issue",
          original: "reciept",
          suggestions: ["receipt"],
        }),
      }),
    ]);
  });

  it('"form " produces do_nothing decision and no correction', () => {
    const textarea = createTextarea();
    const decisions: TextareaDecisionEvent[] = [];
    const corrections: TextareaCorrectionEvent[] = [];
    const marks: TextareaMarkEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onDecision: (event) => decisions.push(event),
      onCorrection: (event) => corrections.push(event),
      onMark: (event) => marks.push(event),
    });

    typeTextareaValue(textarea, "form ");

    expect(decisions).toEqual([
      expect.objectContaining({
        token: expect.objectContaining({ text: "form" }),
        decision: { action: "do_nothing", reasonCodes: ["KNOWN_VALID_WORD"] },
      }),
    ]);
    expect(corrections).toHaveLength(0);
    expect(marks).toHaveLength(0);
  });

  it.each([
    "user@example.com",
    "/etc/passwd",
    "snake_case_identifier",
  ])('"%s " is protected and does not correct', (tokenText) => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const decisions: TextareaDecisionEvent[] = [];
    const corrections: TextareaCorrectionEvent[] = [];
    const protectedSkips: TextareaProtectedSkipEvent[] = [];

    attachTextarea({
      textarea,
      typai,
      onDecision: (event) => decisions.push(event),
      onCorrection: (event) => corrections.push(event),
      onProtectedSkip: (event) => protectedSkips.push(event),
    });

    typeTextareaValue(textarea, `${tokenText} `);

    expect(textarea.value).toBe(`${tokenText} `);
    expect(typai.calls).toEqual([]);
    expect(decisions).toHaveLength(0);
    expect(corrections).toHaveLength(0);
    expect(protectedSkips).toEqual([
      expect.objectContaining({
        token: expect.objectContaining({ text: tokenText, protected: true }),
      }),
    ]);
  });

  it("protected token completion removes stale marks inside the protected range", () => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const marks: TextareaMarkEvent[] = [];
    const removedMarks: TextareaMarkRemovedEvent[] = [];
    const protectedSkips: TextareaProtectedSkipEvent[] = [];

    typai.checkCompletedToken = (input) => {
      typai.calls.push(input.token);

      if (input.token === "https") {
        return {
          action: "mark_unresolved",
          original: "https",
          suggestions: [],
          mark: "red_spelling_issue",
          reasonCodes: ["UNKNOWN_NON_WORD"],
        };
      }

      return decisionForToken(input.token);
    };

    attachTextarea({
      textarea,
      typai,
      onMark: (event) => marks.push(event),
      onMarkRemoved: (event) => removedMarks.push(event),
      onProtectedSkip: (event) => protectedSkips.push(event),
    });

    typeTextareaValue(textarea, "https:");
    typeTextareaValue(textarea, "https://example.com ");

    expect(marks).toEqual([
      expect.objectContaining({
        mark: expect.objectContaining({
          range: { start: 0, end: 5 },
          kind: "red_spelling_issue",
          original: "https",
        }),
      }),
    ]);
    expect(removedMarks).toEqual([
      expect.objectContaining({
        mark: expect.objectContaining({ id: marks[0]?.mark.id }),
      }),
    ]);
    expect(protectedSkips).toEqual([
      expect.objectContaining({
        token: expect.objectContaining({
          text: "https://example.com",
          protected: true,
        }),
      }),
    ]);
  });

  it("token mismatch prevents correction", () => {
    const textarea = createTextarea();
    const corrections: TextareaCorrectionEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onDecision: () => {
        textarea.value = "tex ";
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
      },
      onCorrection: (event) => corrections.push(event),
    });

    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("tex ");
    expect(corrections).toHaveLength(0);
  });

  it("version mismatch prevents correction", () => {
    const textarea = createTextarea();
    const corrections: TextareaCorrectionEvent[] = [];
    let nestedInputDispatched = false;

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onDecision: () => {
        if (nestedInputDispatched) {
          return;
        }

        nestedInputDispatched = true;
        textarea.value = "teh x";
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(inputEvent("x"));
        textarea.value = "teh ";
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
      },
      onCorrection: (event) => corrections.push(event),
    });

    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("teh ");
    expect(corrections).toHaveLength(0);
  });

  it("non-collapsed selection prevents correction", () => {
    const textarea = createTextarea();
    const typai = createStubTypai();
    const corrections: TextareaCorrectionEvent[] = [];

    attachTextarea({
      textarea,
      typai,
      onCorrection: (event) => corrections.push(event),
    });

    textarea.value = "teh ";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 3;
    textarea.dispatchEvent(inputEvent(" "));

    expect(textarea.value).toBe("teh ");
    expect(typai.calls).toEqual([]);
    expect(corrections).toHaveLength(0);
  });

  it("editing a marked word invalidates the mark", () => {
    const textarea = createTextarea();
    const marks: TextareaMarkEvent[] = [];
    const removedMarks: TextareaMarkRemovedEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onMark: (event) => marks.push(event),
      onMarkRemoved: (event) => removedMarks.push(event),
    });

    typeTextareaValue(textarea, "zzzzword ");
    textarea.value = "zzzzxword ";
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;
    textarea.dispatchEvent(inputEvent("x"));

    expect(marks).toHaveLength(1);
    expect(removedMarks).toEqual([
      expect.objectContaining({
        mark: expect.objectContaining({ id: marks[0]?.mark.id }),
      }),
    ]);
  });

  it("repeated delimiter input does not create duplicate blue marks", () => {
    const textarea = createTextarea();
    const marks: TextareaMarkEvent[] = [];

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      onMark: (event) => marks.push(event),
    });

    typeTextareaValue(textarea, "teh ");
    textarea.dispatchEvent(inputEvent(" "));

    expect(marks.filter((event) => event.mark.kind === "blue_applied_correction")).toHaveLength(1);
  });

  it("textarea.value remains plain text with no markup after correction", () => {
    const textarea = createTextarea();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
    });

    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("the ");
    expect(textarea.value).not.toContain("<");
    expect(textarea.value).not.toContain("span");
  });
});

describe("rangeStillMatches", () => {
  it("returns true when current text and version match", () => {
    const textarea = createTextarea("teh ");

    expect(
      rangeStillMatches({
        textarea,
        range: { start: 0, end: 3 },
        expectedText: "teh",
        version: 1,
        currentVersion: 1,
      }),
    ).toBe(true);
  });

  it("returns false when the text differs", () => {
    const textarea = createTextarea("the ");

    expect(
      rangeStillMatches({
        textarea,
        range: { start: 0, end: 3 },
        expectedText: "teh",
        version: 1,
        currentVersion: 1,
      }),
    ).toBe(false);
  });

  it("returns false when the version differs", () => {
    const textarea = createTextarea("teh ");

    expect(
      rangeStillMatches({
        textarea,
        range: { start: 0, end: 3 },
        expectedText: "teh",
        version: 1,
        currentVersion: 2,
      }),
    ).toBe(false);
  });
});

function createTextarea(value = ""): HTMLTextAreaElement {
  const textarea = new TestTextarea();
  textarea.value = value;
  textarea.selectionStart = value.length;
  textarea.selectionEnd = value.length;

  return textarea as unknown as HTMLTextAreaElement;
}

function typeTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.selectionStart = value.length;
  textarea.selectionEnd = value.length;
  textarea.dispatchEvent(inputEvent(value.at(-1) ?? ""));
}

function inputEvent(data: string): Event {
  const event = new Event("input");
  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

type StubTypai = TypaiCore & {
  calls: string[];
};

function createStubTypai(): StubTypai {
  const calls: string[] = [];

  return {
    calls,
    checkCompletedToken(input) {
      calls.push(input.token);

      return decisionForToken(input.token);
    },
    suggestToken() {
      return { suggestions: [], scores: [], reasonCodes: [] };
    },
    getLoadedDictionaryWordCount() {
      return 0;
    },
    clearLoadedDictionary() {},
    async addToPersonalDictionary() {},
    async removeFromPersonalDictionary() {},
    isInPersonalDictionary() {
      return false;
    },
    async setAlwaysCorrect() {},
    async setNeverCorrect() {},
    async clearCorrectionRule() {},
    getCorrectionRule() {
      return null;
    },
    async exportTypaiMemory() {
      return {
        version: 1,
        exportedAt: new Date(0).toISOString(),
        personalDictionary: [],
        correctionRules: [],
      };
    },
    async importTypaiMemory() {},
    async resetTypaiMemory() {},
  };
}

function decisionForToken(token: string): ReturnType<TypaiCore["checkCompletedToken"]> {
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

  if (token === "zzzzword") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: [],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD"],
    };
  }

  if (token === "reciept") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: ["receipt"],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD", "EDIT_DISTANCE_SUGGESTIONS"],
    };
  }

  return {
    action: "do_nothing",
    reasonCodes: ["KNOWN_VALID_WORD"],
  };
}
