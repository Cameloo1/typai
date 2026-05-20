import { readFileSync } from "node:fs";

import { createTypaiCore } from "../dist/index.js";
import {
  createScaledMockEntries,
  defaultScaledMockWordCount,
  scaledMockBinaryPath,
  scaledMockMetaPath,
  validateDictionaryAsset,
  writeDictionaryAsset,
} from "./dictionary-asset-utils.mjs";

const mockDictionaryUrl = new URL("../assets/mock-en-us.dictionary.bin", import.meta.url);
const scaledMockBytes = ensureScaledMockAsset();
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
  "seperate",
  "tommorow",
  "definitly",
  "dont",
  "adresss",
  "form",
  "user@example.com",
  "zzzzword",
];
const iterationsPerToken = 1000;
const scaledIterationsPerToken = 100;
const warningTargetMs = 20;
const hardFailureMs = 100;

console.log("Typai core hot-path latency benchmark");
console.log(`tokens: ${tokens.join(", ")}`);
console.log(`check/suggest p95 warning threshold: ${formatMs(warningTargetMs)}`);
console.log(`check/suggest p95 failure threshold: ${formatMs(hardFailureMs)}`);

const builtInSummary = await runScenario("built-in tiny mode", await createTypaiCore());
const loadedSummary = await runScenario(
  "host-provided mock dictionary mode",
  await createTypaiCore({
    dictionary: {
      mode: "host-provided",
      bytes: readFileSync(mockDictionaryUrl),
    },
  }),
);
const productionModeBlocked = await createTypaiCore({
  dictionary: {
    mode: "production",
  },
}).then(
  () => false,
  (error) =>
    error instanceof Error && /production dictionary asset is unavailable/i.test(error.message),
);

console.log("");
console.log(`production dictionary mode blocked: ${productionModeBlocked ? "yes" : "no"}`);

const scaledLoadSummary = await runDictionaryLoadScenario(
  "scaled mock dictionary load",
  scaledMockBytes,
);
const scaledCore = await createTypaiCore({
  dictionary: {
    mode: "host-provided",
    bytes: scaledMockBytes,
  },
});

console.log("");
console.log("loaded scaled mock delete index");
console.log(`entries: ${scaledCore.getDeleteIndexEntryCount()}`);
console.log(`memory estimate: ${scaledCore.getDeleteIndexMemoryEstimateBytes()} bytes`);

const scaledCheckSummary = await runScenario(
  "loaded scaled mock dictionary check mode",
  scaledCore,
  {
    iterationsPerToken: scaledIterationsPerToken,
  },
);
const scaledSuggestSummary = await runSuggestScenario(
  "loaded scaled mock dictionary suggest mode",
  scaledCore,
);

if (
  builtInSummary.p95 > hardFailureMs ||
  loadedSummary.p95 > hardFailureMs ||
  scaledLoadSummary.p95 > hardFailureMs ||
  scaledCheckSummary.p95 > hardFailureMs ||
  scaledSuggestSummary.p95 > hardFailureMs ||
  !productionModeBlocked
) {
  process.exitCode = 1;
}

function formatMs(value) {
  return `${value.toFixed(4)} ms`;
}

async function runScenario(name, core, options = {}) {
  const scenarioIterationsPerToken = options.iterationsPerToken ?? iterationsPerToken;
  let tokenIndex = 0;
  const summary = measureSyncLatency(
    () => {
      const token = tokens[tokenIndex % tokens.length];
      tokenIndex += 1;
      core.checkCompletedToken({ token });
    },
    {
      iterations: scenarioIterationsPerToken * tokens.length,
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

async function runDictionaryLoadScenario(name, bytes) {
  const summary = await measureAsyncLatency(
    async () => {
      const core = await createTypaiCore({
        dictionary: {
          mode: "host-provided",
          bytes,
        },
      });

      if (core.getLoadedDictionaryWordCount() === 0) {
        throw new Error("scaled mock dictionary did not load");
      }
    },
    {
      iterations: 20,
      warmupIterations: 2,
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

async function runSuggestScenario(name, core) {
  const suggestionTokens = [
    "reciept",
    "adress",
    "corection",
    "speling",
    "seperate",
    "tommorow",
    "addres",
    "dont",
    "adresss",
    "zzzzword",
  ];
  let tokenIndex = 0;
  const summary = measureSyncLatency(
    () => {
      const token = suggestionTokens[tokenIndex % suggestionTokens.length];
      tokenIndex += 1;
      core.suggestToken({ token, maxSuggestions: 4 });
    },
    {
      iterations: scaledIterationsPerToken * suggestionTokens.length,
      warmupIterations: suggestionTokens.length * 5,
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

async function measureAsyncLatency(operation, options = {}) {
  const iterations = options.iterations ?? 20;
  const warmupIterations = options.warmupIterations ?? 2;
  const samples = [];

  for (let index = 0; index < warmupIterations; index += 1) {
    await operation();
  }

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await operation();
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

function ensureScaledMockAsset() {
  writeDictionaryAsset({
    entries: createScaledMockEntries(defaultScaledMockWordCount),
    binaryPath: scaledMockBinaryPath,
    metaPath: scaledMockMetaPath,
    assetKind: "scaled-mock",
    note: "Generated scaled mock fixture for loader stress benchmarks only. Not a production dictionary or frequency asset.",
  });

  const validation = validateDictionaryAsset({
    binaryPath: scaledMockBinaryPath,
    metaPath: scaledMockMetaPath,
    minWordCount: defaultScaledMockWordCount,
  });

  console.log("scaled mock asset");
  console.log(`words: ${validation.wordCount}`);
  console.log(`bytes: ${validation.byteLength}`);
  console.log(`sha256: ${validation.sha256}`);

  return readFileSync(scaledMockBinaryPath);
}
