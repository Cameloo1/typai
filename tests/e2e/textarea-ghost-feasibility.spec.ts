import { expect, type Page, type TestInfo, test } from "@playwright/test";

type RectSnapshot = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type TextareaGhostFeasibilitySnapshot = {
  textareaValue: string;
  ghostText: string;
  offset: number;
  ghostRect: RectSnapshot;
  caretRect: RectSnapshot | null;
  deltaLeft: number | null;
  deltaTop: number | null;
};

type TextareaGhostFeasibilityWindow = Window & {
  __typaiTextareaGhostFeasibility?: {
    render(text: string, offset?: number): TextareaGhostFeasibilitySnapshot;
    resync(offset?: number): TextareaGhostFeasibilitySnapshot;
    clear(): void;
    getSnapshot(): TextareaGhostFeasibilitySnapshot | null;
  };
};

test("textarea ghost renderer tracks caret geometry without mutating value", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");
  const value = [
    ...Array.from({ length: 32 }, (_, index) => `line ${index + 1}`),
    "Known caret anchor",
  ].join("\n");
  const offset = value.length;

  await textarea.evaluate(
    (element, next) => {
      element.value = next.value;
      element.selectionStart = next.offset;
      element.selectionEnd = next.offset;
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    },
    { value, offset },
  );

  const initial = await renderGhost(page, " with a renderer ghost.", offset);

  await expect(page.getByTestId("textarea-ghost-text")).toHaveText(" with a renderer ghost.");
  await expect(textarea).toHaveValue(value);
  expectWithinCaretTolerance(initial);

  const scrolled = await textarea.evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollTop - 28);
    element.dispatchEvent(new Event("scroll", { bubbles: true }));

    return (
      (window as TextareaGhostFeasibilityWindow).__typaiTextareaGhostFeasibility?.getSnapshot() ??
      null
    );
  });

  expect(scrolled).not.toBeNull();
  expect(scrolled?.textareaValue).toBe(value);
  expectWithinCaretTolerance(scrolled);

  const resized = await textarea.evaluate((element) => {
    element.style.height = "180px";
    window.dispatchEvent(new Event("resize"));

    return (
      (window as TextareaGhostFeasibilityWindow).__typaiTextareaGhostFeasibility?.resync() ?? null
    );
  });

  expect(resized).not.toBeNull();
  expect(resized?.textareaValue).toBe(value);
  expectWithinCaretTolerance(resized);

  await page.evaluate(() => {
    (window as TextareaGhostFeasibilityWindow).__typaiTextareaGhostFeasibility?.clear();
  });
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);
  await expect(textarea).toHaveValue(value);
});

async function openTextareaDemo(page: Page, testInfo: TestInfo): Promise<void> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}&storage=memory`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await expect(page.locator("[data-textarea-last-decision]")).toHaveText("Ready.");
  await page.getByRole("button", { name: /Textarea.*Demo/ }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();
  await expect(page.getByTestId("textarea-overlay")).toHaveCount(1);
}

async function renderGhost(
  page: Page,
  text: string,
  offset: number,
): Promise<TextareaGhostFeasibilitySnapshot> {
  const snapshot = await page.evaluate(
    (input) =>
      (window as TextareaGhostFeasibilityWindow).__typaiTextareaGhostFeasibility?.render(
        input.text,
        input.offset,
      ) ?? null,
    { text, offset },
  );

  if (snapshot === null) {
    throw new Error("Textarea ghost feasibility debug hook is unavailable.");
  }

  return snapshot;
}

function expectWithinCaretTolerance(
  snapshot: TextareaGhostFeasibilitySnapshot | null | undefined,
): void {
  expect(snapshot).toBeTruthy();
  expect(snapshot?.caretRect).toBeTruthy();
  expect(Math.abs(snapshot?.deltaLeft ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(3);
  expect(Math.abs(snapshot?.deltaTop ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(3);
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-textarea-ghost-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}
