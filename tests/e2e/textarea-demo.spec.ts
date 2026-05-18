import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

test("textarea autocorrects a common typo and renders a blue overlay mark", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = await typeInTextarea(page, "teh ");

  await expect(textarea).toHaveValue("the ");
  await expect(textarea).toBeFocused();
  await expect(textareaBlueMark(page)).toHaveText("the");
  await expect(textareaBlueMark(page)).toHaveCSS("text-decoration-style", "dotted");
  expect(await textarea.inputValue()).not.toContain("<span");
});

test("textarea blue popover reverts the correction exactly", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = await typeInTextarea(page, "teh ");

  await openBlueTextareaPopover(page);
  await page.getByTestId("textarea-revert-action").click();

  await expect(textarea).toHaveValue("teh ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(textarea).toBeFocused();
});

test("textarea red unresolved mark applies a suggestion and creates a blue mark", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = await typeInTextarea(page, "reciept ");

  await expect(textarea).toHaveValue("reciept ");
  await expect(textareaRedMark(page)).toHaveText("reciept");
  await expect(textareaRedMark(page)).toHaveCSS("text-decoration-style", "wavy");

  await openRedTextareaPopover(page);
  await expect(page.getByTestId("textarea-red-popover")).toContainText(
    'Possible spelling issue: "reciept"',
  );
  await expect(textareaSuggestion(page, "receipt")).toBeVisible();
  await textareaSuggestion(page, "receipt").click();

  await expect(textarea).toHaveValue("receipt ");
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
  await expect(textareaBlueMark(page)).toHaveText("receipt");
});

test("textarea leaves valid words unchanged", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = await typeInTextarea(page, "form ");

  await expect(textarea).toHaveValue("form ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("textarea-debug-correction-count")).toHaveText("0");
});

test("textarea leaves protected tokens unchanged", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);

  for (const token of [
    "user@example.com",
    "https://example.com",
    "/etc/passwd",
    "snake_case_identifier",
    "CVE-2024-1234",
  ]) {
    const textarea = await typeInTextarea(page, `${token} `);

    await expect(textarea).toHaveValue(`${token} `);
    await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
    await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
    await expect(page.getByTestId("textarea-debug-correction-count")).toHaveText("0");
    await expect
      .poll(async () =>
        Number(await page.getByTestId("textarea-debug-protected-skip-count").textContent()),
      )
      .toBeGreaterThan(0);
  }
});

test("textarea overlay scroll position follows the native textarea", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await resetTextarea(page);
  await textarea.evaluate((element) => {
    const lines = Array.from({ length: 80 }, (_, index) => `line ${index + 1}`);

    element.value = lines.join("\n");
    element.selectionStart = element.value.length;
    element.selectionEnd = element.value.length;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await textarea.click();
  await textarea.evaluate((element) => {
    element.selectionStart = element.value.length;
    element.selectionEnd = element.value.length;
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("teh ");
  await expect(textarea).toHaveValue(/the $/);
  await expect(textareaBlueMark(page)).toHaveText("the");

  const scrollState = await textarea.evaluate((element) => {
    const overlay = element.parentElement?.querySelector<HTMLElement>(
      "[data-testid='textarea-overlay']",
    );

    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));

    return {
      textareaScrollTop: element.scrollTop,
      overlayScrollTop: overlay?.scrollTop ?? -1,
    };
  });

  expect(scrollState.textareaScrollTop).toBeGreaterThan(0);
  expect(
    Math.abs(scrollState.textareaScrollTop - scrollState.overlayScrollTop),
  ).toBeLessThanOrEqual(1);
});

test("textarea autocorrects on a second line", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await resetTextarea(page);
  await textarea.click();
  await page.keyboard.type("hello");
  await page.keyboard.press("Enter");
  await page.keyboard.type("teh ");

  await expect(textarea).toHaveValue("hello\nthe ");
  await expect(textareaBlueMark(page)).toHaveText("the");
  await expect(textareaBlueMark(page)).toHaveAttribute("data-typai-range-start", "6");
});

test("textarea settings disable autocorrect and spellcheck independently", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await page.getByTestId("textarea-autocorrect-toggle").uncheck();
  await typeInTextarea(page, "teh ");

  await expect(textarea).toHaveValue("teh ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(textareaRedMark(page)).toHaveText("teh");

  await page.getByTestId("textarea-spellcheck-toggle").uncheck();
  await typeInTextarea(page, "zzzzword ");

  await expect(textarea).toHaveValue("zzzzword ");
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
});

test("textarea personal dictionary persists through reload and reset", async ({
  page,
}, testInfo) => {
  const url = await openTextareaDemo(page, testInfo);
  let textarea = await typeInTextarea(page, "zzzzword ");

  await expect(textarea).toHaveValue("zzzzword ");
  await openRedTextareaPopover(page);
  await page.getByTestId("textarea-add-dictionary-action").click();
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);

  textarea = await typeInTextarea(page, "zzzzword ");
  await expect(textarea).toHaveValue("zzzzword ");
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);

  await page.goto(url);
  await showTextareaDemo(page);
  textarea = await typeInTextarea(page, "zzzzword ");
  await expect(textarea).toHaveValue("zzzzword ");
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);

  await page.getByTestId("textarea-reset-memory").click();
  await expect(page.locator("[data-textarea-last-decision]")).toHaveText("Textarea memory reset.");

  await page.goto(url);
  await showTextareaDemo(page);
  textarea = await typeInTextarea(page, "zzzzword ");
  await expect(textareaRedMark(page)).toHaveText("zzzzword");
});

test("chat input sends the corrected textarea value", async ({ page }, testInfo) => {
  await openChatDemo(page, testInfo);
  const input = page.getByTestId("chat-input");

  await input.click();
  await page.keyboard.type("teh message ");

  await expect(input).toHaveValue("the message ");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("sent-message")).toHaveText("the message");
  await expect(input).toHaveValue("");
});

test("textarea native form submit reads corrected value and reset resyncs overlay", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = await typeInTextarea(page, "teh ");

  await expect(textarea).toHaveValue("the ");
  await page.getByTestId("textarea-form-submit").click();
  await expect(page.getByTestId("textarea-submit-value")).toHaveText("the ");

  await page.getByTestId("textarea-form-reset").click();
  await expect(textarea).toHaveValue("");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("textarea-overlay")).toHaveText("");
  await expect(page.getByTestId("textarea-submit-value")).toHaveText("-");
});

test("textarea readonly and disabled states prevent adapter mutation", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await resetTextarea(page);
  await textarea.evaluate((element) => {
    element.readOnly = true;
    element.value = "teh ";
    element.selectionStart = element.value.length;
    element.selectionEnd = element.value.length;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: " " }));
  });
  await expect(textarea).toHaveValue("teh ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("textarea-debug-correction-count")).toHaveText("0");

  await textarea.evaluate((element) => {
    element.readOnly = false;
    element.disabled = true;
    element.value = "teh ";
    element.selectionStart = element.value.length;
    element.selectionEnd = element.value.length;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: " " }));
  });
  await expect(textarea).toHaveValue("teh ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("textarea-debug-correction-count")).toHaveText("0");
});

test("textarea placeholder remains and overlay tracks resize", async ({ page }, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await resetTextarea(page);
  await expect(textarea).toHaveAttribute("placeholder", "Type here...");
  await expect(page.getByTestId("textarea-overlay")).toHaveText("");

  const resizeState = await textarea.evaluate((element) => {
    const root = element.parentElement;
    const overlay = root?.querySelector<HTMLElement>("[data-testid='textarea-overlay']");

    element.style.height = "180px";
    window.dispatchEvent(new Event("resize"));

    return {
      rootHeight: root?.style.height ?? "",
      overlayComputedHeight: overlay ? getComputedStyle(overlay).height : "",
      offsetHeight: element.offsetHeight,
    };
  });

  expect(resizeState.offsetHeight).toBeGreaterThanOrEqual(170);
  expect(resizeState.rootHeight).toBe(`${resizeState.offsetHeight}px`);
  expect(resizeState.overlayComputedHeight).toBe(`${resizeState.offsetHeight}px`);
});

test("textarea keyboard path opens red popover, escapes, and applies suggestion", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = await typeInTextarea(page, "reciept ");

  await page.getByTestId("textarea-red-mark-trigger").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("textarea-red-popover")).toBeVisible();
  await textareaSuggestion(page, "receipt").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("textarea-red-popover")).toHaveCount(0);
  await expect(textarea).toBeFocused();

  await page.getByTestId("textarea-red-mark-trigger").focus();
  await page.keyboard.press("Enter");
  await textareaSuggestion(page, "receipt").focus();
  await page.keyboard.press("Enter");

  await expect(textarea).toHaveValue("receipt ");
  await expect(textareaBlueMark(page)).toHaveText("receipt");
});

test("textarea composition smoke does not correct during IME composition", async ({
  page,
}, testInfo) => {
  await openTextareaDemo(page, testInfo);
  const textarea = page.getByTestId("textarea-editor");

  await resetTextarea(page);
  await textarea.click();
  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { data: "teh" }));
    element.value = "teh ";
    element.selectionStart = element.value.length;
    element.selectionEnd = element.value.length;
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: " ",
        inputType: "insertCompositionText",
      }),
    );
  });

  await expect(textarea).toHaveValue("teh ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);

  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { data: "teh" }));
  });

  await expect(textarea).toHaveValue("teh ");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
});

async function openTextareaDemo(page: Page, testInfo: TestInfo): Promise<string> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}`;

  await page.goto(url);
  await showTextareaDemo(page);

  return url;
}

async function openChatDemo(page: Page, testInfo: TestInfo): Promise<void> {
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}&storage=memory`;

  await page.goto(url);
  await page.getByRole("button", { name: "Chat Input Demo" }).click();
  await expect(page.getByTestId("chat-demo-root")).toBeVisible();
  await expect(
    page.locator("[data-testid='chat-demo-root'] [data-typai-textarea-overlay='mirror']"),
  ).toHaveCount(1);
}

async function showTextareaDemo(page: Page): Promise<void> {
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await expect(page.locator("[data-textarea-last-decision]")).toHaveText("Ready.");
  await page.getByRole("button", { name: "Textarea Demo" }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();
  await expect(page.getByTestId("textarea-overlay")).toHaveCount(1);
}

async function typeInTextarea(page: Page, text: string): Promise<Locator> {
  const textarea = page.getByTestId("textarea-editor");

  await resetTextarea(page);
  await textarea.click();
  await page.keyboard.type(text);

  return textarea;
}

async function resetTextarea(page: Page): Promise<void> {
  const textarea = page.getByTestId("textarea-editor");

  await page.getByTestId("textarea-reset").click();
  await expect(textarea).toHaveValue("");
  await expect(page.getByTestId("textarea-blue-mark")).toHaveCount(0);
  await expect(page.getByTestId("textarea-red-mark")).toHaveCount(0);
}

async function openBlueTextareaPopover(page: Page): Promise<void> {
  await page.getByTestId("textarea-blue-mark-trigger").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("textarea-blue-popover")).toBeVisible();
}

async function openRedTextareaPopover(page: Page): Promise<void> {
  await page.getByTestId("textarea-red-mark-trigger").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("textarea-red-popover")).toBeVisible();
}

function textareaBlueMark(page: Page): Locator {
  return page.getByTestId("textarea-blue-mark");
}

function textareaRedMark(page: Page): Locator {
  return page.getByTestId("textarea-red-mark");
}

function textareaSuggestion(page: Page, suggestion: string): Locator {
  return page.getByTestId("textarea-suggestion-item").filter({ hasText: suggestion });
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-textarea-e2e-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}
