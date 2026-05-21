import { expect, type Locator, type Page, test } from "@playwright/test";

const benchmarkTokens = [
  "teh",
  "adn",
  "recieve",
  "becuase",
  "thier",
  "form",
  "user@example.com",
  "zzzzword",
] as const;
const textareaBenchmarkTokens = [
  "teh",
  "adn",
  "reciept",
  "form",
  "user@example.com",
  "/etc/passwd",
  "zzzzword",
] as const;
const codeMirrorBenchmarkTokens = [
  "teh",
  "adn",
  "reciept",
  "user@example.com",
  "/etc/passwd",
  "zzzzword",
] as const;
const rounds = 10;
const codeMirrorRounds = 6;
const remoteCompletionRounds = 6;
const warningTargetMs = 20;
const hardFailureThresholdMs = 100;
const remoteCompletionWarningTargetMs = 800;
const remoteCompletionHardFailureThresholdMs = 2000;
const remoteCompletionMockLatencyMs = 50;
const demoReadyTimeoutMs = 15_000;

type LatencySummary = {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

type CompletionMetrics = {
  p95GhostLatencyMs: number | null;
};

declare global {
  interface Window {
    __typaiDebug?: {
      getMetrics(): { latencySamples: number[] };
      clearLatencies(): void;
    };
    __typaiTextareaDebug?: {
      getMetrics(): { latencySamples: number[] };
      clearLatencies(): void;
    };
    __typaiCodeMirrorDemo?: {
      getText(): string;
      getMetrics(): { latencySamples: number[] };
      clearLatencies(): void;
      reset(): void;
      setCompletionLatencyMs(value: number): void;
      getCompletionMetrics(): CompletionMetrics;
    };
    __typaiRemoteCompletionDebug?: {
      getMetrics(): { ghostLatencySamples: number[] };
      resetMetrics(): void;
    };
    __typaiTextareaCompletionDebug?: {
      getMetrics(): CompletionMetrics;
      setLatencyMs(value: number): void;
    };
    __typaiReactDebug?: {
      getCompletionMetrics(): {
        textarea: CompletionMetrics;
      };
      setCompletionLatencyMs(value: number): void;
    };
  }
}

test("reports contenteditable browser-path demo latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await page.evaluate(() => window.__typaiDebug?.clearLatencies());

  const editor = page.getByTestId("typai-editor");

  for (let round = 0; round < rounds; round += 1) {
    for (const token of benchmarkTokens) {
      await clearEditor(editor, page);
      const previousCount = await getLatencyCount(page);

      await editor.click();
      await page.keyboard.type(`${token} `);
      await expect.poll(() => getLatencyCount(page)).toBeGreaterThan(previousCount);
    }
  }

  const samples = await page.evaluate(() => window.__typaiDebug?.getMetrics().latencySamples ?? []);
  const summary = summarizeLatencies(samples);

  console.log("Typai browser demo latency smoke benchmark");
  console.log(`tokens: ${benchmarkTokens.join(", ")}`);
  console.log(
    `p95 warning/fail thresholds: ${formatMs(warningTargetMs)} / ${formatMs(
      hardFailureThresholdMs,
    )}`,
  );
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);
  emitBrowserBenchmarkJson({
    label: "Typai browser demo latency smoke benchmark",
    kind: "deterministic-correction",
    surface: "contenteditable",
    summary,
    warningMs: warningTargetMs,
    failMs: hardFailureThresholdMs,
  });

  if (summary.p95 > warningTargetMs) {
    console.warn(`warning: browser p95 exceeded ${warningTargetMs} ms target`);
  }

  if (summary.p95 > hardFailureThresholdMs) {
    console.error(
      `error: browser p95 exceeded ${hardFailureThresholdMs} ms hard failure threshold`,
    );
  }

  expect(summary.count).toBeGreaterThanOrEqual(benchmarkTokens.length * rounds);
  expectFiniteSummary(summary);
  expect(summary.p95).toBeLessThan(hardFailureThresholdMs);
});

test("reports textarea browser-path demo latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-textarea-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await expectTextareaDemoReady(page);
  await page.getByRole("button", { name: /Textarea.*Demo/ }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();
  await page.evaluate(() => window.__typaiTextareaDebug?.clearLatencies());

  const textarea = page.getByTestId("textarea-editor");

  for (let round = 0; round < rounds; round += 1) {
    for (const token of textareaBenchmarkTokens) {
      await clearTextarea(textarea);
      const previousCount = await getTextareaLatencyCount(page);

      await textarea.click();
      await page.keyboard.type(`${token} `);
      await expect.poll(() => getTextareaLatencyCount(page)).toBeGreaterThan(previousCount);
    }
  }

  const samples = await page.evaluate(
    () => window.__typaiTextareaDebug?.getMetrics().latencySamples ?? [],
  );
  const summary = summarizeLatencies(samples);

  console.log("Typai textarea browser latency smoke benchmark");
  console.log(`tokens: ${textareaBenchmarkTokens.join(", ")}`);
  console.log(
    `p95 warning/fail thresholds: ${formatMs(warningTargetMs)} / ${formatMs(
      hardFailureThresholdMs,
    )}`,
  );
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);
  emitBrowserBenchmarkJson({
    label: "Typai textarea browser latency smoke benchmark",
    kind: "deterministic-correction",
    surface: "textarea",
    summary,
    warningMs: warningTargetMs,
    failMs: hardFailureThresholdMs,
  });

  if (summary.p95 > warningTargetMs) {
    console.warn(`warning: textarea browser p95 exceeded ${warningTargetMs} ms target`);
  }

  if (summary.p95 > hardFailureThresholdMs) {
    console.error(
      `error: textarea browser p95 exceeded ${hardFailureThresholdMs} ms hard failure threshold`,
    );
  }

  expect(summary.count).toBeGreaterThanOrEqual(textareaBenchmarkTokens.length * rounds);
  expectFiniteSummary(summary);
  expect(summary.p95).toBeLessThan(hardFailureThresholdMs);
});

test("reports React textarea browser-path demo latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-react-textarea-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await page.getByRole("button", { name: /React.*Demo/ }).click();
  const root = page.getByTestId("react-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("react-core-status")).toHaveText("ready");

  const textarea = root.getByTestId("react-textarea");
  const samples: number[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (const token of textareaBenchmarkTokens) {
      await root.getByTestId("react-reset").click();
      await expect(textarea).toHaveValue("");
      samples.push(await dispatchReactTextareaInput(textarea, `${token} `));
      await expect(textarea).toHaveValue(/.+/);
    }
  }

  const summary = summarizeLatencies(samples);

  console.log("Typai React textarea browser latency smoke benchmark");
  console.log(`tokens: ${textareaBenchmarkTokens.join(", ")}`);
  console.log(
    `p95 warning/fail thresholds: ${formatMs(warningTargetMs)} / ${formatMs(
      hardFailureThresholdMs,
    )}`,
  );
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);
  emitBrowserBenchmarkJson({
    label: "Typai React textarea browser latency smoke benchmark",
    kind: "deterministic-correction",
    surface: "react-textarea",
    summary,
    warningMs: warningTargetMs,
    failMs: hardFailureThresholdMs,
  });

  if (summary.p95 > warningTargetMs) {
    console.warn(`warning: React textarea browser p95 exceeded ${warningTargetMs} ms target`);
  }

  if (summary.p95 > hardFailureThresholdMs) {
    console.error(
      `error: React textarea browser p95 exceeded ${hardFailureThresholdMs} ms hard failure threshold`,
    );
  }

  expect(summary.count).toBeGreaterThanOrEqual(textareaBenchmarkTokens.length * rounds);
  expectFiniteSummary(summary);
  expect(summary.p95).toBeLessThan(hardFailureThresholdMs);
});

test("reports CodeMirror browser-path demo latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-codemirror-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await page.getByRole("button", { name: /CodeMirror.*Demo/ }).click();
  const root = page.getByTestId("codemirror-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");
  await page.evaluate(() => window.__typaiCodeMirrorDemo?.clearLatencies());

  const editor = root.locator(".cm-content");

  for (let round = 0; round < codeMirrorRounds; round += 1) {
    for (const token of codeMirrorBenchmarkTokens) {
      await clearCodeMirror(editor, page);
      const previousCount = await getCodeMirrorLatencyCount(page);

      await editor.click();
      await page.keyboard.type(`${token} `);
      await expect.poll(() => getCodeMirrorLatencyCount(page)).toBeGreaterThan(previousCount);
    }
  }

  const samples = await page.evaluate(
    () => window.__typaiCodeMirrorDemo?.getMetrics().latencySamples ?? [],
  );
  const summary = summarizeLatencies(samples);

  console.log("typai CodeMirror browser latency smoke benchmark");
  console.log(`tokens: ${codeMirrorBenchmarkTokens.join(", ")}`);
  console.log(
    `p95 warning/fail thresholds: ${formatMs(warningTargetMs)} / ${formatMs(
      hardFailureThresholdMs,
    )}`,
  );
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);
  emitBrowserBenchmarkJson({
    label: "typai CodeMirror browser latency smoke benchmark",
    kind: "deterministic-correction",
    surface: "codemirror",
    summary,
    warningMs: warningTargetMs,
    failMs: hardFailureThresholdMs,
  });

  if (summary.p95 > warningTargetMs) {
    console.warn(`warning: CodeMirror browser p95 exceeded ${warningTargetMs} ms target`);
  }

  if (summary.p95 > hardFailureThresholdMs) {
    console.error(
      `error: CodeMirror browser p95 exceeded ${hardFailureThresholdMs} ms hard failure threshold`,
    );
  }

  expect(summary.count).toBeGreaterThanOrEqual(codeMirrorBenchmarkTokens.length * codeMirrorRounds);
  expectFiniteSummary(summary);
  expect(summary.p95).toBeLessThan(hardFailureThresholdMs);
});

test("reports V4 remote completion mocked ghost latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-remote-completion-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await page.getByRole("button", { name: "V4 Remote Completion" }).click();
  await expect(page.getByTestId("remote-completion-demo-root")).toBeVisible();
  await setRemoteCompletionMockLatency(page, remoteCompletionMockLatencyMs);

  const editor = page.getByTestId("remote-completion-editor");
  const samples: number[] = [];

  for (let round = 0; round < remoteCompletionRounds; round += 1) {
    await resetRemoteCompletionEditor(page);

    await editor.click();
    await page.keyboard.type(`Benchmark prompt ${round} for remote completion`);
    await expect
      .poll(() => getRemoteCompletionLatencyCount(page), { timeout: 5_000 })
      .toBeGreaterThan(0);
    await expect(remoteCompletionGhost(page)).toHaveCount(1);
    samples.push(...(await getRemoteCompletionLatencySamples(page)));
    await page.keyboard.press("Escape");
    await expect(remoteCompletionGhost(page)).toHaveCount(0);
  }

  const summary = summarizeLatencies(samples);

  console.log("Typai V4 remote completion mocked ghost latency smoke benchmark");
  console.log(`mock provider latency: ${remoteCompletionMockLatencyMs} ms`);
  console.log(
    `p95 warning/fail thresholds: ${formatMs(remoteCompletionWarningTargetMs)} / ${formatMs(
      remoteCompletionHardFailureThresholdMs,
    )}`,
  );
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);
  emitBrowserBenchmarkJson({
    label: "Typai V4 remote completion mocked ghost latency smoke benchmark",
    kind: "mocked-completion",
    surface: "contenteditable",
    summary,
    warningMs: remoteCompletionWarningTargetMs,
    failMs: remoteCompletionHardFailureThresholdMs,
  });

  if (summary.p95 > remoteCompletionWarningTargetMs) {
    console.warn(
      `warning: V4 remote completion p95 exceeded ${remoteCompletionWarningTargetMs} ms target`,
    );
  }

  if (summary.p95 > remoteCompletionHardFailureThresholdMs) {
    console.error(
      `error: V4 remote completion p95 exceeded ${remoteCompletionHardFailureThresholdMs} ms hard failure threshold`,
    );
  }

  expect(summary.count).toBeGreaterThanOrEqual(remoteCompletionRounds);
  expectFiniteSummary(summary);
  expect(summary.p95).toBeLessThan(remoteCompletionHardFailureThresholdMs);
});

test("reports textarea completion mocked ghost latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-textarea-completion-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await page.getByRole("button", { name: /Textarea.*Demo/ }).click();
  await expect(page.getByTestId("textarea-demo-root")).toBeVisible();
  await page.getByTestId("textarea-completion-text").fill(" with benchmark textarea completion.");
  await page.evaluate(
    (latencyMs) => window.__typaiTextareaCompletionDebug?.setLatencyMs(latencyMs),
    remoteCompletionMockLatencyMs,
  );

  const textarea = page.getByTestId("textarea-editor");
  const samples: number[] = [];

  for (let round = 0; round < remoteCompletionRounds; round += 1) {
    await page.getByTestId("textarea-reset").click();
    await expect(textarea).toHaveValue("");
    await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);

    await textarea.click();
    await page.keyboard.type(`Benchmark prompt ${round} for textarea completion`);
    const startedAt = Date.now();
    await expect(page.getByTestId("textarea-ghost-text")).toHaveText(
      " with benchmark textarea completion.",
      { timeout: 5_000 },
    );
    samples.push(Date.now() - startedAt);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("textarea-ghost-text")).toHaveCount(0);
  }

  reportRemoteCompletionBenchmark(
    "Typai textarea completion mocked ghost latency smoke benchmark",
    samples,
  );
});

test("reports React textarea completion mocked ghost latency smoke metrics", async ({ page }) => {
  await page.goto(
    `/?typaiDbName=typai-react-textarea-completion-latency-${Date.now()}&storage=memory`,
  );
  await expectDemoReady(page);
  await page.getByRole("button", { name: /React.*Demo/ }).click();
  const root = page.getByTestId("react-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("react-core-status")).toHaveText("ready");
  await page.evaluate(
    (latencyMs) => window.__typaiReactDebug?.setCompletionLatencyMs(latencyMs),
    remoteCompletionMockLatencyMs,
  );

  const textarea = root.getByTestId("react-textarea");
  const ghost = root.getByTestId("textarea-ghost-text");
  const samples: number[] = [];

  for (let round = 0; round < remoteCompletionRounds; round += 1) {
    await root.getByTestId("react-reset").click();
    await expect(textarea).toHaveValue("");
    await expect(ghost).toHaveCount(0);

    await textarea.click();
    await page.keyboard.type(`Benchmark prompt ${round} for React textarea completion`);
    const startedAt = Date.now();
    await expect(ghost).toHaveText(" with mocked React textarea completion.", { timeout: 5_000 });
    samples.push(Date.now() - startedAt);
    await page.keyboard.press("Escape");
    await expect(ghost).toHaveCount(0);
  }

  reportRemoteCompletionBenchmark(
    "Typai React textarea completion mocked ghost latency smoke benchmark",
    samples,
  );
});

test("reports CodeMirror completion mocked ghost latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-codemirror-completion-latency-${Date.now()}&storage=memory`);
  await expectDemoReady(page);
  await page.getByRole("button", { name: /CodeMirror.*Demo/ }).click();
  const root = page.getByTestId("codemirror-demo-root");

  await expect(root).toBeVisible();
  await expect(root.getByTestId("codemirror-core-status")).toHaveText("ready");
  await root
    .getByTestId("codemirror-completion-text")
    .fill(" with benchmark CodeMirror completion.");
  await page.evaluate(
    (latencyMs) => window.__typaiCodeMirrorDemo?.setCompletionLatencyMs(latencyMs),
    remoteCompletionMockLatencyMs,
  );

  const editor = root.locator(".cm-content");
  const ghost = root.locator(".typai-cm-ghost-text");
  const samples: number[] = [];

  for (let round = 0; round < remoteCompletionRounds; round += 1) {
    await page.evaluate(() => window.__typaiCodeMirrorDemo?.reset());
    await expect
      .poll(() => page.evaluate(() => window.__typaiCodeMirrorDemo?.getText() ?? null))
      .toBe("");
    await expect(ghost).toHaveCount(0);

    await editor.click();
    await page.keyboard.type(`Benchmark prompt ${round} for CodeMirror completion`);
    const startedAt = Date.now();
    await expect(ghost).toHaveText(" with benchmark CodeMirror completion.", { timeout: 5_000 });
    samples.push(Date.now() - startedAt);
    await page.keyboard.press("Escape");
    await expect(ghost).toHaveCount(0);
  }

  reportRemoteCompletionBenchmark(
    "Typai CodeMirror completion mocked ghost latency smoke benchmark",
    samples,
  );
});

async function expectDemoReady(page: Page): Promise<void> {
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.", {
    timeout: demoReadyTimeoutMs,
  });
}

async function expectTextareaDemoReady(page: Page): Promise<void> {
  await expect(page.locator("[data-textarea-last-decision]")).toHaveText("Ready.", {
    timeout: demoReadyTimeoutMs,
  });
}

async function clearEditor(editor: Locator, page: Page): Promise<void> {
  await editor.evaluate((element) => {
    element.textContent = "";
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContent" }));
  });
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
}

async function clearTextarea(textarea: Locator): Promise<void> {
  await textarea.evaluate((element) => {
    element.value = "";
    element.selectionStart = 0;
    element.selectionEnd = 0;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContent" }));
  });
}

async function dispatchReactTextareaInput(textarea: Locator, text: string): Promise<number> {
  return textarea.evaluate((element, nextValue) => {
    const textareaElement = element as HTMLTextAreaElement;
    const startedAt = performance.now();

    textareaElement.focus();
    textareaElement.value = nextValue;
    textareaElement.setSelectionRange(nextValue.length, nextValue.length);
    textareaElement.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: nextValue,
        inputType: "insertText",
      }),
    );

    return performance.now() - startedAt;
  }, text);
}

async function clearCodeMirror(editor: Locator, page: Page): Promise<void> {
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await expect
    .poll(() => page.evaluate(() => window.__typaiCodeMirrorDemo?.getText() ?? null))
    .toBe("");
}

async function getLatencyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__typaiDebug?.getMetrics().latencySamples.length ?? 0);
}

async function getTextareaLatencyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__typaiTextareaDebug?.getMetrics().latencySamples.length ?? 0);
}

async function getCodeMirrorLatencyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__typaiCodeMirrorDemo?.getMetrics().latencySamples.length ?? 0);
}

async function getRemoteCompletionLatencyCount(page: Page): Promise<number> {
  return (await getRemoteCompletionLatencySamples(page)).length;
}

async function getRemoteCompletionLatencySamples(page: Page): Promise<number[]> {
  return page.evaluate(
    () => window.__typaiRemoteCompletionDebug?.getMetrics().ghostLatencySamples ?? [],
  );
}

async function setRemoteCompletionMockLatency(page: Page, latencyMs: number): Promise<void> {
  const input = page.getByTestId("remote-latency");

  await input.fill(String(latencyMs));
  await input.dispatchEvent("change");
}

function remoteCompletionGhost(page: Page): Locator {
  return page.locator("[data-testid='remote-completion-editor'] [data-typai-ghost='true']");
}

async function resetRemoteCompletionEditor(page: Page): Promise<void> {
  await page.getByTestId("remote-reset").click();
  await page.evaluate(() => window.__typaiRemoteCompletionDebug?.resetMetrics());
  await expect(remoteCompletionGhost(page)).toHaveCount(0);
  await expect
    .poll(() =>
      page.getByTestId("remote-completion-editor").evaluate((element) => element.textContent ?? ""),
    )
    .toBe("");
}

function summarizeLatencies(samples: number[]): LatencySummary {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample >= 0)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      mean: Number.NaN,
      p50: Number.NaN,
      p95: Number.NaN,
      p99: Number.NaN,
      max: Number.NaN,
    };
  }

  const total = sorted.reduce((sum, sample) => sum + sample, 0);

  return {
    count: sorted.length,
    mean: total / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.at(-1) ?? Number.NaN,
  };
}

function percentile(sorted: number[], value: number): number {
  const index = Math.ceil((sorted.length * value) / 100) - 1;

  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? Number.NaN;
}

function expectFiniteSummary(summary: LatencySummary): void {
  for (const [key, value] of Object.entries(summary)) {
    expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
  }
}

function reportRemoteCompletionBenchmark(label: string, samples: number[]): void {
  const summary = summarizeLatencies(samples);

  console.log(label);
  console.log(`mock provider latency: ${remoteCompletionMockLatencyMs} ms`);
  console.log(
    `p95 warning/fail thresholds: ${formatMs(remoteCompletionWarningTargetMs)} / ${formatMs(
      remoteCompletionHardFailureThresholdMs,
    )}`,
  );
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);
  emitBrowserBenchmarkJson({
    label,
    kind: "mocked-completion",
    surface: inferCompletionSurface(label),
    summary,
    warningMs: remoteCompletionWarningTargetMs,
    failMs: remoteCompletionHardFailureThresholdMs,
  });

  if (summary.p95 > remoteCompletionWarningTargetMs) {
    console.warn(`warning: ${label} p95 exceeded ${remoteCompletionWarningTargetMs} ms target`);
  }

  if (summary.p95 > remoteCompletionHardFailureThresholdMs) {
    console.error(
      `error: ${label} p95 exceeded ${remoteCompletionHardFailureThresholdMs} ms hard failure threshold`,
    );
  }

  expect(summary.count).toBeGreaterThanOrEqual(remoteCompletionRounds);
  expectFiniteSummary(summary);
  expect(summary.p95).toBeLessThan(remoteCompletionHardFailureThresholdMs);
}

function formatMs(value: number): string {
  return `${value.toFixed(4)} ms`;
}

function emitBrowserBenchmarkJson(options: {
  label: string;
  kind: "deterministic-correction" | "mocked-completion";
  surface: string;
  summary: LatencySummary;
  warningMs: number;
  failMs: number;
}): void {
  console.log(
    `browser-benchmark-json: ${JSON.stringify({
      label: options.label,
      kind: options.kind,
      surface: options.surface,
      thresholds: {
        p95WarningMs: options.warningMs,
        p95FailMs: options.failMs,
      },
      summary: options.summary,
      status:
        options.summary.p95 > options.failMs
          ? "fail"
          : options.summary.p95 > options.warningMs
            ? "warn"
            : "pass",
    })}`,
  );
}

function inferCompletionSurface(label: string): string {
  if (/React textarea/i.test(label)) {
    return "react-textarea";
  }

  if (/CodeMirror/i.test(label)) {
    return "codemirror";
  }

  if (/textarea/i.test(label)) {
    return "textarea";
  }

  return "contenteditable";
}
