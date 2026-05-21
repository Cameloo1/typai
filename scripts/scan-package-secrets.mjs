import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { releasePackages } from "./release-config.mjs";

const findings = [];
const binaryExtensions = new Set([".wasm"]);
const codeLikeExtensions = /\.(?:cjs|css|cts|d\.ts|html|js|json|mjs|mts|ts|txt|md)$/i;
const universalSecretPatterns = [
  { id: "openai_api_key_env", pattern: /\bOPENAI_API_KEY\b/i },
  { id: "direct_openai_domain", pattern: /\bapi\.openai\.com\b/i },
  { id: "private_key_block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "openai_secret_value", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/ },
  { id: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];
const codeOnlySecretPatterns = [
  {
    id: "provider_secret_assignment",
    pattern: /\bprovider(?:_|-)?(?:secret|api(?:_|-)?key)\b\s*[:=]\s*["'][^"']{4,}["']/i,
  },
  {
    id: "generic_private_key_assignment",
    pattern: /\b(?:api|private|secret)(?:_|-)?key\b\s*[:=]\s*["'][^"']{8,}["']/i,
  },
];
const forbiddenPathFragments = [
  ".env",
  "debug-dump",
  "playwright-report",
  "raw-debug",
  "test-results",
];

for (const pkg of releasePackages) {
  const result = runPackDry(pkg.directory);
  const packed = parsePackJson(result.stdout)[0];
  const files = packed.files.map((file) => file.path);
  const productionManifest = readProductionManifest(pkg.directory);
  const productionStatus = productionManifest.review?.status ?? "unknown";
  const packageInclusion = productionManifest.output?.packageInclusion ?? "unknown";

  for (const file of files) {
    scanPath(pkg.name, file);

    if (isRawDictionarySourceFile(file)) {
      findings.push(`${pkg.name} packed output includes raw dictionary/frequency source: ${file}`);
    }

    if (
      pkg.name === "@typai/core" &&
      productionStatus === "blocked" &&
      (file.startsWith("assets/") || isProductionBinaryFile(file))
    ) {
      findings.push(
        `${pkg.name} packed output includes blocked production asset path while packageInclusion is ${packageInclusion}: ${file}`,
      );
    }

    if (!isInspectable(file)) {
      continue;
    }

    const contents = readFileSync(resolve(pkg.directory, file), "utf8");
    scanContents(pkg.name, file, contents);
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`Package secret scan passed for ${releasePackages.length} release packages.`);

function scanPath(packageName, file) {
  const lower = file.toLowerCase();

  for (const fragment of forbiddenPathFragments) {
    if (lower.includes(fragment)) {
      findings.push(
        `${packageName} packed output includes forbidden path fragment ${fragment}: ${file}`,
      );
    }
  }

  if (/^(?:api|examples|routes|server|test|tests)\//.test(lower)) {
    findings.push(`${packageName} packed output includes inappropriate package path: ${file}`);
  }
}

function readProductionManifest(directory) {
  if (directory !== "packages/core") {
    return { review: { status: "not-applicable" }, output: { packageInclusion: "not-applicable" } };
  }

  for (const manifestFile of [
    "assets/production/MANIFEST.json",
    "assets/production/MANIFEST.template.json",
  ]) {
    try {
      return JSON.parse(readFileSync(resolve(directory, manifestFile), "utf8"));
    } catch {
      // Try the fallback manifest path.
    }
  }

  return { review: { status: "unknown" }, output: { packageInclusion: "unknown" } };
}

function isProductionBinaryFile(file) {
  return (
    /production.*\.(?:bin|dictionary|frequency)$/i.test(file) ||
    /(?:^|\/)production-en-us\.dictionary\.bin$/i.test(file)
  );
}

function isRawDictionarySourceFile(file) {
  return (
    /\.(?:aff|dic|gz|tsv|zip)$/i.test(file) ||
    /(?:^|\/)totalcounts-\d+$/i.test(file) ||
    /(?:^|\/)books-ngram/i.test(file)
  );
}

function scanContents(packageName, file, contents) {
  for (const pattern of universalSecretPatterns) {
    if (pattern.pattern.test(contents)) {
      findings.push(`${packageName} packed file ${file} matched ${pattern.id}.`);
    }
  }

  if (file.toLowerCase().endsWith("readme.md")) {
    return;
  }

  for (const pattern of codeOnlySecretPatterns) {
    if (pattern.pattern.test(contents)) {
      findings.push(`${packageName} packed file ${file} matched ${pattern.id}.`);
    }
  }

  if (/openaiResponsesProvider|PROVIDER_MODE\s*=\s*openai/i.test(contents)) {
    findings.push(
      `${packageName} packed file ${file} appears to include server provider example code.`,
    );
  }
}

function isInspectable(file) {
  const lower = file.toLowerCase();

  for (const extension of binaryExtensions) {
    if (lower.endsWith(extension)) {
      return false;
    }
  }

  return codeLikeExtensions.test(file);
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
