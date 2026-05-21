import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, relative, resolve } from "node:path";

import { createTypaiCore } from "../packages/core/dist/index.js";
import {
  createScaledMockEntries,
  defaultScaledMockWordCount,
  scaledMockBinaryPath,
  scaledMockMetaPath,
  sha256,
  validateDictionaryAsset,
  writeDictionaryAsset,
} from "../packages/core/scripts/dictionary-asset-utils.mjs";

const productionManifestPath = resolve("packages/core/assets/production/MANIFEST.json");
const mockDictionaryPath = resolve("packages/core/assets/mock-en-us.dictionary.bin");
const checkTokens = ["teh", "reciept", "adress", "form", "user@example.com", "ffuf", "zzzzword"];
const suggestTokens = ["reciept", "addres", "separat", "tomorow", "adresss", "zzzzword"];
const thresholds = {
  loadWarningMs: 250,
  loadFailMs: 1000,
  hotPathWarningMs: 20,
  hotPathFailMs: 100,
  memoryWarningBytes: 8 * 1024 * 1024,
  memoryFailBytes: 32 * 1024 * 1024,
  blockedCorePackageWarningBytes: 256 * 1024,
  blockedCorePackageFailBytes: 1024 * 1024,
  assetByteWarningBytes: 2 * 1024 * 1024,
  assetByteFailBytes: 8 * 1024 * 1024,
};
const failures = [];
const warnings = [];

const manifest = readJson(productionManifestPath);
const productionStatus = manifest.review?.status ?? "unknown";
const productionPackageInclusion = manifest.output?.packageInclusion ?? "unknown";
const productionManifestWordCount = manifest.output?.wordCount ?? null;
const productionBlocked = await probeProductionModeBlocked();
const scaledMockBytes = ensureScaledMockAsset();
const builtIn = await runBuiltInScenario();
const hostProvidedFixture = await runAssetScenario({
  name: "host-provided mock fixture",
  assetMode: "host-provided",
  bytes: readFileSync(mockDictionaryPath),
  expectedMinimumWords: 1,
});
const scaledMock = await runAssetScenario({
  name: "scaled mock fixture",
  assetMode: "scaled-mock",
  bytes: scaledMockBytes,
  expectedMinimumWords: defaultScaledMockWordCount,
});
const corePackage = inspectCorePackage();
const productionScenario = await maybeRunProductionScenario(manifest);

if (productionStatus === "blocked" && !productionBlocked) {
  failures.push(
    "production dictionary mode must be blocked while manifest review.status is blocked",
  );
}

if (productionStatus === "blocked" && productionPackageInclusion !== "blocked") {
  failures.push(
    `blocked production manifest must keep output.packageInclusion blocked, got ${productionPackageInclusion}`,
  );
}

if (
  productionStatus === "blocked" &&
  corePackage.sizeBytes > thresholds.blockedCorePackageWarningBytes
) {
  warnings.push(
    `@typai/core tarball ${formatBytes(
      corePackage.sizeBytes,
    )} exceeds blocked-state warning threshold ${formatBytes(
      thresholds.blockedCorePackageWarningBytes,
    )}`,
  );
}

if (
  productionStatus === "blocked" &&
  corePackage.sizeBytes > thresholds.blockedCorePackageFailBytes
) {
  failures.push(
    `@typai/core tarball ${formatBytes(
      corePackage.sizeBytes,
    )} exceeds blocked-state failure threshold ${formatBytes(
      thresholds.blockedCorePackageFailBytes,
    )}`,
  );
}

printReport();

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`error: ${failure}`);
  }

  process.exitCode = 1;
}

async function maybeRunProductionScenario(currentManifest) {
  if (currentManifest.review?.status !== "approved") {
    return null;
  }

  const assetPath = currentManifest.output?.assetPath;

  if (typeof assetPath !== "string" || assetPath.length === 0 || !existsSync(resolve(assetPath))) {
    failures.push("approved production manifest is missing an existing output.assetPath");
    return null;
  }

  return runAssetScenario({
    name: "approved production asset",
    assetMode: "production",
    bytes: readFileSync(resolve(assetPath)),
    expectedMinimumWords: currentManifest.output?.wordCount ?? 1,
  });
}

async function runBuiltInScenario() {
  return runCoreScenario({
    name: "built-in tiny mode",
    assetMode: "built-in",
    createCore: () => createTypaiCore(),
    assetByteSize: 0,
    assetSha256: "",
    expectedMinimumWords: 0,
  });
}

async function runAssetScenario({ name, assetMode, bytes, expectedMinimumWords }) {
  return runCoreScenario({
    name,
    assetMode,
    createCore: () =>
      createTypaiCore({
        dictionary: {
          mode: "host-provided",
          bytes,
        },
      }),
    assetByteSize: bytes.byteLength,
    assetSha256: sha256(bytes),
    expectedMinimumWords,
  });
}

async function runCoreScenario({
  name,
  assetMode,
  createCore,
  assetByteSize,
  assetSha256,
  expectedMinimumWords,
}) {
  const loadSummary = await measureAsyncLatency(
    async () => {
      const core = await createCore();

      if (core.getLoadedDictionaryWordCount() < expectedMinimumWords) {
        throw new Error(`${name} loaded fewer words than expected.`);
      }
    },
    {
      iterations: 20,
      warmupIterations: 2,
    },
  );
  const core = await createCore();
  const checkSummary = measureSyncLatency(
    (index) => {
      core.checkCompletedToken({ token: checkTokens[index % checkTokens.length] });
    },
    {
      iterations: checkTokens.length * 500,
      warmupIterations: checkTokens.length * 10,
    },
  );
  const suggestSummary = measureSyncLatency(
    (index) => {
      core.suggestToken({ token: suggestTokens[index % suggestTokens.length], maxSuggestions: 4 });
    },
    {
      iterations: suggestTokens.length * 200,
      warmupIterations: suggestTokens.length * 10,
    },
  );
  const result = {
    name,
    assetMode,
    assetByteSize,
    assetSha256,
    loadedWordCount: core.getLoadedDictionaryWordCount(),
    deleteIndexEntryCount: core.getDeleteIndexEntryCount(),
    memoryEstimateBytes: core.getDeleteIndexMemoryEstimateBytes(),
    loadSummary,
    deleteIndexBuildSummary: loadSummary,
    checkSummary,
    suggestSummary,
  };

  assertScenarioThresholds(result);

  return result;
}

function assertScenarioThresholds(result) {
  if (result.assetByteSize > thresholds.assetByteWarningBytes) {
    warnings.push(
      `${result.name} asset byte size ${formatBytes(
        result.assetByteSize,
      )} exceeds warning threshold ${formatBytes(thresholds.assetByteWarningBytes)}`,
    );
  }

  if (result.assetByteSize > thresholds.assetByteFailBytes) {
    failures.push(
      `${result.name} asset byte size ${formatBytes(
        result.assetByteSize,
      )} exceeds failure threshold ${formatBytes(thresholds.assetByteFailBytes)}`,
    );
  }

  if (result.loadSummary.p95 > thresholds.loadWarningMs) {
    warnings.push(
      `${result.name} load p95 ${formatMs(
        result.loadSummary.p95,
      )} exceeds ${formatMs(thresholds.loadWarningMs)} warning threshold`,
    );
  }

  if (result.loadSummary.p95 > thresholds.loadFailMs) {
    failures.push(
      `${result.name} load p95 ${formatMs(
        result.loadSummary.p95,
      )} exceeds ${formatMs(thresholds.loadFailMs)} failure threshold`,
    );
  }

  if (result.checkSummary.p95 > thresholds.hotPathWarningMs) {
    warnings.push(
      `${result.name} check p95 ${formatMs(
        result.checkSummary.p95,
      )} exceeds ${formatMs(thresholds.hotPathWarningMs)} warning threshold`,
    );
  }

  if (result.checkSummary.p95 > thresholds.hotPathFailMs) {
    failures.push(
      `${result.name} check p95 ${formatMs(
        result.checkSummary.p95,
      )} exceeds ${formatMs(thresholds.hotPathFailMs)} failure threshold`,
    );
  }

  if (result.suggestSummary.p95 > thresholds.hotPathWarningMs) {
    warnings.push(
      `${result.name} suggest p95 ${formatMs(
        result.suggestSummary.p95,
      )} exceeds ${formatMs(thresholds.hotPathWarningMs)} warning threshold`,
    );
  }

  if (result.suggestSummary.p95 > thresholds.hotPathFailMs) {
    failures.push(
      `${result.name} suggest p95 ${formatMs(
        result.suggestSummary.p95,
      )} exceeds ${formatMs(thresholds.hotPathFailMs)} failure threshold`,
    );
  }

  if (result.memoryEstimateBytes > thresholds.memoryWarningBytes) {
    warnings.push(
      `${result.name} memory estimate ${formatBytes(
        result.memoryEstimateBytes,
      )} exceeds ${formatBytes(thresholds.memoryWarningBytes)} warning threshold`,
    );
  }

  if (result.memoryEstimateBytes > thresholds.memoryFailBytes) {
    failures.push(
      `${result.name} memory estimate ${formatBytes(
        result.memoryEstimateBytes,
      )} exceeds ${formatBytes(thresholds.memoryFailBytes)} failure threshold`,
    );
  }
}

async function probeProductionModeBlocked() {
  return createTypaiCore({
    dictionary: {
      mode: "production",
    },
  }).then(
    () => false,
    (error) =>
      error instanceof Error && /production dictionary asset is unavailable/i.test(error.message),
  );
}

function ensureScaledMockAsset() {
  writeDictionaryAsset({
    entries: createScaledMockEntries(defaultScaledMockWordCount),
    binaryPath: scaledMockBinaryPath,
    metaPath: scaledMockMetaPath,
    assetKind: "scaled-mock",
    note: "Generated scaled mock fixture for language asset performance benchmarks only. Not a production dictionary or frequency asset.",
  });

  validateDictionaryAsset({
    binaryPath: scaledMockBinaryPath,
    metaPath: scaledMockMetaPath,
    minWordCount: defaultScaledMockWordCount,
  });

  return readFileSync(scaledMockBinaryPath);
}

function inspectCorePackage() {
  const result = runPackDry("packages/core");
  const packed = parsePackJson(result.stdout)[0];
  const files = packed.files.map((file) => file.path);

  if (productionStatus === "blocked") {
    for (const file of files) {
      if (
        file.startsWith("assets/") ||
        /production.*dictionary/i.test(file) ||
        /(?:dictionary|frequency).*\.(?:bin|gz|dic|aff|tsv|zip)$/i.test(file)
      ) {
        failures.push(`@typai/core tarball includes blocked/raw asset file: ${file}`);
      }
    }
  }

  return {
    filename: packed.filename,
    sizeBytes: packed.size,
    unpackedSizeBytes: packed.unpackedSize,
    fileCount: files.length,
    files,
  };
}

function runPackDry(cwd) {
  const npmCommand = resolveCommand("npm", ["pack", "--dry-run", "--json"]);
  const result = spawnSync(npmCommand.command, npmCommand.args, {
    cwd: resolve(cwd),
    encoding: "utf8",
    env: createCommandEnv(),
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? result.error?.message ?? "");
    process.exit(result.status ?? 1);
  }

  return result;
}

function printReport() {
  console.log("Typai language asset benchmark");
  console.log(`production manifest: ${relativePath(productionManifestPath)}`);
  console.log(`production review.status: ${productionStatus}`);
  console.log(`production package inclusion: ${productionPackageInclusion}`);
  console.log(
    `production manifest word count: ${
      productionManifestWordCount === null ? "not generated" : productionManifestWordCount
    }`,
  );
  console.log(`production dictionary mode blocked: ${productionBlocked ? "yes" : "no"}`);
  console.log(`status: ${failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass"}`);
  console.log("");
  console.log("thresholds");
  console.log(
    `load/delete-index p95 warn/fail: ${formatMs(thresholds.loadWarningMs)} / ${formatMs(
      thresholds.loadFailMs,
    )}`,
  );
  console.log(
    `check/suggest p95 warn/fail: ${formatMs(thresholds.hotPathWarningMs)} / ${formatMs(
      thresholds.hotPathFailMs,
    )}`,
  );
  console.log(
    `memory estimate warn/fail: ${formatBytes(thresholds.memoryWarningBytes)} / ${formatBytes(
      thresholds.memoryFailBytes,
    )}`,
  );
  console.log(
    `blocked @typai/core tarball warn/fail: ${formatBytes(
      thresholds.blockedCorePackageWarningBytes,
    )} / ${formatBytes(thresholds.blockedCorePackageFailBytes)}`,
  );
  console.log(
    `asset byte size warn/fail: ${formatBytes(
      thresholds.assetByteWarningBytes,
    )} / ${formatBytes(thresholds.assetByteFailBytes)}`,
  );

  printAssetScenario(builtIn);
  printAssetScenario(hostProvidedFixture);
  printAssetScenario(scaledMock);

  if (productionScenario !== null) {
    printAssetScenario(productionScenario);
  }

  console.log("");
  console.log("@typai/core package impact");
  console.log(`filename: ${corePackage.filename}`);
  console.log(`packed size: ${formatBytes(corePackage.sizeBytes)}`);
  console.log(`unpacked size: ${formatBytes(corePackage.unpackedSizeBytes)}`);
  console.log(`files: ${corePackage.fileCount}`);
  console.log(
    `blocked/raw production asset included: ${
      corePackage.files.some((file) => file.startsWith("assets/")) ? "yes" : "no"
    }`,
  );
  console.log("");
  console.log(
    `language-asset-benchmark-json: ${JSON.stringify({
      production: {
        status: productionStatus,
        packageInclusion: productionPackageInclusion,
        manifestWordCount: productionManifestWordCount,
        blocked: productionBlocked,
      },
      status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
      assets: [builtIn, hostProvidedFixture, scaledMock, productionScenario]
        .filter(Boolean)
        .map((asset) => summarizeScenarioForJson(asset)),
      corePackage,
      thresholds,
      warnings,
      failures,
    })}`,
  );
}

function printAssetScenario(result) {
  console.log("");
  console.log(result.name);
  console.log(`asset mode: ${result.assetMode}`);
  console.log(`asset byte size: ${formatBytes(result.assetByteSize)}`);
  console.log(`asset sha256: ${result.assetSha256 || "n/a"}`);
  console.log(`manifest word count: ${productionManifestWordCount ?? "not generated"}`);
  console.log(`loaded word count: ${result.loadedWordCount}`);
  console.log(`delete-index entries: ${result.deleteIndexEntryCount}`);
  console.log(`memory estimate: ${formatBytes(result.memoryEstimateBytes)}`);
  console.log(`dictionary load mean/p50/p95/p99: ${formatLatencySummary(result.loadSummary)}`);
  console.log(
    `delete-index build mean/p50/p95/p99: ${formatLatencySummary(
      result.deleteIndexBuildSummary,
    )} (initialization-inclusive)`,
  );
  console.log(`core check p95: ${formatMs(result.checkSummary.p95)}`);
  console.log(`core suggest p95: ${formatMs(result.suggestSummary.p95)}`);
}

function summarizeScenarioForJson(result) {
  return {
    name: result.name,
    assetMode: result.assetMode,
    assetByteSize: result.assetByteSize,
    assetSha256: result.assetSha256,
    loadedWordCount: result.loadedWordCount,
    deleteIndexEntryCount: result.deleteIndexEntryCount,
    memoryEstimateBytes: result.memoryEstimateBytes,
    loadSummary: result.loadSummary,
    deleteIndexBuildSummary: result.deleteIndexBuildSummary,
    checkSummary: result.checkSummary,
    suggestSummary: result.suggestSummary,
  };
}

function measureSyncLatency(operation, options) {
  const samples = [];

  for (let index = 0; index < options.warmupIterations; index += 1) {
    operation(index);
  }

  for (let index = 0; index < options.iterations; index += 1) {
    const startedAt = performance.now();
    operation(index);
    samples.push(performance.now() - startedAt);
  }

  return summarizeLatencies(samples);
}

async function measureAsyncLatency(operation, options) {
  const samples = [];

  for (let index = 0; index < options.warmupIterations; index += 1) {
    await operation(index);
  }

  for (let index = 0; index < options.iterations; index += 1) {
    const startedAt = performance.now();
    await operation(index);
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

function parsePackJson(stdout) {
  const match = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/);

  if (match === null) {
    throw new Error(`Could not find npm pack JSON output:\n${stdout}`);
  }

  return JSON.parse(match[0]);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function formatLatencySummary(summary) {
  return `${formatMs(summary.mean)} / ${formatMs(summary.p50)} / ${formatMs(
    summary.p95,
  )} / ${formatMs(summary.p99)}`;
}

function formatMs(value) {
  return `${value.toFixed(4)} ms`;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KiB`;
  }

  return `${value} B`;
}

function relativePath(path) {
  return relative(resolve("."), resolve(path)).replaceAll("\\", "/");
}

function resolveCommand(command, args) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `${command}.cmd`, ...args],
    };
  }

  return { command, args };
}

function createCommandEnv() {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const currentPath = process.env[pathKey] ?? process.env.PATH ?? "";
  const localBins = [resolve(".codex-tools"), resolve("node_modules", ".bin")];

  return {
    ...process.env,
    [pathKey]: [...localBins, currentPath].filter(Boolean).join(delimiter),
  };
}
