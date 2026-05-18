import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

type DemoGlobal = "__typaiCodeMirrorDemo" | "__typaiCodexMockDemo";

test("CodeMirror demo autocorrects a common typo", async ({ page }, testInfo) => {
  const root = await openCodeMirrorDemo(page, testInfo);

  await typeInCodeMirror(root, page, "__typaiCodeMirrorDemo", "teh ");

  await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", "the ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveText("the");
  await expect(root.getByTestId("codemirror-debug-correction-count")).toHaveText("1");
});

test("CodeMirror demo renders and applies an edit-distance suggestion", async ({
  page,
}, testInfo) => {
  const root = await openCodeMirrorDemo(page, testInfo);

  await typeInCodeMirror(root, page, "__typaiCodeMirrorDemo", "reciept ");

  await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", "reciept ");
  await expect(root.locator(".typai-cm-red-spelling")).toHaveText("reciept");
  await root.getByTestId("codemirror-open-red").click();
  await expect(page.getByTestId("codemirror-red-popover")).toBeVisible();
  const receiptSuggestion = page
    .locator("[data-typai-popover-action='choose-suggestion']")
    .filter({ hasText: "receipt" })
    .first();

  await expect(receiptSuggestion).toBeVisible();
  await receiptSuggestion.click();

  await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", "receipt ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveText("receipt");
});

test("CodeMirror demo skips inline code and fenced code", async ({ page }, testInfo) => {
  const root = await openCodeMirrorDemo(page, testInfo);

  await root.getByTestId("codemirror-mode-markdown").click();
  await typeInCodeMirror(root, page, "__typaiCodeMirrorDemo", "`teh` ");

  await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", "`teh` ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);
  await expect(root.locator(".typai-cm-red-spelling")).toHaveCount(0);

  await typeInCodeMirror(root, page, "__typaiCodeMirrorDemo", "```ts\nteh ");

  await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", "```ts\nteh ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);
  await expect(root.locator(".typai-cm-red-spelling")).toHaveCount(0);
});

test("CodeMirror demo skips URL, email, and path tokens", async ({ page }, testInfo) => {
  const root = await openCodeMirrorDemo(page, testInfo);

  for (const text of ["https://example.com ", "user@example.com ", "/etc/passwd "]) {
    await typeInCodeMirror(root, page, "__typaiCodeMirrorDemo", text);

    await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", text);
    await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);
    await expect(root.locator(".typai-cm-red-spelling")).toHaveCount(0);
  }
});

test("CodeMirror Markdown paragraph prose is corrected", async ({ page }, testInfo) => {
  const root = await openCodeMirrorDemo(page, testInfo);

  await root.getByTestId("codemirror-mode-markdown").click();
  await typeInCodeMirror(root, page, "__typaiCodeMirrorDemo", "Please teh ");

  await expectCodeMirrorText(page, "__typaiCodeMirrorDemo", "Please the ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveText("the");
});

test("Codex mock prose autocorrects while command and code contexts are skipped", async ({
  page,
}, testInfo) => {
  const root = await openCodexMockDemo(page, testInfo);

  await typeInCodeMirror(root, page, "__typaiCodexMockDemo", "Please teh ");

  await expectCodeMirrorText(page, "__typaiCodexMockDemo", "Please the ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveText("the");

  await typeInCodeMirror(root, page, "__typaiCodexMockDemo", "pnpm install teh ");

  await expectCodeMirrorText(page, "__typaiCodexMockDemo", "pnpm install teh ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);

  await typeInCodeMirror(root, page, "__typaiCodexMockDemo", "```bash\nteh ");

  await expectCodeMirrorText(page, "__typaiCodexMockDemo", "```bash\nteh ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);

  await typeInCodeMirror(root, page, "__typaiCodexMockDemo", "/etc/passwd ");

  await expectCodeMirrorText(page, "__typaiCodexMockDemo", "/etc/passwd ");
  await expect(root.locator(".typai-cm-blue-corrected")).toHaveCount(0);
});

test("Codex mock run is local-only and no completion UI appears", async ({ page }, testInfo) => {
  const suspiciousRequests: string[] = [];

  page.on("request", (request) => {
    const url = request.url();

    if (/completion-remote|openai|provider-endpoint|ghost-text/i.test(url)) {
      suspiciousRequests.push(url);
    }
  });

  const root = await openCodexMockDemo(page, testInfo);

  await typeInCodeMirror(root, page, "__typaiCodexMockDemo", "Please teh ");
  await root.getByTestId("codex-mock-run").click();

  await expect(root.getByTestId("codex-mock-output")).toContainText("Mock run only");
  await expect(root.getByTestId("codex-mock-output")).toContainText("No Codex APIs called");
  await expect(page.locator(".typai-cm-ghost-text")).toHaveCount(0);
  await expect(page.locator(".typai-cm-ghostText")).toHaveCount(0);
  expect(suspiciousRequests).toEqual([]);
});

async function openCodeMirrorDemo(page: Page, testInfo: TestInfo): Promise<Locator> {
  await openDemoTab(page, testInfo, "CodeMirror Demo");

  const root = page.getByTestId("codemirror-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");

  return root;
}

async function openCodexMockDemo(page: Page, testInfo: TestInfo): Promise<Locator> {
  await openDemoTab(page, testInfo, "Codex Mock Demo");

  const root = page.getByTestId("codex-mock-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");
  await expect(root.getByTestId("codex-mock-label")).toHaveText("Codex mock only");

  return root;
}

async function openDemoTab(page: Page, testInfo: TestInfo, tabName: string): Promise<void> {
  const url = `/?storage=memory&typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByRole("button", { name: tabName }).click();
}

async function typeInCodeMirror(
  root: Locator,
  page: Page,
  globalName: DemoGlobal,
  text: string,
): Promise<void> {
  await page.evaluate((debugName) => {
    const debug = (window as unknown as Record<DemoGlobal, { reset(): void } | undefined>)[
      debugName as DemoGlobal
    ];

    debug?.reset();
  }, globalName);
  await expectCodeMirrorText(page, globalName, "");
  await root.locator(".cm-content").click();
  await page.keyboard.type(text);
}

async function expectCodeMirrorText(
  page: Page,
  globalName: DemoGlobal,
  expected: string,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((debugName) => {
        const debug = (window as unknown as Record<DemoGlobal, { getText(): string } | undefined>)[
          debugName as DemoGlobal
        ];

        return debug?.getText() ?? null;
      }, globalName),
    )
    .toBe(expected);
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-codemirror-e2e-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}
