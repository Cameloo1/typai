import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

const defaultCompletion = " with an e2e mocked continuation.";

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

type RemoteDebugGlobal = Window & {
  __typaiRemoteCompletionDebug?: {
    getState(): string;
    getMetrics(): RemoteMetrics;
    setIgnoreAbortForProvider(value: boolean): void;
  };
};

type NetworkGuard = {
  providerCalls: string[];
  secretLeaks: string[];
};

type MockProxyEndpoint = {
  endpoint: string;
  requests: Array<{
    url: string;
    method: string;
    postData: string;
  }>;
};

test("remote completion ghost appears after debounce without becoming source text", async ({
  page,
}, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page);

  await expect(remoteGhost(page)).toHaveText(defaultCompletion);
  await expect(remoteGhost(page)).toHaveAttribute("aria-hidden", "true");
  await expect(remoteGhost(page)).toHaveAttribute("contenteditable", "false");
  await expect.poll(() => getRemoteSourceText(page)).toBe(prefix);
  await expectMetric(page, "ghostShownCount", 1);
});

test("remote completion Tab accepts visible ghost text", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page);

  await page.keyboard.press("Tab");

  await expect(remoteGhost(page)).toHaveCount(0);
  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix}${defaultCompletion}`);
  await expect(page.getByTestId("remote-accept-count")).toHaveText("1");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
  await expectMetric(page, "acceptCount", 1);
});

test("remote completion Escape dismisses visible ghost text", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page);

  await page.keyboard.press("Escape");

  await expect(remoteGhost(page)).toHaveCount(0);
  await expect.poll(() => getRemoteSourceText(page)).toBe(prefix);
  await expect(page.getByTestId("remote-dismiss-count")).toHaveText("1");
  await expectMetric(page, "dismissByEscapeCount", 1);
});

test("remote completion typing dismisses visible ghost text", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page);

  await page.keyboard.type("!");

  await expect(remoteGhost(page)).toHaveCount(0);
  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix}!`);
  await expectMetric(page, "dismissByTypingCount", 1);
});

test("remote completion selection changes dismiss visible ghost text", async ({
  page,
}, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  await showGhost(page);

  await moveCaretToStart(page);

  await expect(remoteGhost(page)).toHaveCount(0);
  await expectMetric(page, "dismissBySelectionChangeCount", 1);
});

test("remote completion compositionstart dismisses visible ghost text", async ({
  page,
}, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  await showGhost(page);

  await page.getByTestId("remote-completion-editor").evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "t" }));
  });

  await expect(remoteGhost(page)).toHaveCount(0);
  await expectMetric(page, "dismissByCompositionCount", 1);
});

test("remote completion accepted text can be reverted exactly", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page);

  await page.keyboard.press("Tab");
  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix}${defaultCompletion}`);

  await page.getByTestId("remote-revert").click();

  await expect.poll(() => getRemoteSourceText(page)).toBe(prefix);
  await expect(page.getByTestId("remote-revert-count")).toHaveText("1");
  await expectMetric(page, "revertCount", 1);
});

test("remote completion drops stale provider responses", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo, {
    completionText: " with stale {requestId}.",
    latencyMs: 1200,
  });
  await setProviderIgnoresAbort(page, true);
  const editor = page.getByTestId("remote-completion-editor");

  await editor.click();
  await page.keyboard.type("This first request is ready");
  await expectRemoteState(page, "requesting", 1_500);

  await page.keyboard.type("x");

  await expectMetric(page, "staleResponseDroppedCount", 1, 3_000);
  const metrics = await getRemoteMetrics(page);
  const staleRequestId = metrics.staleResponseDroppedRequestIds.at(-1);

  expect(staleRequestId).toBeTruthy();
  await expect(remoteGhost(page)).toHaveText(/^ with stale completion-\d+\.$/, { timeout: 3_000 });
  await expect(remoteGhost(page)).not.toHaveText(` with stale ${staleRequestId}.`);
  await expect.poll(() => getRemoteSourceText(page)).toBe("This first request is readyx");
});

test("remote completion coexists with correction transactions", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page, "Please continue this");

  await page.keyboard.type(" teh ");

  await expect(remoteGhost(page)).toHaveCount(0);
  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix} the `);

  await page.keyboard.type("again");

  await expect(remoteGhost(page)).toHaveText(defaultCompletion, { timeout: 5_000 });
  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix} the again`);
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("blue-mark")).toHaveCount(0);
});

test("remote completion demo makes no real OpenAI or provider calls", async ({
  page,
}, testInfo) => {
  const guard = await openRemoteCompletionDemo(page, testInfo);
  const prefix = await showGhost(page);

  await page.keyboard.press("Tab");

  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix}${defaultCompletion}`);
  expect(guard.providerCalls).toEqual([]);
  expect(guard.secretLeaks).toEqual([]);

  const bodyText = await page.locator("body").textContent();

  expect(bodyText ?? "").not.toMatch(/\bOPENAI_API_KEY\b/);
  expect(bodyText ?? "").not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}\b/);
});

test("remote completion proxy mode uses the configured proxy endpoint only", async ({
  page,
}, testInfo) => {
  const guard = await openRemoteCompletionDemo(page, testInfo);
  const proxy = await installMockProxyEndpoint(page, {
    text: " with proxy model output.",
    model: "mock-proxy-model",
  });

  await setProviderMode(page, "proxy", proxy.endpoint);
  const prefix = await showGhost(
    page,
    "Please continue this proxy prompt",
    " with proxy model output.",
  );

  await expect(remoteGhost(page)).toHaveText(" with proxy model output.");
  await expect(page.getByTestId("remote-active-provider-mode")).toHaveText("proxy");
  await expect(page.getByTestId("remote-active-endpoint")).toHaveText(proxy.endpoint);
  await expect(page.getByTestId("remote-last-model")).toHaveText("mock-proxy-model");
  await expect(page.getByTestId("remote-last-ghost")).toHaveText(" with proxy model output.");
  await page.keyboard.press("Tab");
  await expect.poll(() => getRemoteSourceText(page)).toBe(`${prefix} with proxy model output.`);

  expect(proxy.requests).toHaveLength(1);
  expect(proxy.requests[0]?.url).toBe(proxy.endpoint);
  expect(proxy.requests[0]?.postData).not.toMatch(/\bOPENAI_API_KEY\b/i);
  expect(proxy.requests[0]?.postData).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}\b/);
  expect(guard.providerCalls).toEqual([]);
  expect(guard.secretLeaks).toEqual([]);
});

test("remote completion proxy mode Escape dismisses visible ghost text", async ({
  page,
}, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const proxy = await installMockProxyEndpoint(page, {
    text: " with dismissible proxy output.",
  });

  await setProviderMode(page, "proxy", proxy.endpoint);
  const prefix = await showGhost(
    page,
    "Please continue this proxy draft",
    " with dismissible proxy output.",
  );

  await page.keyboard.press("Escape");

  await expect(remoteGhost(page)).toHaveCount(0);
  await expect.poll(() => getRemoteSourceText(page)).toBe(prefix);
  await expectMetric(page, "dismissByEscapeCount", 1);
});

test("remote completion proxy mode handles provider failure safely", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const proxy = await installMockProxyEndpoint(page, {
    status: 500,
  });

  await setProviderMode(page, "proxy", proxy.endpoint);
  const editor = page.getByTestId("remote-completion-editor");

  await editor.click();
  await page.keyboard.type("Please continue this failing proxy prompt");

  await expectRemoteState(page, "error", 5_000);
  await expectMetric(page, "providerErrorCount", 1);
  await expect(remoteGhost(page)).toHaveCount(0);
  await expect(page.getByTestId("remote-status")).toHaveText("error");
});

test("remote completion proxy mode drops stale proxy responses", async ({ page }, testInfo) => {
  await openRemoteCompletionDemo(page, testInfo);
  const proxy = await installMockProxyEndpoint(page, {
    delayByRequestIndexMs: [900, 50],
    textForRequest: (requestId) => ` with stale proxy ${requestId}.`,
  });

  await setProviderMode(page, "proxy", proxy.endpoint);
  await setProviderIgnoresAbort(page, true);
  const editor = page.getByTestId("remote-completion-editor");

  await editor.click();
  await page.keyboard.type("This proxy request is ready");
  await expectRemoteState(page, "requesting", 1_500);

  await page.keyboard.type("x");

  await expectMetric(page, "staleResponseDroppedCount", 1, 3_000);
  const metrics = await getRemoteMetrics(page);
  const staleRequestId = metrics.staleResponseDroppedRequestIds.at(-1);

  expect(staleRequestId).toBeTruthy();
  await expect(remoteGhost(page)).toHaveText(/^ with stale proxy completion-\d+\.$/, {
    timeout: 3_000,
  });
  await expect(remoteGhost(page)).not.toHaveText(` with stale proxy ${staleRequestId}.`);
  await expect.poll(() => getRemoteSourceText(page)).toBe("This proxy request is readyx");
});

async function openRemoteCompletionDemo(
  page: Page,
  testInfo: TestInfo,
  options: { latencyMs?: number; completionText?: string } = {},
): Promise<NetworkGuard> {
  const guard = await installProviderCallGuard(page);
  const url = `/?typaiDbName=${encodeURIComponent(uniqueDbName(testInfo))}&storage=memory`;

  await page.goto(url);
  await page.getByRole("button", { name: "V4 Remote Completion" }).click();
  await expect(page.getByTestId("remote-completion-demo-root")).toBeVisible();
  await expect(page.getByTestId("remote-status")).toHaveText(/idle|scheduled|requesting|showing/);
  await setMockCompletionText(page, options.completionText ?? defaultCompletion);
  await setMockLatency(page, options.latencyMs ?? 50);
  await resetRemoteEditor(page);

  return guard;
}

async function showGhost(
  page: Page,
  prefix = "Please continue this prompt",
  expectedCompletion = defaultCompletion,
): Promise<string> {
  const editor = page.getByTestId("remote-completion-editor");

  await editor.click();
  await page.keyboard.type(prefix);
  await expect(remoteGhost(page)).toHaveText(expectedCompletion, { timeout: 5_000 });

  return prefix;
}

function remoteGhost(page: Page): Locator {
  return page.locator("[data-testid='remote-completion-editor'] [data-typai-ghost='true']");
}

async function resetRemoteEditor(page: Page): Promise<void> {
  await page.getByTestId("remote-reset").click();
  await expect.poll(() => getRemoteSourceText(page)).toBe("");
  await expect(remoteGhost(page)).toHaveCount(0);
}

async function setMockCompletionText(page: Page, text: string): Promise<void> {
  const input = page.getByTestId("remote-completion-text");

  await input.fill(text);
  await input.dispatchEvent("change");
}

async function setMockLatency(page: Page, latencyMs: number): Promise<void> {
  const input = page.getByTestId("remote-latency");

  await input.fill(String(latencyMs));
  await input.dispatchEvent("change");
}

async function setProviderMode(
  page: Page,
  mode: "mock" | "proxy",
  endpoint?: string,
): Promise<void> {
  if (endpoint !== undefined) {
    const input = page.getByTestId("remote-proxy-endpoint");

    await input.fill(endpoint);
    await input.dispatchEvent("change");
  }

  await page.getByTestId("remote-provider-mode").selectOption(mode);
  await expect(page.getByTestId("remote-active-provider-mode")).toHaveText(mode);
}

async function setProviderIgnoresAbort(page: Page, value: boolean): Promise<void> {
  await page.evaluate((nextValue) => {
    (
      window as unknown as RemoteDebugGlobal
    ).__typaiRemoteCompletionDebug?.setIgnoreAbortForProvider(nextValue);
  }, value);
}

async function getRemoteMetrics(page: Page): Promise<RemoteMetrics> {
  const metrics = await page.evaluate(() => {
    return (
      (window as unknown as RemoteDebugGlobal).__typaiRemoteCompletionDebug?.getMetrics() ?? null
    );
  });

  if (metrics === null) {
    throw new Error("Remote completion debug metrics are not available.");
  }

  return metrics;
}

async function getRemoteState(page: Page): Promise<string> {
  const state = await page.evaluate(() => {
    return (
      (window as unknown as RemoteDebugGlobal).__typaiRemoteCompletionDebug?.getState() ?? null
    );
  });

  if (state === null) {
    throw new Error("Remote completion debug state is not available.");
  }

  return state;
}

async function expectRemoteState(page: Page, expected: string, timeout = 5_000): Promise<void> {
  await expect.poll(() => getRemoteState(page), { timeout }).toBe(expected);
}

async function expectMetric(
  page: Page,
  metric: keyof RemoteMetrics,
  expected: number,
  timeout = 5_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const metrics = await getRemoteMetrics(page);
        const value = metrics[metric];

        if (typeof value !== "number") {
          throw new Error(`Metric ${metric} is not numeric.`);
        }

        return value;
      },
      { timeout },
    )
    .toBe(expected);
}

async function getRemoteSourceText(page: Page): Promise<string> {
  return page.getByTestId("remote-completion-editor").evaluate((element) => {
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

async function moveCaretToStart(page: Page): Promise<void> {
  await page.getByTestId("remote-completion-editor").evaluate((element) => {
    const selection = element.ownerDocument.getSelection();
    const range = element.ownerDocument.createRange();
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode();

    if (selection === null || textNode === null) {
      throw new Error("Expected text node and selection for remote completion editor.");
    }

    range.setStart(textNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    element.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
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

    await route.fallback();
  });

  return guard;
}

async function installMockProxyEndpoint(
  page: Page,
  options: {
    delayByRequestIndexMs?: number[];
    model?: string;
    status?: number;
    text?: string;
    textForRequest?: (requestId: string) => string;
  } = {},
): Promise<MockProxyEndpoint> {
  const endpoint = `http://127.0.0.1:8787/api/typai/completion?test=${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const requests: MockProxyEndpoint["requests"] = [];

  await page.route(`${endpoint}**`, async (route, request) => {
    const origin = request.headers().origin ?? "http://localhost:5173";

    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: buildProxyCorsHeaders(origin),
        body: "",
      });
      return;
    }

    const postData = request.postData() ?? "";
    const requestIndex = requests.length;

    requests.push({
      url: request.url(),
      method: request.method(),
      postData,
    });

    const delayMs = options.delayByRequestIndexMs?.[requestIndex] ?? 0;

    if (delayMs > 0) {
      await wait(delayMs);
    }

    const status = options.status ?? 200;
    const body =
      status >= 400
        ? {
            error: {
              code: "server_error",
              message: "The completion proxy failed.",
            },
          }
        : {
            text:
              options.textForRequest?.(readRequestId(postData)) ??
              options.text ??
              " with proxy output.",
            model: options.model ?? "mock-proxy-model",
            usage: {
              inputTokens: 12,
              outputTokens: 4,
            },
            finishReason: "stop",
          };

    await route.fulfill({
      status,
      headers: {
        ...buildProxyCorsHeaders(origin),
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
  });

  return {
    endpoint,
    requests,
  };
}

function buildProxyCorsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function readRequestId(postData: string): string {
  try {
    const payload = JSON.parse(postData) as { request?: { id?: unknown } };

    return typeof payload.request?.id === "string" ? payload.request.id : "unknown";
  } catch {
    return "unknown";
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function uniqueDbName(testInfo: TestInfo): string {
  return `typai-remote-e2e-${testInfo.project.name}-${testInfo.workerIndex}-${
    testInfo.parallelIndex
  }-${testInfo.retry}-${Date.now()}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-")}`;
}
