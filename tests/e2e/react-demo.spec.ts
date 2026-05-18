import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

test("React TypaiTextarea autocorrects a common typo", async ({ page }, testInfo) => {
  const root = await openReactDemo(page, testInfo);
  const textarea = await typeInReactTextarea(root, page, "teh ");

  await expect(textarea).toHaveValue("the ");
  await expect(root.getByTestId("textarea-blue-mark")).toHaveText("the");
  await expect(textarea).toBeFocused();
});

test("React TypaiTextarea renders a red suggestion for edit-distance candidates", async ({
  page,
}, testInfo) => {
  const root = await openReactDemo(page, testInfo);
  const textarea = await typeInReactTextarea(root, page, "reciept ");

  await expect(textarea).toHaveValue("reciept ");
  await expect(root.getByTestId("textarea-red-mark")).toHaveText("reciept");

  await root.getByTestId("textarea-red-mark-trigger").focus();
  await page.keyboard.press("Enter");
  await expect(root.getByTestId("textarea-red-popover")).toBeVisible();
  await expect(
    root.getByTestId("textarea-suggestion-item").filter({ hasText: "receipt" }),
  ).toBeVisible();
});

test("React TypaiContenteditable autocorrects a common typo", async ({ page }, testInfo) => {
  const root = await openReactDemo(page, testInfo);
  const editor = root.getByTestId("react-contenteditable");

  await resetReactDemo(root);
  await editor.click();
  await page.keyboard.type("teh ");

  await expect(editor).toHaveText("the ");
});

test("React settings toggle disables autocorrect", async ({ page }, testInfo) => {
  const root = await openReactDemo(page, testInfo);
  const textarea = root.getByTestId("react-textarea");

  await root.getByLabel("Autocorrect").uncheck();
  await typeInReactTextarea(root, page, "teh ");

  await expect(textarea).toHaveValue("teh ");
  await expect(root.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(root.getByTestId("textarea-red-mark")).toHaveText("teh");
});

test("React demo uses provider-created core", async ({ page }, testInfo) => {
  const root = await openReactDemo(page, testInfo);

  await expect(root.getByTestId("react-core-status")).toHaveText("ready");
  await typeInReactTextarea(root, page, "form ");

  await expect(root.getByTestId("react-textarea")).toHaveValue("form ");
  await expect(root.getByTestId("textarea-blue-mark")).toHaveCount(0);
});

test("React re-render does not duplicate textarea adapter overlay attachment", async ({
  page,
}, testInfo) => {
  const root = await openReactDemo(page, testInfo);

  await expect(root.locator("[data-typai-textarea-overlay-root]")).toHaveCount(1);
  await expect(root.getByTestId("react-render-count")).toHaveText("1");

  await root.getByTestId("react-rerender").click();

  await expect(root.getByTestId("react-render-count")).toHaveText("2");
  await expect(root.locator("[data-typai-textarea-overlay-root]")).toHaveCount(1);
});

test("React demo does not use remote completion package or provider endpoints", async ({
  page,
}, testInfo) => {
  const suspiciousRequests: string[] = [];
  const root = await openReactDemo(page, testInfo);

  page.on("request", (request) => {
    const url = request.url();

    if (/completion-remote|openai|provider-endpoint|ghost-text/i.test(url)) {
      suspiciousRequests.push(url);
    }
  });

  await typeInReactTextarea(root, page, "teh ");
  expect(suspiciousRequests).toEqual([]);
});

async function openReactDemo(page: Page, testInfo: TestInfo): Promise<Locator> {
  const url = `/?storage=memory&typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByRole("button", { name: /React.*Demo/ }).click();

  const root = page.getByTestId("react-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("react-core-status")).toHaveText("ready");
  await expect(root.locator("[data-typai-textarea-overlay-root]")).toHaveCount(1);

  return root;
}

async function typeInReactTextarea(root: Locator, page: Page, text: string): Promise<Locator> {
  const textarea = root.getByTestId("react-textarea");

  await resetReactDemo(root);
  await textarea.click();
  await page.keyboard.type(text);

  return textarea;
}

async function resetReactDemo(root: Locator): Promise<void> {
  const textarea = root.getByTestId("react-textarea");

  await root.getByTestId("react-reset").click();
  await expect(textarea).toHaveValue("");
  await expect(root.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(root.getByTestId("textarea-red-mark")).toHaveCount(0);
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-react-e2e-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}
