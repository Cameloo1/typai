// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCorrectionPopover,
  createDebugTable,
  createEscapeKeyHandler,
  createSettingsPanel,
  createSpellingPopover,
  createTypaiLiveRegion,
  ensureTypaiUiStyles,
  focusFirstAction,
  restoreFocus,
} from "../src/index";

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe("@typai/ui", () => {
  it("renders correction popover actions and calls callbacks", () => {
    const actions = {
      revert: vi.fn(),
      alwaysCorrect: vi.fn(),
      neverCorrect: vi.fn(),
      addOriginalToDictionary: vi.fn(),
      close: vi.fn(),
    };
    const popover = createCorrectionPopover({
      data: {
        original: "teh",
        replacement: "the",
      },
      actions,
    });

    expect(popover.element.getAttribute("role")).toBe("dialog");
    expect(popover.element.textContent).toContain('Corrected "teh" -> "the".');
    expect(buttonTexts(popover.element)).toEqual([
      "Revert",
      "Always correct",
      "Don't correct again",
      "Add original to dictionary",
      "Close",
    ]);

    clickButton(popover.element, "Revert");
    expect(actions.revert).toHaveBeenCalledTimes(1);
    expect(document.body.contains(popover.element)).toBe(false);
  });

  it("renders spelling suggestions and actions", () => {
    const chooseSuggestion = vi.fn();
    const actions = {
      chooseSuggestion,
      ignoreOnce: vi.fn(),
      addToDictionary: vi.fn(),
      disableAutocorrect: vi.fn(),
      close: vi.fn(),
    };
    const popover = createSpellingPopover({
      data: {
        original: "reciept",
        suggestions: ["receipt", "recipe"],
      },
      actions,
    });

    expect(popover.element.getAttribute("aria-label")).toBe("Typai spelling actions");
    expect(buttonTexts(popover.element)).toEqual([
      "receipt",
      "recipe",
      "Ignore once",
      "Add to dictionary",
      "Disable autocorrect",
      "Close",
    ]);

    clickButton(popover.element, "receipt");
    expect(chooseSuggestion).toHaveBeenCalledWith("receipt");
    expect(document.body.contains(popover.element)).toBe(false);
  });

  it("closes popovers on Escape", () => {
    const close = vi.fn();
    const popover = createCorrectionPopover({
      data: {
        original: "teh",
        replacement: "the",
      },
      actions: {
        revert: vi.fn(),
        alwaysCorrect: vi.fn(),
        neverCorrect: vi.fn(),
        addOriginalToDictionary: vi.fn(),
        close,
      },
    });

    popover.element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.body.contains(popover.element)).toBe(false);
  });

  it("focus helper focuses the first action and restoreFocus returns focus", () => {
    const before = document.createElement("button");
    const popover = createCorrectionPopover({
      data: {
        original: "teh",
        replacement: "the",
      },
      actions: {
        revert: vi.fn(),
        alwaysCorrect: vi.fn(),
        neverCorrect: vi.fn(),
        addOriginalToDictionary: vi.fn(),
        close: vi.fn(),
      },
    });

    document.body.appendChild(before);
    before.focus();

    const focused = focusFirstAction(popover.element);

    expect(focused?.textContent).toBe("Revert");
    expect(document.activeElement).toBe(focused);

    expect(restoreFocus(before)).toBe(true);
    expect(document.activeElement).toBe(before);
  });

  it("Escape helper removes listeners through cleanup", () => {
    const target = document.createElement("div");
    const onEscape = vi.fn();
    const cleanup = createEscapeKeyHandler(target, onEscape);

    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    cleanup();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("settings panel toggles callbacks", () => {
    const onChange = vi.fn();
    const panel = createSettingsPanel({
      settings: {
        autocorrect: true,
        spellcheck: true,
        keepCorrectionMarksVisible: true,
        usePersonalDictionary: true,
      },
      onChange,
    });

    document.body.appendChild(panel.element);
    const autocorrect = panel.element.querySelector<HTMLInputElement>(
      "[data-typai-setting='autocorrect']",
    );

    expect(autocorrect).not.toBeNull();
    autocorrect.checked = false;
    autocorrect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({
      changedKey: "autocorrect",
      settings: {
        autocorrect: false,
        spellcheck: true,
        keepCorrectionMarksVisible: true,
        usePersonalDictionary: true,
      },
    });

    panel.update({ spellcheck: false });
    expect(
      panel.element.querySelector<HTMLInputElement>("[data-typai-setting='spellcheck']")?.checked,
    ).toBe(false);
  });

  it("debug table renders summary values and rows", () => {
    const table = createDebugTable({
      data: {
        correctionCount: 2,
        unresolvedCount: 1,
        revertCount: 1,
        protectedSkipCount: 3,
        latenciesMs: [0.5, 1.5, 2.5],
        recentEvents: [
          {
            time: "12:00",
            source: "textarea",
            action: "correction",
            outcome: "blue",
            reasonCodes: ["COMMON_TYPO_MATCH"],
            latencyMs: 1.5,
          },
        ],
      },
    });

    expect(table.element.textContent).toContain("Corrections");
    expect(table.element.textContent).toContain("2");
    expect(table.element.querySelectorAll("[data-typai-debug-row]")).toHaveLength(1);
    expect(table.element.textContent).not.toContain("ghost");
    expect(table.element.textContent).not.toContain("remote completion");
  });

  it("live region announces text", () => {
    const region = createTypaiLiveRegion();

    region.announce("Correction reverted.");

    expect(region.element.getAttribute("aria-live")).toBe("polite");
    expect(region.element.textContent).toBe("Correction reverted.");
  });

  it("destroy removes DOM nodes and style utilities are idempotent", () => {
    const region = createTypaiLiveRegion();
    const panel = createSettingsPanel({
      settings: {
        autocorrect: true,
        spellcheck: true,
        keepCorrectionMarksVisible: false,
        usePersonalDictionary: true,
      },
      onChange: vi.fn(),
    });
    const style = ensureTypaiUiStyles();

    document.body.appendChild(panel.element);
    expect(document.head.contains(style)).toBe(true);
    expect(ensureTypaiUiStyles()).toBe(style);

    region.destroy();
    panel.destroy();

    expect(document.body.contains(region.element)).toBe(false);
    expect(document.body.contains(panel.element)).toBe(false);
  });
});

function buttonTexts(element: HTMLElement): string[] {
  return [...element.querySelectorAll("button")].map((button) => button.textContent ?? "");
}

function clickButton(element: HTMLElement, label: string): void {
  const button = [...element.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );

  if (button === undefined) {
    throw new Error(`Missing button ${label}.`);
  }

  button.click();
}
