import { expect, type Page, type TestInfo, test } from "@playwright/test";

type RectSnapshot = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type TextareaGhostSnapshot = {
  textareaValue: string;
  ghostText: string;
  offset: number;
  ghostRect: RectSnapshot;
  caretRect: RectSnapshot | null;
  deltaLeft: number | null;
  deltaTop: number | null;
};

type TextareaGhostRendererWindow = Window & {
  __typaiTextareaGhostRenderer?: {
    render(text: string, offset?: number): TextareaGhostSnapshot;
    resync(offset?: number): TextareaGhostSnapshot;
    clear(): void;
    getSnapshot(): TextareaGhostSnapshot | null;
  };
};

test("textarea ghost renderer is visual-only and excluded from form submission", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");
  const value = "Complete this prompt";

  await setTextareaValue(page, value);
  const snapshot = await renderGhost(page, " with ghost text.", value.length);
  const ghost = page.getByTestId("textarea-ghost-text");

  await expect(ghost).toHaveText(" with ghost text.");
  await expect(ghost).toHaveAttribute("aria-hidden", "true");
  await expect(ghost).not.toHaveAttribute("data-typai-mark-kind", /.+/);
  await expect(textarea).toHaveValue(value);
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
  expectWithinCaretTolerance(snapshot);

  await page.getByTestId("textarea-form-submit").click();

  await expect(page.getByTestId("textarea-submit-value")).toHaveText(value);
  await expect(textarea).toHaveValue(value);
});

test("textarea ghost renderer clears on editor invalidators", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await setTextareaValue(page, "typing");
  await renderGhost(page, " ghost", "typing".length);
  await textarea.click();
  await page.keyboard.type("x");
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);

  await setTextareaValue(page, "escape");
  await renderGhost(page, " ghost", "escape".length);
  await textarea.click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);

  await setTextareaValue(page, "selection");
  await renderGhost(page, " ghost", "selection".length);
  await textarea.evaluate((element) => {
    element.setSelectionRange(0, 0);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);

  await setTextareaValue(page, "composition");
  await renderGhost(page, " ghost", "composition".length);
  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { data: "c" }));
  });
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);
  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { data: "composition" }));
  });

  await setTextareaValue(page, "blur");
  await renderGhost(page, " ghost", "blur".length);
  await textarea.evaluate((element) => {
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  });
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);

  await setTextareaValue(page, "paste");
  await renderGhost(page, " ghost", "paste".length);
  await textarea.evaluate((element) => {
    element.dispatchEvent(new Event("paste", { bubbles: true }));
  });
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);
});

test("textarea correction transactions clear ghost text", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await setTextareaValue(page, "teh");
  await renderGhost(page, " ghost", 3);
  await textarea.click();
  await page.keyboard.type(" ");

  await expect(textarea).toHaveValue("the ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveText("the");
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);
});

test("stale textarea ghost snapshots are blocked", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  await setTextareaValue(page, "fresh");

  const rendered = await page.evaluate(() => {
    const renderer = (window as TextareaGhostRendererWindow).__typaiTextareaGhostRenderer;

    try {
      renderer?.render(" stale", 0);
      return true;
    } catch {
      return false;
    }
  });

  expect(rendered).toBe(false);
  await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);
});

async function openTextareaDemo(page: Page, testInfo: TestInfo): Promise<void> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}&storage=memory`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await expect(page.locator("[data-textarea-last-decision]")).toHaveText("Ready.");
  await page.getByRole("button", { name: "Textarea Demo" }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();
  await expect(page.getByTestId("textarea-overlay")).toHaveCount(1);
}

async function setTextareaValue(page: Page, value: string): Promise<void> {
  const textarea = page.getByTestId("textarea-editor");

  await textarea.evaluate((element, nextValue) => {
    element.value = nextValue;
    element.selectionStart = nextValue.length;
    element.selectionEnd = nextValue.length;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await expect(textarea).toHaveValue(value);
}

async function renderGhost(
  page: Page,
  text: string,
  offset: number,
): Promise<TextareaGhostSnapshot> {
  const snapshot = await page.evaluate(
    (input) =>
      (window as TextareaGhostRendererWindow).__typaiTextareaGhostRenderer?.render(
        input.text,
        input.offset,
      ) ?? null,
    { text, offset },
  );

  if (snapshot === null) {
    throw new Error("Textarea ghost renderer debug hook is unavailable.");
  }

  return snapshot;
}

function expectWithinCaretTolerance(snapshot: TextareaGhostSnapshot): void {
  expect(snapshot.caretRect).toBeTruthy();
  expect(Math.abs(snapshot.deltaLeft ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(3);
  expect(Math.abs(snapshot.deltaTop ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(3);
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-textarea-ghost-renderer-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}
