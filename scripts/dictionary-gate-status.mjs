import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredDocs = [
  "docs/production-asset-gate-recap.md",
  "docs/dictionary-source-selection.md",
  "docs/dictionary-asset-policy.md",
  "docs/dictionary-production-approval.md",
  "docs/dictionary-asset-blockers.md",
  "docs/intelligence-quality-foundation-complete.md",
];

const requiredRecapPhrases = [
  "Source approval status: **APPROVED**",
  "Asset ingestion status: **BLOCKED",
  "English Speller Database / SCOWL v2",
  "googlebooks-eng-us-20200217",
  "Package inclusion remains `none`",
  "mockOnly: true",
  "production: false",
  "host-provided asset path",
];

const manifestRequiredFields = [
  "schemaVersion",
  "assetKind",
  "language",
  "sourceName",
  "officialSourceUrl",
  "sourceVersion",
  "sourceHash",
  "retrievedAt",
  "licenseName",
  "licenseUrl",
  "redistributionAllowed",
  "commercialUseAllowed",
  "modificationAllowed",
  "attributionRequired",
  "attributionText",
  "transformScript",
  "outputFormat",
  "wordCount",
  "byteSize",
  "sha256",
  "reviewStatus",
  "reviewedBy",
  "reviewedAt",
  "packageInclusion",
];

const failures = [];

for (const file of requiredDocs) {
  if (!existsSync(file)) {
    failures.push(`Missing required asset gate doc: ${file}`);
  }
}

const recapPath = "docs/production-asset-gate-recap.md";
const recapText = existsSync(recapPath) ? readFileSync(recapPath, "utf8") : "";

for (const phrase of requiredRecapPhrases) {
  if (!recapText.includes(phrase)) {
    failures.push(`Asset gate recap missing status phrase: ${phrase}`);
  }
}

const policyText = readIfExists("docs/dictionary-asset-policy.md");
const approvalText = readIfExists("docs/dictionary-production-approval.md");
const blockersText = readIfExists("docs/dictionary-asset-blockers.md");
const corePackage = readJsonIfExists("packages/core/package.json");

if (!/Asset ingestion status:\s+\*\*BLOCKED/i.test(approvalText)) {
  failures.push("Dictionary production approval must keep asset ingestion explicitly blocked.");
}

if (!policyText.includes("compressed package impact: <= 2 MiB")) {
  failures.push("Dictionary asset policy must retain the compressed package impact budget.");
}

if (!blockersText.includes("Production Manifest Missing")) {
  failures.push("Dictionary blockers must record the missing production manifest gate.");
}

if (
  corePackage !== null &&
  Array.isArray(corePackage.files) &&
  corePackage.files.includes("assets")
) {
  failures.push("@typai/core package files must not include the assets directory before approval.");
}

const manifestFiles = listManifestFiles();
for (const file of manifestFiles) {
  validateManifest(file);
}

if (manifestFiles.length === 0 && !recapText.includes("Asset ingestion status: **BLOCKED")) {
  failures.push("No manifests exist, but the recap does not keep asset ingestion blocked.");
}

if (manifestFiles.length === 0 && /package inclusion:\s*`?(optional|bundled)`?/i.test(recapText)) {
  failures.push("No manifests exist, but the recap appears to promote package inclusion.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Production language asset gate status");
console.log(
  "- source path: approved for ESDB/SCOWL en-US size 60 plus Google Ngram American English 2019",
);
console.log(`- manifest files: ${manifestFiles.length}`);
console.log(
  manifestFiles.length === 0
    ? "- production bundling: blocked; package inclusion remains none"
    : "- production bundling: controlled by manifest reviewStatus and packageInclusion",
);
console.log("- scaled mock: mock-only loader/performance fixture");
console.log("- host-provided asset path: available, still provenance-gated");
console.log("Dictionary gate status check passed.");

function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function readJsonIfExists(file) {
  if (!existsSync(file)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON file ${file}: ${error.message}`);
    return null;
  }
}

function listManifestFiles() {
  const manifestDir = "docs/asset-manifests";

  if (!existsSync(manifestDir)) {
    return [];
  }

  return readdirSync(manifestDir)
    .map((entry) => join(manifestDir, entry))
    .filter((file) => file.endsWith(".json") && statSync(file).isFile());
}

function validateManifest(file) {
  const manifest = readJsonIfExists(file);

  if (manifest === null) {
    return;
  }

  for (const field of manifestRequiredFields) {
    if (!(field in manifest)) {
      failures.push(`Manifest ${file} missing field: ${field}`);
    }
  }

  if (manifest.schemaVersion !== 1) {
    failures.push(`Manifest ${file} schemaVersion must be 1.`);
  }

  if (!["dictionary", "frequency", "combined"].includes(manifest.assetKind)) {
    failures.push(`Manifest ${file} has invalid assetKind: ${manifest.assetKind}`);
  }

  if (!["approved", "blocked"].includes(manifest.reviewStatus)) {
    failures.push(`Manifest ${file} has invalid reviewStatus: ${manifest.reviewStatus}`);
  }

  if (!["none", "optional", "bundled"].includes(manifest.packageInclusion)) {
    failures.push(`Manifest ${file} has invalid packageInclusion: ${manifest.packageInclusion}`);
  }

  if (
    manifest.packageInclusion !== "none" &&
    (manifest.reviewStatus !== "approved" ||
      manifest.redistributionAllowed !== true ||
      manifest.commercialUseAllowed !== true ||
      manifest.modificationAllowed !== true)
  ) {
    failures.push(
      `Manifest ${file} cannot use packageInclusion=${manifest.packageInclusion} without approved redistribution, commercial use, and modification gates.`,
    );
  }
}
