import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";

import { releasePackages } from "./release-config.mjs";

const productionManifestPath = resolve("packages/core/assets/production/MANIFEST.template.json");
const manifest = readJson(productionManifestPath);
const productionStatus = manifest.review?.status ?? "unknown";
const productionPackageInclusion = manifest.output?.packageInclusion ?? "unknown";
const thresholds = {
  packageWarningBytes: 512 * 1024,
  packageFailBytes: 2 * 1024 * 1024,
  blockedCoreWarningBytes: 256 * 1024,
  blockedCoreFailBytes: 1024 * 1024,
  productionAssetTargetBytes: 2 * 1024 * 1024,
  productionAssetFailBytes: 8 * 1024 * 1024,
};
const findings = [];
const warnings = [];
const packageReports = releasePackages.map(inspectPackage);

for (const report of packageReports) {
  validatePackageSize(report);
  validatePackedFiles(report);
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
  };
}

function validatePackageSize(report) {
  if (report.name === "@typai/core" && productionStatus === "blocked") {
    if (report.sizeBytes > thresholds.blockedCoreWarningBytes) {
      warnings.push(
        `${report.name} blocked-state tarball ${formatBytes(
          report.sizeBytes,
        )} exceeds warning threshold ${formatBytes(thresholds.blockedCoreWarningBytes)}`,
      );
    }

    if (report.sizeBytes > thresholds.blockedCoreFailBytes) {
      findings.push(
        `${report.name} blocked-state tarball ${formatBytes(
          report.sizeBytes,
        )} exceeds failure threshold ${formatBytes(thresholds.blockedCoreFailBytes)}`,
      );
    }

    return;
  }

  if (report.sizeBytes > thresholds.packageWarningBytes) {
    warnings.push(
      `${report.name} tarball ${formatBytes(report.sizeBytes)} exceeds warning threshold ${formatBytes(
        thresholds.packageWarningBytes,
      )}`,
    );
  }

  if (report.sizeBytes > thresholds.packageFailBytes) {
    findings.push(
      `${report.name} tarball ${formatBytes(report.sizeBytes)} exceeds failure threshold ${formatBytes(
        thresholds.packageFailBytes,
      )}`,
    );
  }
}

function validatePackedFiles(report) {
  for (const file of report.files) {
    if (file.path.toLowerCase().includes(".env")) {
      findings.push(`${report.name} includes env-like file: ${file.path}`);
    }

    if (isRawSourceFile(file.path)) {
      findings.push(`${report.name} includes raw dictionary/frequency source file: ${file.path}`);
    }

    if (isProductionAssetFile(file.path) && productionStatus === "blocked") {
      findings.push(`${report.name} includes blocked production asset file: ${file.path}`);
    }

    if (isInspectable(file.path)) {
      validateInspectableFile(report, file.path);
    }
  }

  if (report.name !== "@typai/core") {
    return;
  }

  if (productionStatus === "blocked") {
    if (productionPackageInclusion !== "blocked") {
      findings.push(
        `blocked manifest must keep output.packageInclusion blocked, got ${productionPackageInclusion}`,
      );
    }

    for (const file of report.files) {
      if (file.path.startsWith("assets/")) {
        findings.push(
          `@typai/core includes assets/ while production manifest is blocked: ${file.path}`,
        );
      }
    }

    return;
  }

  if (productionStatus !== "approved") {
    findings.push(
      `production manifest review.status must be blocked or approved, got ${productionStatus}`,
    );
    return;
  }

  if (
    productionPackageInclusion === "committed" ||
    productionPackageInclusion === "generated-in-prepack"
  ) {
    requireCoreProductionNoticeFiles(report);
    validateIncludedProductionAssetSize(report);
  }
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

function requireCoreProductionNoticeFiles(report) {
  const paths = new Set(report.files.map((file) => file.path));
  const required = [
    "assets/production/MANIFEST.json",
    "assets/production/ATTRIBUTION.md",
    "assets/production/LICENSES/README.md",
  ];

  for (const filePath of required) {
    if (!paths.has(filePath)) {
      findings.push(`@typai/core approved production inclusion is missing ${filePath}`);
    }
  }
}

function validateIncludedProductionAssetSize(report) {
  const productionAssets = report.files.filter((file) => isProductionAssetFile(file.path));
  const totalProductionAssetBytes = productionAssets.reduce(
    (total, file) => total + file.sizeBytes,
    0,
  );

  if (totalProductionAssetBytes > thresholds.productionAssetTargetBytes) {
    warnings.push(
      `@typai/core production asset files total ${formatBytes(
        totalProductionAssetBytes,
      )}, above target ${formatBytes(thresholds.productionAssetTargetBytes)}`,
    );
  }

  if (totalProductionAssetBytes > thresholds.productionAssetFailBytes) {
    findings.push(
      `@typai/core production asset files total ${formatBytes(
        totalProductionAssetBytes,
      )}, above failure threshold ${formatBytes(thresholds.productionAssetFailBytes)}`,
    );
  }
}

function printReport() {
  console.log("Typai package size report");
  console.log(`production review.status: ${productionStatus}`);
  console.log(`production package inclusion: ${productionPackageInclusion}`);
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
      production: {
        status: productionStatus,
        packageInclusion: productionPackageInclusion,
      },
      thresholds,
      packages: packageReports,
      warnings,
      findings,
    })}`,
  );
}

function isProductionAssetFile(path) {
  return (
    path.startsWith("assets/production/") ||
    /production.*dictionary/i.test(path) ||
    /production.*frequency/i.test(path)
  );
}

function isRawSourceFile(path) {
  return (
    /\.(?:aff|dic|gz|tsv|zip)$/i.test(path) ||
    /(?:^|\/)totalcounts-\d+$/i.test(path) ||
    /(?:^|\/)books-ngram/i.test(path)
  );
}

function isInspectable(path) {
  return /\.(?:cjs|css|cts|d\.ts|html|js|json|mjs|mts|ts|txt|md)$/i.test(path);
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
