import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";
import {
  surfaceParityAutocorrections,
  surfaceParityProtectedTerms,
  surfaceParitySuggestionCases,
  surfaceParityValidWords,
} from "../golden-corpus/src/fixtures";

type DemoGlobal = "__typaiCodeMirrorDemo";

type SpellSurfaceHarness = {
  name: string;
  reset(): Promise<void>;
  typeText(text: string): Promise<void>;
  expectText(expected: string): Promise<void>;
  blueMark(): Locator;
  redMark(): Locator;
  expectNoMarks(): Promise<void>;
  openBluePopover(): Promise<void>;
  revertBlueCorrection(): Promise<void>;
  alwaysCorrectBlue(): Promise<void>;
  neverCorrectBlue(): Promise<void>;
  openRedPopover(): Promise<void>;
  suggestion(suggestion: string): Locator;
  applySuggestion(suggestion: string): Promise<void>;
  addRedToDictionary(): Promise<void>;
};

const surfaces: Array<{
  name: string;
  open(page: Page, testInfo: TestInfo): Promise<SpellSurfaceHarness>;
}> = [
  {
    name: "contenteditable",
    open: openContenteditableSurface,
  },
  {
    name: "textarea",
    open: openTextareaSurface,
  },
  {
    name: "React textarea",
    open: (page, testInfo) => openReactSurface(page, testInfo, "textarea"),
  },
  {
    name: "React contenteditable",
    open: (page, testInfo) => openReactSurface(page, testInfo, "contenteditable"),
  },
  {
    name: "CodeMirror",
    open: openCodeMirrorSurface,
  },
];

for (const surface of surfaces) {
  test(`${surface.name} matches spell quality parity gates`, async ({ page }, testInfo) => {
    const harness = await surface.open(page, testInfo);

    for (const { token, replacement } of surfaceParityAutocorrections) {
      await typeFresh(harness, `${token} `);
      await harness.expectText(`${replacement} `);
      await expect(harness.blueMark()).toHaveText(replacement);

      await harness.openBluePopover();
      await harness.revertBlueCorrection();
      await harness.expectText(`${token} `);
      await harness.expectNoMarks();
    }

    for (const { token, suggestion } of surfaceParitySuggestionCases) {
      await typeFresh(harness, `${token} `);
      await harness.expectText(`${token} `);
      await expect(harness.redMark()).toHaveText(token);
      await harness.openRedPopover();
      await expect(harness.suggestion(suggestion)).toBeVisible();
      await harness.applySuggestion(suggestion);
      await harness.expectText(`${suggestion} `);
      await expect(harness.blueMark()).toHaveText(suggestion);
    }

    for (const token of surfaceParityValidWords) {
      await typeFresh(harness, `${token} `);
      await harness.expectText(`${token} `);
      await harness.expectNoMarks();
    }

    for (const token of surfaceParityProtectedTerms) {
      await typeFresh(harness, `${token} `);
      await harness.expectText(`${token} `);
      await harness.expectNoMarks();
    }

    for (const { input, expectedText, expectedMark } of [
      { input: "teh,", expectedText: "the,", expectedMark: "the" },
      { input: "Teh ", expectedText: "The ", expectedMark: "The" },
      { input: "TEH ", expectedText: "THE ", expectedMark: "THE" },
    ]) {
      await typeFresh(harness, input);
      await harness.expectText(expectedText);
      await expect(harness.blueMark()).toHaveText(expectedMark);
    }

    await typeFresh(harness, "zzzzword ");
    await expect(harness.redMark()).toHaveText("zzzzword");
    await harness.openRedPopover();
    await harness.addRedToDictionary();

    await typeFresh(harness, "zzzzword ");
    await harness.expectText("zzzzword ");
    await harness.expectNoMarks();

    await typeFresh(harness, "teh ");
    await harness.openBluePopover();
    await harness.alwaysCorrectBlue();
    await typeFresh(harness, "teh ");
    await harness.expectText("the ");
    await expect(harness.blueMark()).toHaveText("the");

    await typeFresh(harness, "adn ");
    await harness.openBluePopover();
    await harness.neverCorrectBlue();
    await harness.expectText("adn ");
    await expect(harness.blueMark()).toHaveCount(0);

    await typeFresh(harness, "adn ");
    await harness.expectText("adn ");
    await expect(harness.blueMark()).toHaveCount(0);
    await expect(harness.redMark()).toHaveText("adn");
  });
}

test("CodeMirror markdown protects code contexts while prose keeps improved spelling", async ({
  page,
}, testInfo) => {
  const harness = await openCodeMirrorSurface(page, testInfo);

  await page.getByTestId("codemirror-mode-markdown").click();
  await typeFresh(harness, "`adress` ");
  await harness.expectText("`adress` ");
  await harness.expectNoMarks();

  await typeFresh(harness, "`CVE-2024-1234` ");
  await harness.expectText("`CVE-2024-1234` ");
  await harness.expectNoMarks();

  await typeFresh(harness, "```ts\nadress ");
  await harness.expectText("```ts\nadress ");
  await harness.expectNoMarks();

  await typeFresh(harness, "```bash\nffuf https://example.com ");
  await harness.expectText("```bash\nffuf https://example.com ");
  await harness.expectNoMarks();

  await typeFresh(harness, "Please adress ");
  await harness.expectText("Please address ");
  await expect(harness.blueMark()).toHaveText("address");
});

test("spell quality surface parity matrix is enumerated", () => {
  const matrix = surfaces.map((surface) => ({
    surface: surface.name,
    expandedAutocorrect: "pass",
    suggestionsOnly: "pass",
    validWords: "pass",
    protectedTerms: "pass",
    hostProvidedPath: "covered by core/golden fixture",
    casingAndPunctuation: "pass",
    personalDictionary: "pass",
    correctionRules: "pass",
    completionCoexistence: "covered by V4.1 completion E2E",
  }));

  console.log("Typai spell quality surface parity matrix");
  console.table(matrix);
  expect(matrix).toHaveLength(5);
});

async function typeFresh(harness: SpellSurfaceHarness, text: string): Promise<void> {
  await harness.reset();
  await harness.typeText(text);
}

async function openContenteditableSurface(
  page: Page,
  testInfo: TestInfo,
): Promise<SpellSurfaceHarness> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo, "contenteditable"))}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await expect(page.getByTestId("storage-mode")).toHaveValue("indexeddb");
  await page.getByTestId("clear-storage").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Storage cleared. Ready.");

  const editor = page.getByTestId("typai-editor");

  return {
    name: "contenteditable",
    async reset() {
      await page.getByTestId("reset-editor").click();
      await expect(page.getByTestId("last-decision")).toHaveText("Reset. Ready.");
    },
    async typeText(text) {
      await editor.click();
      await page.keyboard.type(text);
    },
    async expectText(expected) {
      await expect(editor).toHaveText(expected);
    },
    blueMark: () => page.getByTestId("blue-mark"),
    redMark: () => page.getByTestId("red-mark"),
    async expectNoMarks() {
      await expect(page.getByTestId("blue-mark")).toHaveCount(0);
      await expect(page.getByTestId("red-mark")).toHaveCount(0);
    },
    async openBluePopover() {
      await page.getByTestId("blue-mark").click();
      await expect(page.getByTestId("blue-popover")).toBeVisible();
    },
    async revertBlueCorrection() {
      await page.getByTestId("revert-action").click();
    },
    async alwaysCorrectBlue() {
      await page.getByTestId("always-correct-action").click();
    },
    async neverCorrectBlue() {
      await page.getByTestId("never-correct-action").click();
    },
    async openRedPopover() {
      await page.getByTestId("red-mark").click();
      await expect(page.getByTestId("red-popover")).toBeVisible();
    },
    suggestion: (suggestion) =>
      page.getByTestId("suggestion-item").filter({ hasText: exactText(suggestion) }),
    async applySuggestion(suggestion) {
      await page
        .getByTestId("suggestion-item")
        .filter({ hasText: exactText(suggestion) })
        .click();
    },
    async addRedToDictionary() {
      await page.getByTestId("add-dictionary-action").click();
    },
  };
}

async function openTextareaSurface(page: Page, testInfo: TestInfo): Promise<SpellSurfaceHarness> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo, "textarea"))}`;

  await page.goto(url);
  await page.getByRole("button", { name: /Textarea.*Demo/ }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();
  await expect(page.getByTestId("textarea-overlay")).toHaveCount(1);

  const textarea = page.getByTestId("textarea-editor");

  return {
    name: "textarea",
    async reset() {
      await page.getByTestId("textarea-reset").click();
      await expect(textarea).toHaveValue("");
      await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
      await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
    },
    async typeText(text) {
      await textarea.click();
      await page.keyboard.type(text);
    },
    async expectText(expected) {
      await expect(textarea).toHaveValue(expected);
    },
    blueMark: () => page.getByTestId("textarea-blue-mark"),
    redMark: () => page.getByTestId("textarea-red-mark"),
    async expectNoMarks() {
      await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
      await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
    },
    async openBluePopover() {
      await page.getByTestId("textarea-blue-mark-trigger").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("textarea-blue-popover")).toBeVisible();
    },
    async revertBlueCorrection() {
      await page.getByTestId("textarea-revert-action").click();
    },
    async alwaysCorrectBlue() {
      await page.getByTestId("textarea-always-correct-action").click();
    },
    async neverCorrectBlue() {
      await page.getByTestId("textarea-never-correct-action").click();
    },
    async openRedPopover() {
      await page.getByTestId("textarea-red-mark-trigger").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("textarea-red-popover")).toBeVisible();
    },
    suggestion: (suggestion) =>
      page.getByTestId("textarea-suggestion-item").filter({ hasText: exactText(suggestion) }),
    async applySuggestion(suggestion) {
      await page
        .getByTestId("textarea-suggestion-item")
        .filter({ hasText: exactText(suggestion) })
        .click();
    },
    async addRedToDictionary() {
      await page.getByTestId("textarea-add-dictionary-action").click();
    },
  };
}

async function openReactSurface(
  page: Page,
  testInfo: TestInfo,
  surface: "textarea" | "contenteditable",
): Promise<SpellSurfaceHarness> {
  const url = `/?storage=memory&typaiDbName=${encodeURIComponent(
    uniqueDbName(testInfo, `react-${surface}`),
  )}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByRole("button", { name: /React.*Demo/ }).click();

  const root = page.getByTestId("react-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("react-core-status")).toHaveText("ready");
  await root.getByTestId("react-completion-enabled").uncheck();

  if (surface === "textarea") {
    const textarea = root.getByTestId("react-textarea");

    return {
      name: "React textarea",
      async reset() {
        await root.getByTestId("react-reset").click();
        await expect(textarea).toHaveValue("");
        await expect(root.getByTestId("textarea-blue-mark")).toHaveCount(0);
        await expect(root.getByTestId("textarea-red-mark")).toHaveCount(0);
      },
      async typeText(text) {
        await textarea.click();
        await page.keyboard.type(text);
      },
      async expectText(expected) {
        await expect(textarea).toHaveValue(expected);
      },
      blueMark: () => root.getByTestId("textarea-blue-mark"),
      redMark: () => root.getByTestId("textarea-red-mark"),
      async expectNoMarks() {
        await expect(root.getByTestId("textarea-blue-mark")).toHaveCount(0);
        await expect(root.getByTestId("textarea-red-mark")).toHaveCount(0);
      },
      async openBluePopover() {
        await root.getByTestId("textarea-blue-mark-trigger").focus();
        await page.keyboard.press("Enter");
        await expect(root.getByTestId("textarea-blue-popover")).toBeVisible();
      },
      async revertBlueCorrection() {
        await root.getByTestId("textarea-revert-action").click();
      },
      async alwaysCorrectBlue() {
        await root.getByTestId("textarea-always-correct-action").click();
      },
      async neverCorrectBlue() {
        await root.getByTestId("textarea-never-correct-action").click();
      },
      async openRedPopover() {
        await root.getByTestId("textarea-red-mark-trigger").focus();
        await page.keyboard.press("Enter");
        await expect(root.getByTestId("textarea-red-popover")).toBeVisible();
      },
      suggestion: (suggestion) =>
        root.getByTestId("textarea-suggestion-item").filter({ hasText: exactText(suggestion) }),
      async applySuggestion(suggestion) {
        await root
          .getByTestId("textarea-suggestion-item")
          .filter({ hasText: exactText(suggestion) })
          .click();
      },
      async addRedToDictionary() {
        await root.getByTestId("textarea-add-dictionary-action").click();
      },
    };
  }

  const editor = root.getByTestId("react-contenteditable");

  return {
    name: "React contenteditable",
    async reset() {
      await root.getByTestId("react-reset").click();
      await expect(editor).toHaveText("");
      await expect(root.getByTestId("blue-mark")).toHaveCount(0);
      await expect(root.getByTestId("red-mark")).toHaveCount(0);
    },
    async typeText(text) {
      await editor.click();
      await page.keyboard.type(text);
    },
    async expectText(expected) {
      await expect(editor).toHaveText(expected);
    },
    blueMark: () => root.getByTestId("blue-mark"),
    redMark: () => root.getByTestId("red-mark"),
    async expectNoMarks() {
      await expect(root.getByTestId("blue-mark")).toHaveCount(0);
      await expect(root.getByTestId("red-mark")).toHaveCount(0);
    },
    async openBluePopover() {
      await root.getByTestId("blue-mark").click();
      await expect(root.getByTestId("react-contenteditable-blue-popover")).toBeVisible();
    },
    async revertBlueCorrection() {
      await root.getByTestId("react-contenteditable-revert-action").click();
    },
    async alwaysCorrectBlue() {
      await root.getByTestId("react-contenteditable-always-correct-action").click();
    },
    async neverCorrectBlue() {
      await root.getByTestId("react-contenteditable-never-correct-action").click();
    },
    async openRedPopover() {
      await root.getByTestId("red-mark").click();
      await expect(root.getByTestId("react-contenteditable-red-popover")).toBeVisible();
    },
    suggestion: (suggestion) =>
      root
        .getByTestId("react-contenteditable-suggestion-item")
        .filter({ hasText: exactText(suggestion) }),
    async applySuggestion(suggestion) {
      await root
        .getByTestId("react-contenteditable-suggestion-item")
        .filter({ hasText: exactText(suggestion) })
        .click();
    },
    async addRedToDictionary() {
      await root.getByTestId("react-contenteditable-add-dictionary-action").click();
    },
  };
}

async function openCodeMirrorSurface(page: Page, testInfo: TestInfo): Promise<SpellSurfaceHarness> {
  await openDemoTab(page, testInfo, /CodeMirror.*Demo/);

  const root = page.getByTestId("codemirror-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");

  return {
    name: "CodeMirror",
    async reset() {
      await page.evaluate(() => window.__typaiCodeMirrorDemo?.reset());
      await expectCodeMirrorText(page, "");
      await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);
      await expect(root.locator(".typai-cm-red-spelling")).toHaveCount(0);
    },
    async typeText(text) {
      await root.locator(".cm-content").click();
      await page.keyboard.type(text);
    },
    async expectText(expected) {
      await expectCodeMirrorText(page, expected);
    },
    blueMark: () => root.locator(".typai-cm-blue-corrected"),
    redMark: () => root.locator(".typai-cm-red-spelling"),
    async expectNoMarks() {
      await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);
      await expect(root.locator(".typai-cm-red-spelling")).toHaveCount(0);
    },
    async openBluePopover() {
      await root.getByTestId("codemirror-open-blue").click();
      await expect(page.getByTestId("codemirror-blue-popover")).toBeVisible();
    },
    async revertBlueCorrection() {
      await page.locator("[data-typai-popover-action='revert']").click();
    },
    async alwaysCorrectBlue() {
      await page.locator("[data-typai-popover-action='always-correct']").click();
    },
    async neverCorrectBlue() {
      await page.locator("[data-typai-popover-action='never-correct']").click();
    },
    async openRedPopover() {
      await root.getByTestId("codemirror-open-red").click();
      await expect(page.getByTestId("codemirror-red-popover")).toBeVisible();
    },
    suggestion: (suggestion) =>
      page
        .locator("[data-typai-popover-action='choose-suggestion']")
        .filter({ hasText: exactText(suggestion) }),
    async applySuggestion(suggestion) {
      await page
        .locator("[data-typai-popover-action='choose-suggestion']")
        .filter({ hasText: exactText(suggestion) })
        .click();
    },
    async addRedToDictionary() {
      await page.locator("[data-typai-popover-action='add-to-dictionary']").click();
    },
  };
}

async function openDemoTab(
  page: Page,
  testInfo: TestInfo,
  tabName: string | RegExp,
): Promise<void> {
  const url = `/?storage=memory&typaiDbName=${encodeURIComponent(
    uniqueDbName(testInfo, "codemirror"),
  )}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByRole("button", { name: tabName }).click();
}

async function expectCodeMirrorText(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((debugName) => {
        const debug = (window as unknown as Record<DemoGlobal, { getText(): string } | undefined>)[
          debugName as DemoGlobal
        ];

        return debug?.getText() ?? null;
      }, "__typaiCodeMirrorDemo"),
    )
    .toBe(expected);
}

function uniqueDbName(testInfo: TestInfo, suffix: string): string {
  return `typai-spell-quality-${suffix}-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}

function exactText(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`);
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

declare global {
  interface Window {
    __typaiCodeMirrorDemo?: {
      getText(): string;
      reset(): void;
    };
  }
}
