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
const rounds = 10;
const warningTargetMs = 20;
const hardFailureThresholdMs = 100;

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

async function getLatencyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__typaiDebug?.getMetrics().latencySamples.length ?? 0);
}

async function getTextareaLatencyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__typaiTextareaDebug?.getMetrics().latencySamples.length ?? 0);
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
