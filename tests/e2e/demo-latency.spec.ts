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

type LatencySummary = {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
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
    };
    __typaiRemoteCompletionDebug?: {
      getMetrics(): { ghostLatencySamples: number[] };
      resetMetrics(): void;
    };
  }
}

test("reports contenteditable browser-path demo latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-latency-${Date.now()}&storage=memory`);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
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
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);

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
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await expect(page.locator("[data-textarea-last-decision]")).toHaveText("Ready.");
  await page.getByRole("button", { name: "Textarea Demo" }).click();
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
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);

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

test("reports CodeMirror browser-path demo latency smoke metrics", async ({ page }) => {
  await page.goto(`/?typaiDbName=typai-codemirror-latency-${Date.now()}&storage=memory`);
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
  await page.getByRole("button", { name: "CodeMirror Demo" }).click();
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
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);

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
  await expect(page.getByTestId("last-decision")).toHaveText("Ready.");
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
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);
  console.log(`max: ${formatMs(summary.max)}`);

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

function formatMs(value: number): string {
  return `${value.toFixed(4)} ms`;
}
