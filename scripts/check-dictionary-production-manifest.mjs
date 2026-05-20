import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const productionDir = "packages/core/assets/production";
const manifestPath = existsSync(join(productionDir, "MANIFEST.json"))
  ? join(productionDir, "MANIFEST.json")
  : join(productionDir, "MANIFEST.template.json");

const failures = [];

if (!existsSync(manifestPath)) {
  failures.push(
    "Missing production dictionary manifest: expected packages/core/assets/production/MANIFEST.template.json or MANIFEST.json.",
  );
  reportAndExit();
}

const manifest = readJson(manifestPath);

validateManifest(manifest, manifestPath);
validateProductionAssetFiles(manifest);

reportAndExit();

if (manifest.review.status === "blocked") {
  console.log("Dictionary production manifest status: blocked.");
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Review notes: ${manifest.review.reviewNotes}`);
  console.log("No production dictionary/frequency asset is bundled.");
} else {
  console.log("Dictionary production manifest status: approved.");
  console.log(`Manifest: ${manifestPath}`);
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

function validateManifest(candidate, file) {
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

  const status = candidate.review?.status;

  if (status === "approved") {
    validateApprovedManifest(candidate);
  }

  if (status === "blocked") {
    validateBlockedManifest(candidate, file);
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

  if (source.sha256 !== null) {
    requireSha256(source.sha256, `${label}.sha256`);
  }

  source.sourceFiles.forEach((entry, index) => {
    requireObject(entry, `${label}.sourceFiles[${index}]`);
    requireString(entry.url, `${label}.sourceFiles[${index}].url`);

    if (entry.sha256 !== null) {
      requireSha256(entry.sha256, `${label}.sourceFiles[${index}].sha256`);
    }
  });
}

function validateTransform(transform) {
  requireString(transform.script, "transform.script");
  requireString(transform.version, "transform.version");
  requireArray(transform.filters, "transform.filters");

  if (transform.generatedAt !== null && typeof transform.generatedAt !== "string") {
    failures.push("transform.generatedAt must be null or an ISO date string.");
  }
}

function validateOutput(output) {
  if (output.wordCount !== null && !isNonNegativeInteger(output.wordCount)) {
    failures.push("output.wordCount must be null or a non-negative integer.");
  }

  if (output.byteSize !== null && !isNonNegativeInteger(output.byteSize)) {
    failures.push("output.byteSize must be null or a non-negative integer.");
  }

  if (!["blocked", "generated-in-prepack", "committed"].includes(output.packageInclusion)) {
    failures.push("output.packageInclusion must be blocked, generated-in-prepack, or committed.");
  }

  if (typeof output.assetPath !== "string") {
    failures.push("output.assetPath must be a string.");
  }
}

function validateReview(review) {
  if (!["approved", "blocked"].includes(review.status)) {
    failures.push("review.status must be approved or blocked.");
  }

  requireString(review.reviewedAt, "review.reviewedAt");
  requireString(review.reviewNotes, "review.reviewNotes");
}

function validateApprovedManifest(candidate) {
  for (const source of [candidate.dictionary, candidate.frequency]) {
    requireSha256(source.sha256, `${source.name}.sha256`);
    requireExistingFile(source.licenseFile, `${source.name}.licenseFile`);

    source.sourceFiles.forEach((entry, index) => {
      requireSha256(entry.sha256, `${source.name}.sourceFiles[${index}].sha256`);
    });
  }

  requireExistingFile("packages/core/assets/production/ATTRIBUTION.md", "ATTRIBUTION.md");

  if (!isNonNegativeInteger(candidate.output.wordCount) || candidate.output.wordCount === 0) {
    failures.push("approved manifest requires output.wordCount > 0.");
  }

  if (!isNonNegativeInteger(candidate.output.byteSize) || candidate.output.byteSize === 0) {
    failures.push("approved manifest requires output.byteSize > 0.");
  }

  if (candidate.output.packageInclusion === "blocked") {
    failures.push("approved manifest cannot keep output.packageInclusion blocked.");
  }

  requireString(candidate.output.assetPath, "output.assetPath");
  requireExistingFile(candidate.output.assetPath, "output.assetPath");
}

function validateBlockedManifest(candidate, file) {
  if (!file.endsWith("MANIFEST.template.json")) {
    failures.push("blocked production asset status must use MANIFEST.template.json.");
  }

  if (candidate.output.packageInclusion !== "blocked") {
    failures.push("blocked manifest must keep output.packageInclusion set to blocked.");
  }

  if (candidate.output.assetPath !== "") {
    failures.push("blocked manifest must not point to a production asset path.");
  }

  if (candidate.output.wordCount !== null || candidate.output.byteSize !== null) {
    failures.push("blocked manifest must not claim generated output wordCount or byteSize.");
  }
}

function validateProductionAssetFiles(candidate) {
  if (!existsSync(productionDir)) {
    return;
  }

  const status = candidate.review?.status;
  const allowedBlockedFiles = new Set([
    normalize(join(productionDir, "MANIFEST.template.json")),
    normalize(join(productionDir, "ATTRIBUTION.md")),
    normalize(join(productionDir, "LICENSES", "README.md")),
  ]);

  for (const file of walkFiles(productionDir)) {
    const normalized = normalize(file);

    if (status === "blocked" && !allowedBlockedFiles.has(normalized)) {
      failures.push(`Blocked production asset status cannot include file: ${file}`);
    }
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

function requireLiteral(value, expected, label) {
  if (value !== expected) {
    failures.push(`${label} must be ${expected}.`);
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

function reportAndExit() {
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
}
