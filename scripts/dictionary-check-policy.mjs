import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredDocs = [
  "docs/dictionary-source-selection.md",
  "docs/dictionary-asset-policy.md",
  "docs/dictionary-production-approval.md",
  "docs/dictionary-asset-blockers.md",
];

const requiredManifestFields = [
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
    failures.push(`Missing dictionary policy doc: ${file}`);
  }
}

const approvalPath = "docs/dictionary-production-approval.md";
const approvalText = existsSync(approvalPath) ? readFileSync(approvalPath, "utf8") : "";
const assetIngestionBlocked = /Asset ingestion status:\s+\*\*BLOCKED/i.test(approvalText);

const manifestDir = "docs/asset-manifests";
const manifestFiles = existsSync(manifestDir)
  ? readdirSync(manifestDir)
      .map((entry) => join(manifestDir, entry))
      .filter((file) => file.endsWith(".json") && statSync(file).isFile())
  : [];

if (manifestFiles.length === 0 && !assetIngestionBlocked) {
  failures.push(
    "No dictionary asset manifests found, but production approval does not explicitly block asset ingestion.",
  );
}

for (const file of manifestFiles) {
  validateManifest(file);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const suffix =
  manifestFiles.length === 0
    ? "asset ingestion blocked; no manifest required yet"
    : `${manifestFiles.length} manifest(s) validated`;

console.log(`Dictionary policy check passed: ${suffix}.`);

function validateManifest(file) {
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON manifest ${file}: ${error.message}`);
    return;
  }

  for (const field of requiredManifestFields) {
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

  for (const field of [
    "redistributionAllowed",
    "commercialUseAllowed",
    "modificationAllowed",
    "attributionRequired",
  ]) {
    if (typeof manifest[field] !== "boolean") {
      failures.push(`Manifest ${file} field ${field} must be boolean.`);
    }
  }

  for (const field of ["wordCount", "byteSize"]) {
    if (!Number.isInteger(manifest[field]) || manifest[field] < 0) {
      failures.push(`Manifest ${file} field ${field} must be a non-negative integer.`);
    }
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
