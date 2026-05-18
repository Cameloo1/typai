import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

test("demo initial state has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);

  await expectNoSeriousAxeViolations(page);
});

test("blue popover open state has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await typeInEditor(page, "teh ");
  await page.getByTestId("blue-mark").click();
  await expect(page.getByTestId("blue-popover")).toBeVisible();

  await expectNoSeriousAxeViolations(page);
});

test("red popover open state has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await typeInEditor(page, "reciept ");
  await page.getByTestId("red-mark").click();
  await expect(page.getByTestId("red-popover")).toBeVisible();

  await expectNoSeriousAxeViolations(page);
});

test("settings and memory controls have no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);

  await expectNoSeriousAxeViolations(page, [".settings-panel", ".memory-panel"]);
});

test("textarea demo has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await page.getByRole("button", { name: "Textarea Demo" }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();

  await expectNoSeriousAxeViolations(page, ["[data-testid='textarea-demo-root']"]);
});

test("chat input demo has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await page.getByRole("button", { name: "Chat Input Demo" }).click();
  await expect(page.getByTestId("chat-demo-root")).toBeVisible();

  await expectNoSeriousAxeViolations(page, ["[data-testid='chat-demo-root']"]);
});

test("React demo has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await page.getByRole("button", { name: "React Demo" }).click();
  await expect(page.getByTestId("react-demo-root")).toBeVisible();
  await expect(page.getByTestId("react-core-status")).toHaveText("ready");

  await expectNoSeriousAxeViolations(page, ["[data-testid='react-demo-root']"]);
});

test("CodeMirror demo has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await page.getByRole("button", { name: "CodeMirror Demo" }).click();
  const root = page.getByTestId("codemirror-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");
  await expectNoSeriousAxeViolations(page, ["[data-testid='codemirror-demo-root']"]);
});

test("Codex mock demo has no serious axe violations", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  await page.getByRole("button", { name: "Codex Mock Demo" }).click();
  const root = page.getByTestId("codex-mock-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");
  await expectNoSeriousAxeViolations(page, ["[data-testid='codex-mock-demo-root']"]);
});

async function openDemo(page: Page, testInfo: TestInfo): Promise<void> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByTestId("clear-storage").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Storage cleared. Ready.");
}

async function typeInEditor(page: Page, text: string): Promise<void> {
  const editor = page.getByTestId("typai-editor");

  await page.getByTestId("reset-editor").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Reset. Ready.");
  await editor.click();
  await page.keyboard.type(text);
}

async function expectNoSeriousAxeViolations(page: Page, includes: string[] = []): Promise<void> {
  let builder = new AxeBuilder({ page });

  for (const selector of includes) {
    builder = builder.include(selector);
  }

  const results = await builder.analyze();
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    seriousViolations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-a11y-${testInfo.workerIndex}-${testInfo.parallelIndex}-${testInfo.title.replaceAll(
    /[^a-z0-9]+/gi,
    "-",
  )}`;
}
