import { readFileSync } from "node:fs";

import { createTypaiCore } from "../dist/index.js";

const mockDictionaryUrl = new URL("../assets/mock-en-us.dictionary.bin", import.meta.url);
const tokens = [
  "teh",
  "adn",
  "recieve",
  "becuase",
  "thier",
  "reciept",
  "adress",
  "corection",
  "speling",
  "form",
  "user@example.com",
  "zzzzword",
];
const iterationsPerToken = 1000;
const warningTargetMs = 20;
const hardFailureMs = 100;

console.log("Typai core hot-path latency benchmark");
console.log(`tokens: ${tokens.join(", ")}`);

const builtInSummary = await runScenario("built-in tiny mode", await createTypaiCore());
const loadedSummary = await runScenario(
  "loaded mock dictionary mode",
  await createTypaiCore({
    dictionary: {
      bytes: readFileSync(mockDictionaryUrl),
    },
  }),
);

if (builtInSummary.p95 > hardFailureMs || loadedSummary.p95 > hardFailureMs) {
  process.exitCode = 1;
}

function formatMs(value) {
  return `${value.toFixed(4)} ms`;
}

async function runScenario(name, core) {
  let tokenIndex = 0;
  const summary = measureSyncLatency(
    () => {
      const token = tokens[tokenIndex % tokens.length];
      tokenIndex += 1;
      core.checkCompletedToken({ token });
    },
    {
      iterations: iterationsPerToken * tokens.length,
      warmupIterations: tokens.length * 10,
    },
  );

  console.log("");
  console.log(name);
  console.log(`count: ${summary.count}`);
  console.log(`mean: ${formatMs(summary.mean)}`);
  console.log(`p50: ${formatMs(summary.p50)}`);
  console.log(`p95: ${formatMs(summary.p95)}`);
  console.log(`p99: ${formatMs(summary.p99)}`);

  if (summary.p95 > warningTargetMs) {
    console.warn(`warning: ${name} p95 exceeded ${warningTargetMs} ms target`);
  }

  if (summary.p95 > hardFailureMs) {
    console.error(`error: ${name} p95 exceeded ${hardFailureMs} ms hard failure threshold`);
  }

  return summary;
}

function measureSyncLatency(operation, options = {}) {
  const iterations = options.iterations ?? 100;
  const warmupIterations = options.warmupIterations ?? 5;
  const samples = [];

  for (let index = 0; index < warmupIterations; index += 1) {
    operation();
  }

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    operation();
    samples.push(performance.now() - startedAt);
  }

  return summarizeLatencies(samples);
}

function summarizeLatencies(samples) {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample >= 0)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const total = sorted.reduce((sum, sample) => sum + sample, 0);

  return {
    count: sorted.length,
    mean: total / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sorted, value) {
  const index = Math.ceil((sorted.length * value) / 100) - 1;

  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}
