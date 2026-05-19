import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

type CompletionMetrics = {
  status: string;
  requestCount: number;
  ghostShownCount: number;
  acceptedCount: number;
  dismissedCount: number;
  revertedCount: number;
  providerErrorCount: number;
  staleResponseDroppedCount: number;
  p95GhostLatencyMs: number | null;
  lastEvent: string;
};

type RemoteMetrics = {
  requestCount: number;
  ghostShownCount: number;
  acceptCount: number;
  dismissCount: number;
  dismissByTypingCount: number;
  dismissByEscapeCount: number;
  dismissBySelectionChangeCount: number;
  dismissByBlurCount: number;
  dismissByCompositionCount: number;
  revertCount: number;
  staleResponseDroppedCount: number;
  providerErrorCount: number;
  staleResponseDroppedRequestIds: string[];
  ghostLatencySamples: number[];
};

type NetworkGuard = {
  providerCalls: string[];
  secretLeaks: string[];
};

type CompletionSurface = {
  name: string;
  tabName: string | RegExp;
  rootTestId: string;
  expectedCompletion: string;
  prefix: string;
  open(page: Page, testInfo: TestInfo): Promise<CompletionHarness>;
};

type CompletionHarness = {
  root: Locator;
  ghost(): Locator;
  reset(): Promise<void>;
  typeText(text: string): Promise<void>;
  getSourceText(): Promise<string>;
  pressTab(): Promise<void>;
  revert(): Promise<void>;
  dismissByEscape(): Promise<void>;
  dismissBySelectionChange(): Promise<void>;
  getMetrics(): Promise<CompletionMetrics>;
  setLatencyMs(value: number): Promise<void>;
  setIgnoreAbortForProvider(value: boolean): Promise<void>;
  failNextRequest(): Promise<void>;
  setCompletionText?(text: string): Promise<void>;
  getCompletionTransactionCount?(): Promise<number>;
};

const surfaces: CompletionSurface[] = [
  {
    name: "contenteditable completion",
    tabName: "V4 Remote Completion",
    rootTestId: "remote-completion-demo-root",
    expectedCompletion: " with e2e contenteditable completion.",
    prefix: "Draft a mocked contenteditable paragraph",
    open: openContenteditableCompletionDemo,
  },
  {
    name: "textarea completion",
    tabName: /Textarea.*Demo/,
    rootTestId: "textarea-demo-root",
    expectedCompletion: " with e2e textarea completion.",
    prefix: "Draft a mocked textarea paragraph",
    open: openTextareaCompletionDemo,
  },
  {
    name: "React textarea completion",
    tabName: /React.*Demo/,
    rootTestId: "react-demo-root",
    expectedCompletion: " with mocked React textarea completion.",
    prefix: "Draft a mocked React textarea paragraph",
    open: (page, testInfo) => openReactCompletionDemo(page, testInfo, "textarea"),
  },
  {
    name: "React contenteditable completion",
    tabName: /React.*Demo/,
    rootTestId: "react-demo-root",
    expectedCompletion: " with mocked React contenteditable completion.",
    prefix: "Draft a mocked React contenteditable paragraph",
    open: (page, testInfo) => openReactCompletionDemo(page, testInfo, "contenteditable"),
  },
  {
    name: "CodeMirror completion",
    tabName: /CodeMirror.*Demo/,
    rootTestId: "codemirror-demo-root",
    expectedCompletion: " with e2e CodeMirror completion.",
    prefix: "Draft a mocked CodeMirror paragraph",
    open: openCodeMirrorCompletionDemo,
  },
];

for (const surface of surfaces) {
  test.describe(surface.name, () => {
    test("ghost, accept, revert, dismiss, correction, metrics, and no real calls", async ({
      page,
    }, testInfo) => {
      const guard = await installProviderCallGuard(page);
      const harness = await surface.open(page, testInfo);

      await harness.setLatencyMs(50);
      await harness.setCompletionText?.(surface.expectedCompletion);

      await showSurfaceGhost(harness, surface.prefix, surface.expectedCompletion);
      await expect.poll(() => harness.getSourceText()).toBe(surface.prefix);
      await expectMetricAtLeast(harness, "requestCount", 1);
      await expectMetricAtLeast(harness, "ghostShownCount", 1);

      await harness.dismissByEscape();
      await expect(harness.ghost()).toHaveCount(0);
      await expect.poll(() => harness.getSourceText()).toBe(surface.prefix);
      await expectMetricAtLeast(harness, "dismissedCount", 1);

      await showSurfaceGhost(harness, surface.prefix, surface.expectedCompletion);
      await page.keyboard.type("x");
      await expect(harness.ghost()).toHaveCount(0, { timeout: 250 });
      await expect.poll(() => harness.getSourceText()).toBe(`${surface.prefix}x`);

      await showSurfaceGhost(harness, surface.prefix, surface.expectedCompletion);
      await harness.dismissBySelectionChange();
      await expect(harness.ghost()).toHaveCount(0, { timeout: 250 });
      await expect.poll(() => harness.getSourceText()).toBe(surface.prefix);

      await showSurfaceGhost(harness, surface.prefix, surface.expectedCompletion);
      await harness.pressTab();
      await expect(harness.ghost()).toHaveCount(0);
      await expect
        .poll(() => harness.getSourceText())
        .toBe(`${surface.prefix}${surface.expectedCompletion}`);
      await expectMetricAtLeast(harness, "acceptedCount", 1);

      if (harness.getCompletionTransactionCount !== undefined) {
        await expect.poll(() => harness.getCompletionTransactionCount?.()).toBe(1);
      }

      await harness.revert();
      await expect.poll(() => harness.getSourceText()).toBe(surface.prefix);
      await expectMetricAtLeast(harness, "revertedCount", 1);

      await showSurfaceGhost(harness, "Please correct this", surface.expectedCompletion);
      await page.keyboard.type(" teh ");
      await expect(harness.ghost()).toHaveCount(0, { timeout: 250 });
      await expect.poll(() => harness.getSourceText()).toContain(" the ");

      expect(guard.providerCalls).toEqual([]);
      expect(guard.secretLeaks).toEqual([]);
      await expectNoSecretsInDom(page);
    });

    test("stale response is dropped and provider error does not mutate text", async ({
      page,
    }, testInfo) => {
      const guard = await installProviderCallGuard(page);
      const harness = await surface.open(page, testInfo);

      await harness.setCompletionText?.(` with stale ${surface.name} {requestId}.`);
      await harness.setLatencyMs(1_200);
      await harness.setIgnoreAbortForProvider(true);
      await harness.reset();
      await harness.typeText(surface.prefix);
      await expectMetricAtLeast(harness, "requestCount", 1);
      await expectStatus(harness, "requesting");
      await page.keyboard.type("x");
      await expectMetricAtLeast(harness, "staleResponseDroppedCount", 1, 4_000);
      await expect.poll(() => harness.getSourceText()).toBe(`${surface.prefix}x`);

      await harness.setIgnoreAbortForProvider(false);
      await harness.setLatencyMs(50);
      await harness.reset();
      await harness.failNextRequest();
      await harness.typeText(surface.prefix);
      await expectMetricAtLeast(harness, "providerErrorCount", 1, 4_000);
      await expect(harness.ghost()).toHaveCount(0);
      await expect.poll(() => harness.getSourceText()).toBe(surface.prefix);

      expect(guard.providerCalls).toEqual([]);
      expect(guard.secretLeaks).toEqual([]);
      await expectNoSecretsInDom(page);
    });
  });
}

test("CodeMirror completion is prose-only for protected Markdown contexts", async ({
  page,
}, testInfo) => {
  const guard = await installProviderCallGuard(page);
  const harness = await openCodeMirrorCompletionDemo(page, testInfo);

  await harness.setLatencyMs(50);
  await showSurfaceGhost(harness, "Ordinary prose can complete", harnessSurface("CodeMirror"));
  await expect(harness.ghost()).toHaveText(harnessSurface("CodeMirror"));

  await harness.reset();
  await harness.typeText("`inline code stays protected");
  await expect(harness.ghost()).toHaveCount(0, { timeout: 1_000 });

  await harness.reset();
  await harness.typeText("```ts\nfenced code stays protected");
  await expect(harness.ghost()).toHaveCount(0, { timeout: 1_000 });

  expect(guard.providerCalls).toEqual([]);
  expect(guard.secretLeaks).toEqual([]);
});

test("React completion rerender does not duplicate listeners and disable cleans up ghosts", async ({
  page,
}, testInfo) => {
  const guard = await installProviderCallGuard(page);
  const harness = await openReactCompletionDemo(page, testInfo, "textarea");

  await showSurfaceGhost(
    harness,
    "React rerender listener check",
    harnessSurface("React textarea"),
  );
  await harness.root.getByTestId("react-rerender").click();
  await expect(harness.root.getByTestId("react-render-count")).toHaveText("2");
  await expect(harness.root.locator("[data-typai-textarea-overlay-root]")).toHaveCount(1);

  await harness.root.getByTestId("react-completion-enabled").uncheck();
  await expect(harness.ghost()).toHaveCount(0);
  await harness.reset();
  await harness.typeText("Completion disabled text");
  await expect(harness.ghost()).toHaveCount(0, { timeout: 1_000 });
  await expect.poll(() => harness.getSourceText()).toBe("Completion disabled text");

  expect(guard.providerCalls).toEqual([]);
  expect(guard.secretLeaks).toEqual([]);
});

async function showSurfaceGhost(
  harness: CompletionHarness,
  prefix: string,
  expectedCompletion: string,
): Promise<void> {
  await harness.reset();
  await harness.typeText(prefix);
  await expect(harness.ghost()).toHaveText(expectedCompletion, { timeout: 5_000 });
}

async function openContenteditableCompletionDemo(
  page: Page,
  testInfo: TestInfo,
): Promise<CompletionHarness> {
  await openDemoTab(page, testInfo, "V4 Remote Completion");
  const root = page.getByTestId("remote-completion-demo-root");

  await expect(root).toBeVisible();
  await expect(page.getByTestId("remote-status")).toHaveText(/idle|scheduled|requesting|showing/);
  await setRemoteCompletionText(page, " with e2e contenteditable completion.");
  await setRemoteLatency(page, 50);
  await page.getByTestId("remote-reset").click();

  return {
    root,
    ghost: () => page.locator("[data-testid='remote-completion-editor'] [data-typai-ghost='true']"),
    async reset() {
      await page.getByTestId("remote-reset").click();
      await expect
        .poll(() => getContenteditableSourceText(page, "remote-completion-editor"))
        .toBe("");
    },
    async typeText(text) {
      await page.getByTestId("remote-completion-editor").click();
      await page.keyboard.type(text);
    },
    getSourceText: () => getContenteditableSourceText(page, "remote-completion-editor"),
    async pressTab() {
      await page.keyboard.press("Tab");
    },
    async revert() {
      await page.getByTestId("remote-revert").click();
    },
    async dismissByEscape() {
      await page.keyboard.press("Escape");
    },
    async dismissBySelectionChange() {
      await moveContenteditableCaretToStart(page, "remote-completion-editor");
    },
    getMetrics: () => getRemoteCompletionMetrics(page),
    async setLatencyMs(value) {
      await setRemoteLatency(page, value);
    },
    async setIgnoreAbortForProvider(value) {
      await page.evaluate((nextValue) => {
        window.__typaiRemoteCompletionDebug?.setIgnoreAbortForProvider(nextValue);
      }, value);
    },
    async failNextRequest() {
      await page.evaluate(() => {
        window.__typaiRemoteCompletionDebug?.failNextRequest();
      });
    },
    setCompletionText: (text) => setRemoteCompletionText(page, text),
  };
}

async function openTextareaCompletionDemo(
  page: Page,
  testInfo: TestInfo,
): Promise<CompletionHarness> {
  await openDemoTab(page, testInfo, /Textarea.*Demo/);
  const root = page.getByTestId("textarea-demo-root");
  const textarea = page.getByTestId("textarea-editor");

  await expect(root).toBeVisible();
  await expect(page.getByTestId("textarea-overlay")).toHaveCount(1);
  await page.getByTestId("textarea-completion-text").fill(" with e2e textarea completion.");
  await page.evaluate(() => window.__typaiTextareaCompletionDebug?.setLatencyMs(50));

  return {
    root,
    ghost: () => page.getByTestId("textarea-ghost-text"),
    async reset() {
      await page.getByTestId("textarea-reset").click();
      await expect(textarea).toHaveValue("");
    },
    async typeText(text) {
      await textarea.click();
      await page.keyboard.type(text);
    },
    getSourceText: () => textarea.inputValue(),
    async pressTab() {
      await page.keyboard.press("Tab");
    },
    async revert() {
      await page.getByTestId("textarea-revert-completion").click();
    },
    async dismissByEscape() {
      await page.keyboard.press("Escape");
    },
    async dismissBySelectionChange() {
      await page.keyboard.press("Home");
    },
    getMetrics: () =>
      page
        .evaluate(() => window.__typaiTextareaCompletionDebug?.getMetrics() ?? null)
        .then(requireMetrics),
    async setLatencyMs(value) {
      await page.evaluate(
        (nextValue) => window.__typaiTextareaCompletionDebug?.setLatencyMs(nextValue),
        value,
      );
    },
    async setIgnoreAbortForProvider(value) {
      await page.evaluate(
        (nextValue) => window.__typaiTextareaCompletionDebug?.setIgnoreAbortForProvider(nextValue),
        value,
      );
    },
    async failNextRequest() {
      await page.evaluate(() => window.__typaiTextareaCompletionDebug?.failNextRequest());
    },
    async setCompletionText(text) {
      await page.getByTestId("textarea-completion-text").fill(text);
    },
  };
}

async function openReactCompletionDemo(
  page: Page,
  testInfo: TestInfo,
  surface: "textarea" | "contenteditable",
): Promise<CompletionHarness> {
  await openDemoTab(page, testInfo, /React.*Demo/);
  const root = page.getByTestId("react-demo-root");
  const textarea = root.getByTestId("react-textarea");
  const editor = root.getByTestId("react-contenteditable");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("react-core-status")).toHaveText("ready");
  await page.evaluate(() => window.__typaiReactDebug?.setCompletionLatencyMs(50));

  const isTextarea = surface === "textarea";

  return {
    root,
    ghost: () =>
      isTextarea
        ? root.getByTestId("textarea-ghost-text")
        : editor.locator("[data-typai-ghost='true']"),
    async reset() {
      await root.getByTestId("react-reset").click();
      if (isTextarea) {
        await expect(textarea).toHaveValue("");
      } else {
        await expect(editor).toHaveText("");
      }
    },
    async typeText(text) {
      await (isTextarea ? textarea : editor).click();
      await page.keyboard.type(text);
    },
    getSourceText: () =>
      isTextarea
        ? textarea.inputValue()
        : getContenteditableSourceText(page, "react-contenteditable"),
    async pressTab() {
      await page.keyboard.press("Tab");
    },
    async revert() {
      await root.getByTestId("react-revert-completion").click();
    },
    async dismissByEscape() {
      await page.keyboard.press("Escape");
    },
    async dismissBySelectionChange() {
      if (isTextarea) {
        await page.keyboard.press("Home");
        return;
      }

      await moveContenteditableCaretToStart(page, "react-contenteditable");
    },
    async getMetrics() {
      const metrics = await page.evaluate((surfaceName) => {
        const allMetrics = window.__typaiReactDebug?.getCompletionMetrics() ?? null;

        if (allMetrics === null) {
          return null;
        }

        return surfaceName === "textarea" ? allMetrics.textarea : allMetrics.contenteditable;
      }, surface);

      return requireMetrics(metrics);
    },
    async setLatencyMs(value) {
      await page.evaluate(
        (nextValue) => window.__typaiReactDebug?.setCompletionLatencyMs(nextValue),
        value,
      );
    },
    async setIgnoreAbortForProvider(value) {
      await page.evaluate(
        (nextValue) => window.__typaiReactDebug?.setIgnoreAbortForProvider(nextValue),
        value,
      );
    },
    async failNextRequest() {
      await page.evaluate(
        (surfaceName) => window.__typaiReactDebug?.failNextCompletionRequest(surfaceName),
        surface,
      );
    },
  };
}

async function openCodeMirrorCompletionDemo(
  page: Page,
  testInfo: TestInfo,
): Promise<CompletionHarness> {
  await openDemoTab(page, testInfo, /CodeMirror.*Demo/);
  const root = page.getByTestId("codemirror-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");
  await root.getByTestId("codemirror-completion-text").fill(" with e2e CodeMirror completion.");
  await page.evaluate(() => window.__typaiCodeMirrorDemo?.setCompletionLatencyMs(50));

  return {
    root,
    ghost: () => root.locator(".typai-cm-ghost-text"),
    async reset() {
      await page.evaluate(() => window.__typaiCodeMirrorDemo?.reset());
      await expect.poll(() => getCodeMirrorText(page)).toBe("");
    },
    async typeText(text) {
      await root.locator(".cm-content").click();
      await page.keyboard.type(text);
    },
    getSourceText: () => getCodeMirrorText(page),
    async pressTab() {
      await page.keyboard.press("Tab");
    },
    async revert() {
      await root.getByTestId("codemirror-revert-completion").click();
    },
    async dismissByEscape() {
      await page.keyboard.press("Escape");
    },
    async dismissBySelectionChange() {
      await page.keyboard.press("ArrowLeft");
    },
    getMetrics: () =>
      page
        .evaluate(() => window.__typaiCodeMirrorDemo?.getCompletionMetrics() ?? null)
        .then(requireMetrics),
    async setLatencyMs(value) {
      await page.evaluate(
        (nextValue) => window.__typaiCodeMirrorDemo?.setCompletionLatencyMs(nextValue),
        value,
      );
    },
    async setIgnoreAbortForProvider(value) {
      await page.evaluate(
        (nextValue) => window.__typaiCodeMirrorDemo?.setIgnoreAbortForProvider(nextValue),
        value,
      );
    },
    async failNextRequest() {
      await page.evaluate(() => window.__typaiCodeMirrorDemo?.failNextCompletionRequest());
    },
    async setCompletionText(text) {
      await root.getByTestId("codemirror-completion-text").fill(text);
    },
    getCompletionTransactionCount: () =>
      page.evaluate(() => window.__typaiCodeMirrorDemo?.getCompletionTransactionCount() ?? 0),
  };
}

async function openDemoTab(
  page: Page,
  testInfo: TestInfo,
  tabName: string | RegExp,
): Promise<void> {
  const url = `/?storage=memory&typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}`;

  await page.goto(url);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByRole("button", { name: tabName }).click();
}

async function expectMetricAtLeast(
  harness: CompletionHarness,
  metric: keyof CompletionMetrics,
  expected: number,
  timeout = 5_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const metrics = await harness.getMetrics();
        const value = metrics[metric];

        if (typeof value !== "number") {
          throw new Error(`Completion metric ${String(metric)} is not numeric.`);
        }

        return value;
      },
      { timeout },
    )
    .toBeGreaterThanOrEqual(expected);
}

async function expectStatus(
  harness: CompletionHarness,
  expected: CompletionMetrics["status"],
): Promise<void> {
  await expect.poll(async () => (await harness.getMetrics()).status).toBe(expected);
}

async function setRemoteCompletionText(page: Page, text: string): Promise<void> {
  const input = page.getByTestId("remote-completion-text");

  await input.fill(text);
  await input.dispatchEvent("change");
}

async function setRemoteLatency(page: Page, latencyMs: number): Promise<void> {
  const input = page.getByTestId("remote-latency");

  await input.fill(String(latencyMs));
  await input.dispatchEvent("change");
}

async function getRemoteCompletionMetrics(page: Page): Promise<CompletionMetrics> {
  return page
    .evaluate(() => {
      const debug = window.__typaiRemoteCompletionDebug;

      if (debug === undefined) {
        return null;
      }

      const metrics = debug.getMetrics();
      const ghostLatencies = metrics.ghostLatencySamples;

      return {
        status: debug.getState(),
        requestCount: metrics.requestCount,
        ghostShownCount: metrics.ghostShownCount,
        acceptedCount: metrics.acceptCount,
        dismissedCount: metrics.dismissCount,
        revertedCount: metrics.revertCount,
        providerErrorCount: metrics.providerErrorCount,
        staleResponseDroppedCount: metrics.staleResponseDroppedCount,
        p95GhostLatencyMs: ghostLatencies.length === 0 ? null : Math.max(...ghostLatencies),
        lastEvent: "-",
      };
    })
    .then(requireMetrics);
}

async function getContenteditableSourceText(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((element) => {
    const collect = (node: Node): string => {
      if (node.nodeType === 1 && (node as Element).getAttribute("data-typai-ghost") === "true") {
        return "";
      }

      if (node.nodeType === 3) {
        return node.textContent ?? "";
      }

      return Array.from(node.childNodes)
        .map((child) => collect(child))
        .join("");
    };

    return collect(element);
  });
}

async function moveContenteditableCaretToStart(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).evaluate((element) => {
    const selection = element.ownerDocument.getSelection();
    const range = element.ownerDocument.createRange();
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode();

    if (selection === null || textNode === null) {
      throw new Error("Expected contenteditable text node and selection.");
    }

    range.setStart(textNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    element.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
}

async function getCodeMirrorText(page: Page): Promise<string> {
  return page.evaluate(() => window.__typaiCodeMirrorDemo?.getText() ?? "");
}

async function installProviderCallGuard(page: Page): Promise<NetworkGuard> {
  const guard: NetworkGuard = {
    providerCalls: [],
    secretLeaks: [],
  };

  await page.route("**/*", async (route, request) => {
    const url = request.url();
    const headers = request.headers();
    const postData = request.postData() ?? "";
    const serialized = `${url}\n${postData}\n${JSON.stringify(headers)}`;

    if (/api\.openai\.com|openrouter\.ai|api\.anthropic\.com/i.test(url)) {
      guard.providerCalls.push(url);
      await route.abort();
      return;
    }

    if (/\bOPENAI_API_KEY\b/i.test(serialized) || /\bsk-[A-Za-z0-9_-]{8,}\b/.test(serialized)) {
      guard.secretLeaks.push(url);
    }

    await route.continue();
  });

  return guard;
}

async function expectNoSecretsInDom(page: Page): Promise<void> {
  const bodyText = await page.locator("body").textContent();

  expect(bodyText ?? "").not.toMatch(/\bOPENAI_API_KEY\b/);
  expect(bodyText ?? "").not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}\b/);
}

function harnessSurface(label: "CodeMirror" | "React textarea"): string {
  return label === "CodeMirror"
    ? " with e2e CodeMirror completion."
    : " with mocked React textarea completion.";
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-v4-1-completion-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}

function requireMetrics(metrics: CompletionMetrics | null): CompletionMetrics {
  if (metrics === null) {
    throw new Error("Completion metrics debug hook is unavailable.");
  }

  return metrics;
}

declare global {
  interface Window {
    __typaiRemoteCompletionDebug?: {
      getState(): string;
      getMetrics(): RemoteMetrics;
      setIgnoreAbortForProvider(value: boolean): void;
      failNextRequest(): void;
    };
    __typaiTextareaCompletionDebug?: {
      getMetrics(): CompletionMetrics;
      setLatencyMs(value: number): void;
      setIgnoreAbortForProvider(value: boolean): void;
      failNextRequest(): void;
    };
    __typaiReactDebug?: {
      getCompletionMetrics(): {
        textarea: CompletionMetrics;
        contenteditable: CompletionMetrics;
      };
      setCompletionLatencyMs(value: number): void;
      setIgnoreAbortForProvider(value: boolean): void;
      failNextCompletionRequest(surface: "textarea" | "contenteditable"): void;
    };
    __typaiCodeMirrorDemo?: {
      getText(): string;
      reset(): void;
      getCompletionMetrics(): CompletionMetrics;
      getCompletionTransactionCount(): number;
      setCompletionLatencyMs(value: number): void;
      setIgnoreAbortForProvider(value: boolean): void;
      failNextCompletionRequest(): void;
    };
  }
}
