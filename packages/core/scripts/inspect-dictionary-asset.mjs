import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeDictionary, sha256 } from "./dictionary-asset-utils.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const workspaceRoot = resolve(packageRoot, "..", "..");
const productionManifestPath = resolve(packageRoot, "assets", "production", "MANIFEST.json");
const fixtureBinaryPath = resolve(
  packageRoot,
  "assets",
  "generated",
  "production-transform-fixture",
  "production-transform-fixture-en-us.dictionary.bin",
);
const fixtureMetadataPath = resolve(
  packageRoot,
  "assets",
  "generated",
  "production-transform-fixture",
  "production-transform-fixture-en-us.dictionary.meta.json",
);
const productionBinaryPath = resolve(
  packageRoot,
  "assets",
  "generated",
  "production",
  "production-en-us.dictionary.bin",
);
const productionMetadataPath = resolve(
  packageRoot,
  "assets",
  "generated",
  "production",
  "production-en-us.dictionary.meta.json",
);

try {
  inspectDictionary(readFlags());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function inspectDictionary(flags) {
  const explicitAsset = flags.get("asset");
  const explicitMetadata = flags.get("metadata");
  const assetPath = explicitAsset
    ? resolveInputPath(explicitAsset)
    : existsSync(fixtureBinaryPath)
      ? fixtureBinaryPath
      : productionBinaryPath;
  const metadataPath = explicitMetadata
    ? resolveInputPath(explicitMetadata)
    : existsSync(fixtureMetadataPath)
      ? fixtureMetadataPath
      : productionMetadataPath;

  if (!existsSync(assetPath) || !existsSync(metadataPath)) {
    printManifestOnlyStatus();
    return;
  }

  const bytes = readFileSync(assetPath);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const decoded = decodeDictionary(bytes);
  const actualSha256 = sha256(bytes);
  const topSampleWords = [...decoded.entries]
    .sort((left, right) => right.frequency - left.frequency || compareAscii(left.word, right.word))
    .slice(0, 8)
    .map((entry) => `${entry.word}:${entry.frequency}`);

  if (metadata.sha256 && metadata.sha256 !== actualSha256) {
    throw new Error(
      `Dictionary metadata hash mismatch: expected ${metadata.sha256}, got ${actualSha256}.`,
    );
  }

  if (metadata.wordCount !== undefined && metadata.wordCount !== decoded.entries.length) {
    throw new Error("Dictionary metadata wordCount does not match decoded blob.");
  }

  if (metadata.byteSize !== undefined && metadata.byteSize !== statSync(assetPath).size) {
    throw new Error("Dictionary metadata byteSize does not match asset size.");
  }

  console.log("Typai dictionary asset inspection");
  console.log(`- asset: ${relativeToWorkspace(assetPath)}`);
  console.log(`- metadata: ${relativeToWorkspace(metadataPath)}`);
  console.log(`- schema version: ${metadata.schemaVersion ?? "unknown"}`);
  console.log(`- asset schema version: ${metadata.assetSchemaVersion ?? decoded.version}`);
  console.log(`- language: ${decoded.language}`);
  console.log(`- word count: ${decoded.entries.length}`);
  console.log(`- byte size: ${bytes.byteLength}`);
  console.log(`- output sha256: ${actualSha256}`);
  console.log(`- top sample words: ${topSampleWords.join(", ")}`);
  console.log(`- excluded counts: ${formatCounts(metadata.excludedCountsByReason)}`);
  console.log(`- frequency coverage: ${metadata.frequencyCoveragePercentage ?? "unknown"}%`);
  console.log(`- package inclusion: ${metadata.packageInclusion ?? "unknown"}`);
}

function printManifestOnlyStatus() {
  if (!existsSync(productionManifestPath)) {
    throw new Error("No generated dictionary asset found and production manifest is missing.");
  }

  const manifest = JSON.parse(readFileSync(productionManifestPath, "utf8"));

  console.log("Typai dictionary asset inspection");
  console.log("- generated asset: none");
  console.log(`- review status: ${manifest.review?.status ?? "unknown"}`);
  console.log(`- package inclusion: ${manifest.output?.packageInclusion ?? "unknown"}`);
  console.log("- word count: none");
  console.log("- byte size: none");
  console.log("- output sha256: none");
  console.log("- top sample words: none");
  console.log("- excluded counts: none");
  console.log("- frequency coverage: none");
}

function formatCounts(counts) {
  if (!counts || Object.keys(counts).length === 0) {
    return "none";
  }

  return Object.entries(counts)
    .sort(([left], [right]) => compareAscii(left, right))
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
}

function readFlags() {
  const flags = new Map();

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const separator = arg.indexOf("=");

    if (separator === -1) {
      flags.set(arg.slice(2), "true");
    } else {
      flags.set(arg.slice(2, separator), arg.slice(separator + 1));
    }
  }

  return flags;
}

function resolveInputPath(path) {
  return isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
}

function relativeToWorkspace(path) {
  return path.startsWith(workspaceRoot)
    ? path.slice(workspaceRoot.length + 1).replaceAll("\\", "/")
    : path;
}

function compareAscii(left, right) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
