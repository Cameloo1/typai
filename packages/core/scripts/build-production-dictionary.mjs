import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import { decodeDictionary, encodeDictionary, sha256 } from "./dictionary-asset-utils.mjs";

export const productionTransformScriptVersion = "prompt-110-production-transform-v1";

const maxUint32 = 0xffffffffn;
const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const workspaceRoot = resolve(packageRoot, "..", "..");
const generatedAssetsRoot = resolve(packageRoot, "assets", "generated");
const productionAssetsRoot = resolve(packageRoot, "assets", "production");
const fixtureManifestPath = resolve(
  packageRoot,
  "assets",
  "fixtures",
  "production-transform",
  "MANIFEST.fixture.json",
);

const cliMode = readMode();
const cliFlags = readFlags();

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runCli(cliMode, cliFlags);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function runCli(mode, flags = new Map()) {
  if (mode === "build-production") {
    const result = buildProductionDictionary({
      manifestPath: flags.get("manifest"),
      outDir: flags.get("out-dir"),
      generatedAt: flags.get("generated-at"),
      updateManifest: flags.has("update-manifest"),
    });
    printBuildResult("Built Typai production dictionary asset.", result);
    return result;
  }

  if (mode === "validate-production") {
    return validateProductionDictionary({
      manifestPath: flags.get("manifest"),
      outDir: flags.get("out-dir"),
    });
  }

  if (mode === "build-fixture") {
    const result = buildDictionaryFromManifest({
      manifestPath: flags.get("manifest") ?? fixtureManifestPath,
      outDir: flags.get("out-dir") ?? resolve(generatedAssetsRoot, "production-transform-fixture"),
      production: false,
      generatedAt: flags.get("generated-at"),
      updateManifest: false,
    });
    printBuildResult("Built Typai production-transform fixture dictionary.", result);
    return result;
  }

  throw new Error(
    `Unknown mode: ${mode}. Expected build-production, validate-production, or build-fixture.`,
  );
}

export function buildProductionDictionary({
  manifestPath,
  outDir,
  generatedAt,
  updateManifest = false,
} = {}) {
  const resolvedManifestPath = resolveProductionManifestPath(manifestPath);
  const manifest = readManifest(resolvedManifestPath);

  if (manifest.review?.status === "blocked") {
    throw new Error(
      `Production dictionary build is blocked by ${relativeToWorkspace(
        resolvedManifestPath,
      )}: review.status is blocked.`,
    );
  }

  if (manifest.review?.status !== "approved") {
    throw new Error("Production dictionary build requires review.status approved.");
  }

  return buildDictionaryFromManifest({
    manifestPath: resolvedManifestPath,
    outDir: outDir ?? resolve(generatedAssetsRoot, "production"),
    production: true,
    generatedAt,
    updateManifest,
  });
}

export function validateProductionDictionary({ manifestPath, outDir } = {}) {
  const resolvedManifestPath = resolveProductionManifestPath(manifestPath);
  const manifest = readManifest(resolvedManifestPath);

  if (manifest.review?.status === "blocked") {
    validateBlockedProductionDirectory();

    const fixtureResult = buildDictionaryFromManifest({
      manifestPath: fixtureManifestPath,
      outDir: outDir ?? resolve(generatedAssetsRoot, "production-transform-fixture-validation"),
      production: false,
      generatedAt: "1970-01-01T00:00:00.000Z",
      updateManifest: false,
    });

    console.log("Production dictionary build is blocked by manifest review.status.");
    console.log(`Manifest: ${relativeToWorkspace(resolvedManifestPath)}`);
    console.log("Production inputs still needed before build-production can run:");
    for (const item of describeMissingProductionInputs(manifest)) {
      console.log(`- ${item}`);
    }
    printBuildResult("Validated fixture transform pipeline.", fixtureResult);

    return {
      productionStatus: "blocked",
      fixture: fixtureResult,
    };
  }

  if (manifest.review?.status !== "approved") {
    throw new Error("Production dictionary validation requires review.status approved or blocked.");
  }

  const tempOutDir = outDir ?? mkdtempSync(join(tmpdir(), "typai-production-dictionary-validate-"));
  const result = buildDictionaryFromManifest({
    manifestPath: resolvedManifestPath,
    outDir: tempOutDir,
    production: true,
    generatedAt: "1970-01-01T00:00:00.000Z",
    updateManifest: false,
  });

  printBuildResult("Validated production dictionary transform pipeline.", result);

  return {
    productionStatus: "approved",
    production: result,
  };
}

export function buildDictionaryFromManifest({
  manifestPath,
  outDir,
  production,
  generatedAt,
  updateManifest,
}) {
  const resolvedManifestPath = resolveInputPath(manifestPath);
  const manifestBytes = readFileSync(resolvedManifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));

  validateBuildManifest(manifest, production);

  const sourceFiles = {
    dictionary: verifySourceFiles(manifest.dictionary, "dictionary", resolvedManifestPath),
    frequency: verifySourceFiles(manifest.frequency, "frequency", resolvedManifestPath),
  };
  const dictionaryResult = readDictionarySources(sourceFiles.dictionary);
  const frequencyResult = readFrequencySources(sourceFiles.frequency);
  const entries = mergeDictionaryAndFrequency(dictionaryResult.words, frequencyResult.frequencies);
  const excludedCountByReason = mergeExcludedCounts(
    dictionaryResult.excludedCountByReason,
    frequencyResult.excludedCountByReason,
    countFrequencyOnlyWords(frequencyResult.frequencies, dictionaryResult.words),
  );

  if (entries.length === 0) {
    throw new Error("Transform produced zero dictionary entries.");
  }

  const binary = encodeDictionary(entries.map((entry) => [entry.word, entry.frequency, 0]));
  const decoded = decodeDictionary(binary);

  if (decoded.entries.length !== entries.length) {
    throw new Error("Generated dictionary blob did not round-trip expected entry count.");
  }

  const outputDir = resolveInputPath(outDir);
  const baseName = production ? "production-en-us" : "production-transform-fixture-en-us";
  const manifestOutputPath =
    production && manifest.output?.assetPath ? resolveInputPath(manifest.output.assetPath) : null;
  const binaryPath = manifestOutputPath ?? resolve(outputDir, `${baseName}.dictionary.bin`);
  const metadataPath = resolve(dirname(binaryPath), `${baseName}.dictionary.meta.json`);
  const binarySha256 = sha256(binary);
  const metadata = createMetadata({
    manifest,
    manifestPath: resolvedManifestPath,
    manifestBytes,
    sourceFiles,
    entries,
    binary,
    binarySha256,
    excludedCountByReason,
    production,
    generatedAt: generatedAt ?? new Date().toISOString(),
    binaryPath,
    metadataPath,
  });

  mkdirSync(dirname(binaryPath), { recursive: true });
  writeFileSync(binaryPath, binary);
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  if (updateManifest) {
    updateApprovedManifestOutput({
      manifest,
      manifestPath: resolvedManifestPath,
      binaryPath,
      wordCount: entries.length,
      byteSize: binary.byteLength,
      generatedAt: metadata.generatedAt,
    });
  }

  return {
    binaryPath,
    metadataPath,
    wordCount: entries.length,
    byteSize: binary.byteLength,
    sha256: binarySha256,
    excludedCountByReason,
    entries,
    metadata,
  };
}

function validateBuildManifest(manifest, production) {
  if (manifest.schemaVersion !== 1) {
    throw new Error("Manifest schemaVersion must be 1.");
  }

  if (manifest.language !== "en-US") {
    throw new Error("Typai Dictionary Blob v1 production transform only supports en-US.");
  }

  if (manifest.review?.status !== "approved") {
    throw new Error("Dictionary transform requires review.status approved.");
  }

  if (production && manifest.output?.packageInclusion === "blocked") {
    throw new Error("Approved production transform cannot use packageInclusion blocked.");
  }

  for (const label of ["dictionary", "frequency"]) {
    const source = manifest[label];

    if (!source || !Array.isArray(source.sourceFiles) || source.sourceFiles.length === 0) {
      throw new Error(`${label}.sourceFiles must contain at least one pinned local file.`);
    }
  }
}

function verifySourceFiles(source, label, manifestPath) {
  const verified = [];

  for (const [index, file] of source.sourceFiles.entries()) {
    const path = sourceFilePath(file, manifestPath);

    if (!path) {
      throw new Error(
        `${label}.sourceFiles[${index}] must provide a local path. Network fetches are not allowed by default.`,
      );
    }

    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`${label}.sourceFiles[${index}] does not exist: ${path}`);
    }

    if (typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new Error(`${label}.sourceFiles[${index}].sha256 must be a SHA-256 hex string.`);
    }

    const bytes = readFileSync(path);
    const actualSha256 = sha256(bytes);

    if (actualSha256 !== file.sha256.toLowerCase()) {
      throw new Error(
        `${label}.sourceFiles[${index}] hash mismatch: expected ${file.sha256}, got ${actualSha256}.`,
      );
    }

    verified.push({
      path,
      url: file.url ?? file.sourceUrl ?? file.path ?? file.localPath ?? file.file,
      sha256: actualSha256,
      byteSize: bytes.byteLength,
      bytes,
    });
  }

  if (source.sourceFiles.length === 1 && typeof source.sha256 === "string") {
    const expected = source.sha256.toLowerCase();
    const actual = verified[0].sha256;

    if (expected !== actual) {
      throw new Error(`${label}.sha256 mismatch: expected ${expected}, got ${actual}.`);
    }
  }

  return verified;
}

function sourceFilePath(file, manifestPath) {
  const rawPath = file.localPath ?? file.path ?? file.file;

  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    return null;
  }

  if (isAbsolute(rawPath)) {
    return resolve(rawPath);
  }

  const workspaceRelative = resolve(workspaceRoot, rawPath);

  if (existsSync(workspaceRelative)) {
    return workspaceRelative;
  }

  const manifestRelative = resolve(dirname(manifestPath), rawPath);

  if (existsSync(manifestRelative)) {
    return manifestRelative;
  }

  return workspaceRelative;
}

function readDictionarySources(files) {
  const words = new Map();
  const excludedCountByReason = new Map();

  for (const file of files) {
    const lines = decodeSourceBytes(file).split(/\r?\n/u);
    let sawContent = false;

    for (const line of lines) {
      const trimmed = stripBom(line).trim();

      if (trimmed.length === 0 || trimmed.startsWith("#")) {
        continue;
      }

      if (!sawContent && /^\d+$/u.test(trimmed) && extname(file.path).toLowerCase() === ".dic") {
        sawContent = true;
        continue;
      }

      sawContent = true;

      const token = trimmed.split(/\s+/u)[0];
      const normalized = normalizeSourceToken(token, { stripHunspellFlags: true });

      if (normalized.reason) {
        increment(excludedCountByReason, normalized.reason);
        continue;
      }

      if (words.has(normalized.word)) {
        increment(excludedCountByReason, "duplicate_dictionary_word");
        continue;
      }

      words.set(normalized.word, normalized.word);
    }
  }

  return {
    words,
    excludedCountByReason,
  };
}

function readFrequencySources(files) {
  const frequencies = new Map();
  const excludedCountByReason = new Map();

  for (const file of files) {
    const lines = decodeSourceBytes(file).split(/\r?\n/u);

    for (const line of lines) {
      const trimmed = stripBom(line).trim();

      if (trimmed.length === 0 || trimmed.startsWith("#")) {
        continue;
      }

      const fields = trimmed.split("\t");

      if (fields.length < 2) {
        increment(excludedCountByReason, "invalid_frequency_row");
        continue;
      }

      const normalized = normalizeSourceToken(fields[0], { stripHunspellFlags: false });

      if (normalized.reason) {
        increment(excludedCountByReason, `frequency_${normalized.reason}`);
        continue;
      }

      const rawCount = fields.length >= 4 ? fields[2] : fields[1];
      const count = parseFrequencyCount(rawCount);

      if (count === null) {
        increment(excludedCountByReason, "invalid_frequency_count");
        continue;
      }

      frequencies.set(normalized.word, (frequencies.get(normalized.word) ?? 0n) + count);
    }
  }

  return {
    frequencies,
    excludedCountByReason,
  };
}

function normalizeSourceToken(rawToken, { stripHunspellFlags }) {
  let token = rawToken.trim();

  if (token.length === 0) {
    return { reason: "empty_token" };
  }

  const protectedReason = classifyProtectedLookingToken(token);

  if (protectedReason) {
    return { reason: protectedReason };
  }

  if (stripHunspellFlags && isHunspellFlaggedToken(token)) {
    token = token.slice(0, token.indexOf("/"));
  }

  const normalized = token.normalize("NFKC").toLocaleLowerCase("en-US");

  if (!/^[a-z]+$/u.test(normalized)) {
    return { reason: "invalid_non_alpha_token" };
  }

  return { word: normalized };
}

function classifyProtectedLookingToken(token) {
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(token)) {
    return "protected_url";
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(token)) {
    return "protected_email";
  }

  if (/^[a-z]:[\\/]/iu.test(token) || token.startsWith("/") || token.startsWith("\\")) {
    return "protected_path";
  }

  if (token.includes("\\") || token.split("/").length > 2) {
    return "protected_path";
  }

  if (token.includes("_") || /[a-z][A-Z]/u.test(token)) {
    return "protected_identifier";
  }

  if (/\d/u.test(token)) {
    return "protected_numeric";
  }

  if (token.includes("-")) {
    return "protected_hyphenated";
  }

  return null;
}

function isHunspellFlaggedToken(token) {
  const slashIndex = token.indexOf("/");

  if (slashIndex <= 0 || slashIndex !== token.lastIndexOf("/")) {
    return false;
  }

  const suffix = token.slice(slashIndex + 1);

  return /^[A-Za-z]+$/u.test(suffix);
}

function mergeDictionaryAndFrequency(words, frequencies) {
  return [...words.keys()]
    .sort((left, right) => left.localeCompare(right, "en-US"))
    .map((word) => ({
      word,
      frequency: toUint32Frequency(frequencies.get(word) ?? 0n),
    }));
}

function countFrequencyOnlyWords(frequencies, words) {
  let count = 0;

  for (const word of frequencies.keys()) {
    if (!words.has(word)) {
      count += 1;
    }
  }

  return new Map(count > 0 ? [["frequency_word_not_in_dictionary", count]] : []);
}

function mergeExcludedCounts(...counts) {
  const merged = new Map();

  for (const countMap of counts) {
    for (const [reason, count] of countMap) {
      merged.set(reason, (merged.get(reason) ?? 0) + count);
    }
  }

  return Object.fromEntries(
    [...merged.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function createMetadata({
  manifest,
  manifestPath,
  manifestBytes,
  sourceFiles,
  entries,
  binary,
  binarySha256,
  excludedCountByReason,
  production,
  generatedAt,
  binaryPath,
  metadataPath,
}) {
  const scriptBytes = readFileSync(scriptPath);

  return {
    format: "Typai Dictionary Blob v1",
    language: manifest.language,
    production,
    fixture: !production,
    inputManifestHash: sha256(manifestBytes),
    inputManifest: {
      path: relativeToWorkspace(manifestPath),
      sha256: sha256(manifestBytes),
    },
    sourceHashes: {
      dictionary: sourceFiles.dictionary.map(sourceFileMetadata),
      frequency: sourceFiles.frequency.map(sourceFileMetadata),
    },
    transform: {
      script: relativeToWorkspace(scriptPath),
      version: productionTransformScriptVersion,
      sha256: sha256(scriptBytes),
      networkFetches: false,
      filters: manifest.transform?.filters ?? [],
    },
    wordCount: entries.length,
    byteSize: binary.byteLength,
    sha256: binarySha256,
    excludedCountByReason,
    generatedAt,
    packageInclusionPolicy: manifest.output?.packageInclusion ?? "blocked",
    attributionReference: {
      dictionary: manifest.dictionary?.attribution ?? "",
      frequency: manifest.frequency?.attribution ?? "",
      file: relativeToWorkspace(resolve(productionAssetsRoot, "ATTRIBUTION.md")),
    },
    output: {
      binaryPath: relativeToWorkspace(binaryPath),
      metadataPath: relativeToWorkspace(metadataPath),
    },
  };
}

function sourceFileMetadata(file) {
  return {
    path: relativeToWorkspace(file.path),
    source: file.url,
    sha256: file.sha256,
    byteSize: file.byteSize,
  };
}

function updateApprovedManifestOutput({
  manifest,
  manifestPath,
  binaryPath,
  wordCount,
  byteSize,
  generatedAt,
}) {
  if (manifest.review?.status !== "approved") {
    throw new Error("Refusing to update manifest output unless review.status is approved.");
  }

  if (manifest.output?.packageInclusion === "blocked") {
    throw new Error("Refusing to update manifest output while packageInclusion is blocked.");
  }

  manifest.output.wordCount = wordCount;
  manifest.output.byteSize = byteSize;
  manifest.output.assetPath = relativeToWorkspace(binaryPath);
  manifest.transform.generatedAt = generatedAt;

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function validateBlockedProductionDirectory() {
  const allowed = new Set([
    resolve(productionAssetsRoot, "MANIFEST.template.json"),
    resolve(productionAssetsRoot, "ATTRIBUTION.md"),
    resolve(productionAssetsRoot, "LICENSES", "README.md"),
  ]);

  for (const file of walkFiles(productionAssetsRoot)) {
    if (!allowed.has(resolve(file))) {
      throw new Error(
        `Blocked production dictionary status cannot include generated asset file: ${relativeToWorkspace(
          file,
        )}`,
      );
    }
  }
}

function describeMissingProductionInputs(manifest) {
  const missing = [];

  for (const label of ["dictionary", "frequency"]) {
    const source = manifest[label];

    if (!source || !Array.isArray(source.sourceFiles)) {
      missing.push(`${label}: sourceFiles array`);
      continue;
    }

    source.sourceFiles.forEach((file, index) => {
      if (!file.localPath && !file.path && !file.file) {
        missing.push(`${label}.sourceFiles[${index}]: pinned local file path`);
      }

      if (typeof file.sha256 !== "string") {
        missing.push(`${label}.sourceFiles[${index}]: raw source SHA-256`);
      }
    });

    if (typeof source.sha256 !== "string") {
      missing.push(`${label}: aggregate/source SHA-256`);
    }
  }

  missing.push("production review.status approved");
  missing.push("deterministic generated output hash, word count, and byte size");
  missing.push("quality and package-size gate evidence");

  return missing;
}

function resolveProductionManifestPath(flagPath) {
  if (flagPath) {
    return resolveInputPath(flagPath);
  }

  const approvedPath = resolve(productionAssetsRoot, "MANIFEST.json");
  const blockedPath = resolve(productionAssetsRoot, "MANIFEST.template.json");

  return existsSync(approvedPath) ? approvedPath : blockedPath;
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveInputPath(path) {
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new Error("Expected a non-empty path.");
  }

  return isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
}

function decodeSourceBytes(file) {
  const extension = extname(file.path).toLowerCase();
  const bytes = extension === ".gz" ? gunzipSync(file.bytes) : file.bytes;

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function parseFrequencyCount(value) {
  const trimmed = value.trim();

  if (!/^\d+$/u.test(trimmed)) {
    return null;
  }

  return BigInt(trimmed);
}

function toUint32Frequency(value) {
  return Number(value > maxUint32 ? maxUint32 : value);
}

function stripBom(line) {
  return line.replace(/^\uFEFF/u, "");
}

function increment(counts, reason) {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
}

function walkFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const output = [];
  const entries = readDirectoryEntries(dir);

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      output.push(...walkFiles(path));
    } else {
      output.push(path);
    }
  }

  return output;
}

function readDirectoryEntries(dir) {
  return Array.from(new Set(readdirSync(dir))).sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
}

function printBuildResult(title, result) {
  console.log(title);
  console.log(`binary: ${result.binaryPath}`);
  console.log(`metadata: ${result.metadataPath}`);
  console.log(`words: ${result.wordCount}`);
  console.log(`bytes: ${result.byteSize}`);
  console.log(`sha256: ${result.sha256}`);
}

function readMode() {
  return (
    process.argv.find((arg, index) => index > 1 && !arg.startsWith("--")) ?? "validate-production"
  );
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

function relativeToWorkspace(path) {
  return relative(workspaceRoot, path).replaceAll("\\", "/");
}
