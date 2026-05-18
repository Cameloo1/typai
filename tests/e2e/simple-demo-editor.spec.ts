import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

test("autocorrects a common typo and renders a blue mark", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "teh ");

  await expect(editor).toContainText("the ");
  await expect(blueMark(page)).toHaveText("the");
  await expect(page.getByTestId("correction-count")).toHaveText("1");
});

test("keeps the caret after the trailing delimiter after autocorrect", async ({
  page,
}, testInfo) => {
  await openDemo(page, testInfo);
  await typeInEditor(page, "teh ");

  await expect(blueMark(page)).toHaveText("the");
  await expect.poll(() => getEditorCaretOffset(page)).toBe(4);
});

test("blue correction popover reverts exactly", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "teh ");

  await expect(editor).toContainText("the ");
  await blueMark(page).click();
  await expect(page.getByTestId("blue-popover")).toContainText('Corrected "teh" -> "the"');
  await page.getByTestId("revert-action").click();

  await expect(editor).toHaveText("teh ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("revert-count")).toHaveText("1");
});

test("keyboard opens blue popover, closes it, and reverts", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "teh ");

  await blueMark(page).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("blue-popover")).toBeVisible();
  await expect(page.getByTestId("revert-action")).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("typai-popover")).toBeHidden();
  await expect(blueMark(page)).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("revert-action")).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(editor).toHaveText("teh ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(editor).toBeFocused();
});

test("red suggestion replacement uses C++ suggestion and creates a blue mark", async ({
  page,
}, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "reciept ");

  await expect(editor).toHaveText("reciept ");
  await expect(page.getByTestId("red-mark")).toHaveText("reciept");
  await page.getByTestId("red-mark").click();
  await expect(page.getByTestId("red-popover")).toContainText('Possible spelling issue: "reciept"');
  await expect(page.getByTestId("suggestion-item").filter({ hasText: "receipt" })).toBeVisible();
  await page.getByTestId("suggestion-item").filter({ hasText: "receipt" }).click();

  await expect(editor).toHaveText("receipt ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);
  await expect(page.getByTestId("blue-mark")).toHaveText("receipt");
  await expect.poll(() => getEditorCaretOffset(page)).toBe(7);
});

test("keyboard opens red popover and applies the first suggestion", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "reciept ");

  await page.getByTestId("red-mark").focus();
  await page.keyboard.press("Space");

  await expect(page.getByTestId("red-popover")).toBeVisible();
  await expect(page.getByTestId("suggestion-item").filter({ hasText: "receipt" })).toBeFocused();

  await page.keyboard.press("Enter");

  await expect(editor).toHaveText("receipt ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);
  await expect(page.getByTestId("blue-mark")).toHaveText("receipt");
  await expect(editor).toBeFocused();
});

test("pastes rich clipboard content as plain text", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = page.getByTestId("typai-editor");

  await page.getByTestId("reset-editor").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Reset. Ready.");
  await editor.click();
  await pasteIntoEditor(page, "teh https://example.com ", "<b>teh</b> <a>link</a>");

  await expect(editor).toHaveText("teh https://example.com ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);

  const html = await editor.evaluate((element) => element.innerHTML);
  expect(html).not.toContain("<b>");
  expect(html).not.toContain("<a");
});

test("keeps protected pasted URLs unchanged", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = page.getByTestId("typai-editor");

  await page.getByTestId("reset-editor").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Reset. Ready.");
  await editor.click();
  await pasteIntoEditor(page, "https://example.com ");

  await expect(editor).toHaveText("https://example.com ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("red-mark")).toHaveCount(0);
});

test("add to dictionary persists and suppresses future red marks", async ({ page }, testInfo) => {
  const url = await openDemo(page, testInfo);
  let editor = await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await page.getByTestId("red-mark").click();
  await page.getByTestId("add-dictionary-action").click();
  await expect(page.getByTestId("personal-dictionary-count")).toHaveText("1");

  editor = await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  editor = await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);
});

test("memory export reset and import restores local dictionary", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  let editor = await typeInEditor(page, "zzzzword ");

  await page.getByTestId("red-mark").click();
  await page.getByTestId("add-dictionary-action").click();
  await expect(page.getByTestId("personal-dictionary-count")).toHaveText("1");
  await expect(page.getByTestId("debug-table")).toContainText("add_to_dictionary");

  await page.getByTestId("export-memory").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Memory exported.");

  const exported = await page.evaluate(() => {
    const debug = (
      window as unknown as {
        __typaiDebug?: {
          getLastMemoryExport(): string | null;
        };
      }
    ).__typaiDebug;

    return debug?.getLastMemoryExport() ?? null;
  });

  expect(exported).not.toBeNull();
  if (exported === null) {
    throw new Error("Expected memory export JSON to be captured by the demo debug hook.");
  }
  expect(exported).not.toContain("zzzzword ");

  await page.getByTestId("reset-memory").click();
  await expect(page.getByTestId("personal-dictionary-count")).toHaveText("0");

  editor = await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveText("zzzzword");

  await page.getByTestId("reset-editor").click();
  await page.getByTestId("import-memory-input").setInputFiles({
    name: "typai-memory.json",
    mimeType: "application/json",
    buffer: Buffer.from(exported, "utf8"),
  });
  await expect(page.getByTestId("last-decision")).toHaveText("Memory imported.");
  await expect(page.getByTestId("personal-dictionary-count")).toHaveText("1");
  await expect(page.getByTestId("debug-table")).toContainText("import_memory");

  editor = await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);
});

test("always-correct persists as a TypeScript rule before Wasm", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "teh ");

  await blueMark(page).click();
  await page.getByTestId("always-correct-action").click();
  await expect(page.getByTestId("correction-rules-count")).toHaveText("1");

  await typeInEditor(page, "teh ");

  await expect(editor).toHaveText("the ");
  await expect(blueMark(page)).toHaveText("the");
  await expect(page.getByTestId("last-decision")).toContainText("ALWAYS_CORRECT_RULE");
});

test("never-correct persists and suppresses future autocorrection", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "teh ");

  await blueMark(page).click();
  await page.getByTestId("never-correct-action").click();
  await expect(page.getByTestId("correction-rules-count")).toHaveText("1");

  await typeInEditor(page, "teh ");

  await expect(editor).toHaveText("teh ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("red-mark")).toHaveText("teh");
});

test("IndexedDB persistence can be cleared from the demo", async ({ page }, testInfo) => {
  const url = await openDemo(page, testInfo);
  let editor = await typeInEditor(page, "zzzzword ");

  await page.getByTestId("red-mark").click();
  await page.getByTestId("add-dictionary-action").click();
  await expect(page.getByTestId("personal-dictionary-count")).toHaveText("1");

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  editor = await typeInEditor(page, "zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);

  await page.getByTestId("clear-storage").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Storage cleared. Ready.");
  await expect(page.getByTestId("personal-dictionary-count")).toHaveText("0");

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  editor = await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveText("zzzzword");
});

test("settings can disable autocorrect and spellcheck separately", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = page.getByTestId("typai-editor");

  await page.getByTestId("autocorrect-toggle").uncheck();
  await typeInEditor(page, "teh ");

  await expect(editor).toHaveText("teh ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("red-mark")).toHaveText("teh");

  await page.getByTestId("spellcheck-toggle").uncheck();
  await typeInEditor(page, "zzzzword ");

  await expect(editor).toHaveText("zzzzword ");
  await expect(page.getByTestId("red-mark")).toHaveCount(0);
});

test("does not autocorrect a valid word", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "form ");

  await expect(editor).toHaveText("form ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("correction-count")).toHaveText("0");
  await expect(page.getByTestId("last-decision")).toContainText("do_nothing");
});

test("does not autocorrect an email protected token", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "user@example.com ");

  await expect(editor).toHaveText("user@example.com ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("correction-count")).toHaveText("0");
  await expectProtectedSkipCount(page);
});

test("does not autocorrect a path protected token", async ({ page }, testInfo) => {
  await openDemo(page, testInfo);
  const editor = await typeInEditor(page, "/etc/passwd ");

  await expect(editor).toHaveText("/etc/passwd ");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("correction-count")).toHaveText("0");
  await expectProtectedSkipCount(page);
});

async function openDemo(page: Page, testInfo: TestInfo): Promise<string> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await expect(page.getByTestId("storage-mode")).toHaveValue("indexeddb");
  await page.getByTestId("clear-storage").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Storage cleared. Ready.");

  return url;
}

async function typeInEditor(page: Page, text: string): Promise<Locator> {
  const editor = page.getByTestId("typai-editor");

  await page.getByTestId("reset-editor").click();
  await expect(page.getByTestId("last-decision")).toHaveText("Reset. Ready.");
  await editor.click();
  await page.keyboard.type(text);

  return editor;
}

function blueMark(page: Page): Locator {
  return page.getByTestId("blue-mark");
}

async function pasteIntoEditor(page: Page, plainText: string, html = plainText): Promise<void> {
  await page.getByTestId("typai-editor").evaluate(
    (element, payload) => {
      const event = new Event("paste", {
        bubbles: true,
        cancelable: true,
      });
      const clipboardData = {
        getData(type: string) {
          if (type === "text/plain") {
            return payload.plainText;
          }

          if (type === "text/html") {
            return payload.html;
          }

          return "";
        },
      };

      Object.defineProperty(event, "clipboardData", {
        value: clipboardData,
      });

      element.dispatchEvent(event);
    },
    { plainText, html },
  );
}

async function getEditorCaretOffset(page: Page): Promise<number | null> {
  return page.getByTestId("typai-editor").evaluate((element) => {
    const selection = element.ownerDocument.getSelection();

    if (selection === null || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (!element.contains(range.endContainer)) {
      return null;
    }

    const prefix = element.ownerDocument.createRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(range.endContainer, range.endOffset);

    return prefix.toString().length;
  });
}

async function expectProtectedSkipCount(page: Page): Promise<void> {
  await expect
    .poll(async () => Number(await page.getByTestId("protected-skip-count").textContent()))
    .toBeGreaterThan(0);
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-e2e-${testInfo.workerIndex}-${testInfo.parallelIndex}-${testInfo.title.replaceAll(
    /[^a-z0-9]+/gi,
    "-",
  )}`;
}
