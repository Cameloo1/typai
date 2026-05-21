import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";

import {
  createPackagePolicyReport,
  isInspectable,
  isProductionAssetFile,
  isProductionBinaryFile,
  isProductionNoticeFile,
  isRawSourceFile,
  defaultPackageSizeThresholds as thresholds,
} from "./package-size-report-utils.mjs";
import { releasePackages } from "./release-config.mjs";

const productionManifestPath = resolve("packages/core/assets/production/MANIFEST.json");
const manifest = readJson(productionManifestPath);
const packageReports = releasePackages.map(inspectPackage);
const policyReport = createPackagePolicyReport({
  manifest,
  packageReports,
  thresholds,
});
const { production, warnings, findings } = policyReport;

for (const report of packageReports) {
  for (const file of report.files) {
    if (isInspectable(file.path)) {
      validateInspectableFile(report, file.path);
    }
  }
}

printReport();

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`error: ${finding}`);
  }

  process.exitCode = 1;
}

function inspectPackage(pkg) {
  const result = runPackDry(pkg.directory);
  const packed = parsePackJson(result.stdout)[0];

  return {
    name: pkg.name,
    directory: pkg.directory,
    filename: packed.filename,
    sizeBytes: packed.size,
    unpackedSizeBytes: packed.unpackedSize,
    fileCount: packed.files.length,
    files: packed.files.map((file) => ({
      path: file.path,
      sizeBytes: file.size,
    })),
    generatedWasmBytes: packed.files
      .filter((file) => file.path.toLowerCase().endsWith(".wasm"))
      .reduce((total, file) => total + file.size, 0),
    productionBinaryBytes: packed.files
      .filter((file) => isProductionBinaryFile(file.path))
      .reduce((total, file) => total + file.size, 0),
    productionBinaryFiles: packed.files
      .filter((file) => isProductionBinaryFile(file.path))
      .map((file) => file.path),
    rawSourceFiles: packed.files
      .filter((file) => isRawSourceFile(file.path))
      .map((file) => file.path),
    productionNoticeFiles: packed.files
      .filter((file) => isProductionNoticeFile(file.path))
      .map((file) => file.path),
  };
}

function validateInspectableFile(report, filePath) {
  const contents = readFileSync(resolve(report.directory, filePath), "utf8");

  if (/\bOPENAI_API_KEY\b/i.test(contents)) {
    findings.push(`${report.name} packed file ${filePath} includes OPENAI_API_KEY.`);
  }

  if (/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/.test(contents)) {
    findings.push(`${report.name} packed file ${filePath} includes secret-looking token.`);
  }

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(contents)) {
    findings.push(`${report.name} packed file ${filePath} includes private-key-looking content.`);
  }
}

function printReport() {
  console.log("Typai package size report");
  console.log(`production review.status: ${production.status}`);
  console.log(`production package inclusion: ${production.packageInclusion}`);
  console.log(`selected delivery mode: ${production.selectedDeliveryMode}`);
  console.log(
    `blocked @typai/core warn/fail: ${formatBytes(
      thresholds.blockedCoreWarningBytes,
    )} / ${formatBytes(thresholds.blockedCoreFailBytes)}`,
  );
  console.log(
    `package warn/fail: ${formatBytes(thresholds.packageWarningBytes)} / ${formatBytes(
      thresholds.packageFailBytes,
    )}`,
  );
  console.log(
    `production asset target/fail: ${formatBytes(
      thresholds.productionAssetTargetBytes,
    )} / ${formatBytes(thresholds.productionAssetFailBytes)}`,
  );

  for (const report of packageReports) {
    console.log("");
    console.log(report.name);
    console.log(`filename: ${report.filename}`);
    console.log(`packed size: ${formatBytes(report.sizeBytes)}`);
    console.log(`unpacked size: ${formatBytes(report.unpackedSizeBytes)}`);
    console.log(`files: ${report.fileCount}`);
    console.log(`generated Wasm size: ${formatBytes(report.generatedWasmBytes)}`);
    console.log(`production binary included: ${report.productionBinaryFiles.join(", ") || "no"}`);
    console.log(`production binary size: ${formatBytes(report.productionBinaryBytes)}`);
    console.log(`raw source files included: ${report.rawSourceFiles.join(", ") || "no"}`);
    console.log(
      `manifest/license/attribution included: ${report.productionNoticeFiles.join(", ") || "no"}`,
    );
    console.log(
      `production/raw asset files: ${
        report.files
          .filter((file) => isProductionAssetFile(file.path) || isRawSourceFile(file.path))
          .map((file) => file.path)
          .join(", ") || "none"
      }`,
    );
  }

  console.log("");
  console.log(
    `package-size-report-json: ${JSON.stringify({
      ...policyReport,
      findings,
      warnings,
    })}`,
  );
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
