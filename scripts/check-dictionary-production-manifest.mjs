import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const productionDir = "packages/core/assets/production";
const manifestPath = join(productionDir, "MANIFEST.json");
const blockersPath = "docs/dictionary-asset-blockers.md";
const attributionPath = join(productionDir, "ATTRIBUTION.md");

const packageInclusionValues = new Set([
  "blocked",
  "host-provided-only",
  "generated-during-prepack",
  "committed-generated-binary",
]);
const redistributionValues = new Set(["approved", "blocked", "unknown"]);
const forbiddenRawSourceExtensions = new Set([
  ".aff",
  ".csv",
  ".dic",
  ".gz",
  ".ngram",
  ".ngrams",
  ".source",
  ".sqlite",
  ".tsv",
  ".txt",
  ".zip",
]);
const forbiddenGeneratedExtensions = new Set([".bin", ".blob", ".dat"]);
const failures = [];

if (!existsSync(manifestPath)) {
  failures.push(`Missing production dictionary manifest: expected ${manifestPath}.`);
  reportAndExit();
}

const manifest = readJson(manifestPath);

validateManifest(manifest);
validateProductionAssetFiles(manifest);
validateBlockedDocumentation(manifest);

reportAndExit();

if (manifest.review.status === "blocked") {
  console.log("Dictionary production manifest status: blocked.");
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Package inclusion: ${manifest.output.packageInclusion}`);
  console.log("No production dictionary/frequency asset is bundled.");
  console.log(`Review notes: ${manifest.review.reviewNotes}`);
} else {
  console.log("Dictionary production manifest status: approved.");
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Package inclusion: ${manifest.output.packageInclusion}`);
  console.log(`Asset path: ${manifest.output.assetPath}`);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON manifest ${file}: ${error.message}`);
    return {};
  }
}

function validateManifest(candidate) {
  requireObject(candidate, "manifest");
  requireLiteral(candidate.schemaVersion, 1, "schemaVersion");
  requireString(candidate.language, "language");
  requireObject(candidate.dictionary, "dictionary");
  requireObject(candidate.frequency, "frequency");
  requireObject(candidate.transform, "transform");
  requireObject(candidate.output, "output");
  requireObject(candidate.review, "review");

  validateSourceBlock(candidate.dictionary, "dictionary");
  validateSourceBlock(candidate.frequency, "frequency");
  validateTransform(candidate.transform);
  validateOutput(candidate.output);
  validateReview(candidate.review);

  if (candidate.review?.status === "approved") {
    validateApprovedManifest(candidate);
  }

  if (candidate.review?.status === "blocked") {
    validateBlockedManifest(candidate);
  }
}

function validateSourceBlock(source, label) {
  requireString(source.name, `${label}.name`);
  requireString(source.sourceUrl, `${label}.sourceUrl`);
  requireString(source.version, `${label}.version`);
  requireArray(source.sourceFiles, `${label}.sourceFiles`);
  requireString(source.license, `${label}.license`);
  requireString(source.licenseFile, `${label}.licenseFile`);
  requireString(source.attribution, `${label}.attribution`);
  requireEnum(source.redistribution, redistributionValues, `${label}.redistribution`);

  if (source.sha256 !== "") {
    requireSha256(source.sha256, `${label}.sha256`);
  }

  source.sourceFiles.forEach((entry, index) => {
    requireObject(entry, `${label}.sourceFiles[${index}]`);
    requireString(entry.url, `${label}.sourceFiles[${index}].url`);
    requireString(entry.fileName, `${label}.sourceFiles[${index}].fileName`);

    if (entry.sha256 !== "") {
      requireSha256(entry.sha256, `${label}.sourceFiles[${index}].sha256`);
    }
  });
}

function validateTransform(transform) {
  requireString(transform.script, "transform.script");
  requireString(transform.version, "transform.version");
  requireArray(transform.filters, "transform.filters");

  if (transform.networkFetchAllowed !== false) {
    failures.push("transform.networkFetchAllowed must be false.");
  }
}

function validateOutput(output) {
  if (output.wordCount !== null && !isNonNegativeInteger(output.wordCount)) {
    failures.push("output.wordCount must be null or a non-negative integer.");
  }

  if (output.byteSize !== null && !isNonNegativeInteger(output.byteSize)) {
    failures.push("output.byteSize must be null or a non-negative integer.");
  }

  requireStringOrEmpty(output.sha256, "output.sha256");
  if (output.sha256 !== "") {
    requireSha256(output.sha256, "output.sha256");
  }

  requireEnum(output.packageInclusion, packageInclusionValues, "output.packageInclusion");
  requireStringOrEmpty(output.assetPath, "output.assetPath");
}

function validateReview(review) {
  requireEnum(review.status, new Set(["approved", "blocked"]), "review.status");
  requireString(review.reviewedAt, "review.reviewedAt");
  requireString(review.reviewer, "review.reviewer");
  requireString(review.reviewNotes, "review.reviewNotes");
}

function validateApprovedManifest(candidate) {
  for (const [label, source] of [
    ["dictionary", candidate.dictionary],
    ["frequency", candidate.frequency],
  ]) {
    requireSha256(source.sha256, `${label}.sha256`);
    requireExistingFile(source.licenseFile, `${label}.licenseFile`);

    if (source.redistribution !== "approved") {
      failures.push(`${label}.redistribution must be approved.`);
    }

    source.sourceFiles.forEach((entry, index) => {
      requireSha256(entry.sha256, `${label}.sourceFiles[${index}].sha256`);
    });
  }

  requireExistingFile(attributionPath, "ATTRIBUTION.md");

  if (!isPositiveInteger(candidate.output.wordCount)) {
    failures.push("approved manifest requires output.wordCount > 0.");
  }

  if (!isPositiveInteger(candidate.output.byteSize)) {
    failures.push("approved manifest requires output.byteSize > 0.");
  }

  requireSha256(candidate.output.sha256, "output.sha256");

  if (candidate.output.packageInclusion === "blocked") {
    failures.push("approved manifest cannot keep output.packageInclusion blocked.");
  }

  requireString(candidate.output.assetPath, "output.assetPath");
  requireExistingFile(candidate.output.assetPath, "output.assetPath");
}

function validateBlockedManifest(candidate) {
  if (candidate.output.packageInclusion !== "blocked") {
    failures.push("blocked manifest must keep output.packageInclusion set to blocked.");
  }

  if (candidate.output.assetPath !== "") {
    failures.push("blocked manifest must not point to a production asset path.");
  }

  if (candidate.output.wordCount !== null || candidate.output.byteSize !== null) {
    failures.push("blocked manifest must not claim generated output wordCount or byteSize.");
  }

  if (candidate.output.sha256 !== "") {
    failures.push("blocked manifest must not claim a generated output SHA-256.");
  }
}

function validateProductionAssetFiles(candidate) {
  if (!existsSync(productionDir)) {
    return;
  }

  const allowedBlockedFiles = new Set([
    normalize(join(productionDir, "MANIFEST.json")),
    normalize(join(productionDir, "MANIFEST.template.json")),
    normalize(join(productionDir, "ATTRIBUTION.md")),
    normalize(join(productionDir, "LICENSES", "README.md")),
  ]);

  for (const file of walkFiles(productionDir)) {
    const normalized = normalize(file);
    const extension = getExtension(file);

    if (
      forbiddenRawSourceExtensions.has(extension) ||
      forbiddenGeneratedExtensions.has(extension)
    ) {
      failures.push(`Production asset gate forbids raw/generated file: ${file}`);
    }

    if (candidate.review?.status === "blocked" && !allowedBlockedFiles.has(normalized)) {
      failures.push(`Blocked production asset status cannot include file: ${file}`);
    }
  }
}

function validateBlockedDocumentation(candidate) {
  if (candidate.review?.status !== "blocked") {
    return;
  }

  if (!existsSync(blockersPath)) {
    failures.push(`Blocked manifest requires blocker documentation: ${blockersPath}.`);
    return;
  }

  const blockers = readFileSync(blockersPath, "utf8");

  if (!/Source affected:/i.test(blockers)) {
    failures.push("Blocked manifest requires blocker entries with Source affected.");
  }

  if (!/fallback remains host-provided-only/i.test(blockers)) {
    failures.push(
      "Blocked manifest requires blocker entries to state whether fallback remains host-provided-only.",
    );
  }
}

function walkFiles(dir) {
  const results = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      results.push(...walkFiles(path));
    } else {
      results.push(path);
    }
  }

  return results;
}

function getExtension(file) {
  const match = file.toLowerCase().match(/\.[^.\\/]+$/);
  return match ? match[0] : "";
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be an object.`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push(`${label} must be a non-empty array.`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    failures.push(`${label} must be a non-empty string.`);
  }
}

function requireStringOrEmpty(value, label) {
  if (typeof value !== "string") {
    failures.push(`${label} must be a string.`);
  }
}

function requireLiteral(value, expected, label) {
  if (value !== expected) {
    failures.push(`${label} must be ${expected}.`);
  }
}

function requireEnum(value, allowed, label) {
  if (!allowed.has(value)) {
    failures.push(`${label} must be one of: ${Array.from(allowed).join(", ")}.`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    failures.push(`${label} must be a SHA-256 hex string.`);
  }
}

function requireExistingFile(path, label) {
  requireString(path, label);

  if (typeof path !== "string" || !existsSync(path) || !statSync(path).isFile()) {
    failures.push(`${label} must point to an existing file.`);
    return;
  }

  const normalized = normalize(path);
  const root = normalize(productionDir);

  if (!normalized.startsWith(root)) {
    failures.push(`${label} must stay under ${productionDir}.`);
  }
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function reportAndExit() {
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
}
