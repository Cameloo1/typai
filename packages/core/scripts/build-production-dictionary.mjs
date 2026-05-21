import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGunzip, gunzipSync, inflateRawSync } from "node:zlib";

import {
  decodeDictionary,
  version as dictionaryBlobVersion,
  encodeDictionary,
  sha256,
} from "./dictionary-asset-utils.mjs";

export const productionTransformScriptVersion = "prompt-131-production-transform-v1";

const maxUint32 = 0xffffffffn;
const dictionaryMinWordLength = 1;
const dictionaryMaxWordLength = 32;
const fixedFixtureGeneratedAt = "1970-01-01T00:00:00.000Z";
const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const workspaceRoot = resolve(packageRoot, "..", "..");
const generatedAssetsRoot = resolve(packageRoot, "assets", "generated");
const productionAssetsRoot = resolve(packageRoot, "assets", "production");
const productionAttributionPath = resolve(productionAssetsRoot, "ATTRIBUTION.md");
const blockersPath = resolve(workspaceRoot, "docs", "dictionary-asset-blockers.md");
const fixtureManifestPath = resolve(
  packageRoot,
  "assets",
  "fixtures",
  "production-transform",
  "MANIFEST.fixture.json",
);
const allowedPackageInclusionValues = new Set([
  "blocked",
  "host-provided-only",
  "generated-during-prepack",
  "committed-generated-binary",
]);

const cliMode = readMode();
const cliFlags = readFlags();

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await runCli(cliMode, cliFlags);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function runCli(mode, flags = new Map()) {
  if (mode === "build-production") {
    const result = await buildProductionDictionary({
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
    const result = await buildFixtureDictionary({
      manifestPath: flags.get("manifest"),
      outDir: flags.get("out-dir"),
      generatedAt: flags.get("generated-at"),
    });
    printBuildResult("Built Typai production-transform fixture dictionary.", result);
    console.log(`determinism: repeated fixture output sha256 matched (${result.sha256})`);
    return result;
  }

  throw new Error(
    `Unknown mode: ${mode}. Expected build-production, validate-production, or build-fixture.`,
  );
}

export async function buildProductionDictionary({
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
    useManifestOutputPath: true,
  });
}

export async function validateProductionDictionary({ manifestPath, outDir } = {}) {
  const resolvedManifestPath = resolveProductionManifestPath(manifestPath);
  const manifest = readManifest(resolvedManifestPath);

  if (manifest.review?.status === "blocked") {
    validateBlockedManifestState(manifest);
    validateBlockedProductionDirectory();

    const fixtureResult = await buildFixtureDictionary({
      manifestPath: fixtureManifestPath,
      outDir: outDir ?? resolve(generatedAssetsRoot, "production-transform-fixture-validation"),
      generatedAt: fixedFixtureGeneratedAt,
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

  validateApprovedOutputIfPresent(manifest);

  const tempOutDir = outDir ?? mkdtempSync(join(tmpdir(), "typai-production-dictionary-validate-"));
  const result = await buildDictionaryFromManifest({
    manifestPath: resolvedManifestPath,
    outDir: tempOutDir,
    production: true,
    generatedAt: fixedFixtureGeneratedAt,
    updateManifest: false,
    useManifestOutputPath: false,
  });

  printBuildResult("Validated production dictionary transform pipeline.", result);

  return {
    productionStatus: "approved",
    production: result,
  };
}

export async function buildFixtureDictionary({ manifestPath, outDir, generatedAt } = {}) {
  const resolvedManifestPath = resolveInputPath(manifestPath ?? fixtureManifestPath);
  const resolvedOutDir = resolveInputPath(
    outDir ?? resolve(generatedAssetsRoot, "production-transform-fixture"),
  );
  const stableGeneratedAt = generatedAt ?? fixedFixtureGeneratedAt;
  const result = await buildDictionaryFromManifest({
    manifestPath: resolvedManifestPath,
    outDir: resolvedOutDir,
    production: false,
    generatedAt: stableGeneratedAt,
    updateManifest: false,
    useManifestOutputPath: false,
  });
  const repeat = await buildDictionaryFromManifest({
    manifestPath: resolvedManifestPath,
    outDir: mkdtempSync(join(tmpdir(), "typai-production-transform-fixture-repeat-")),
    production: false,
    generatedAt: stableGeneratedAt,
    updateManifest: false,
    useManifestOutputPath: false,
  });

  if (result.sha256 !== repeat.sha256) {
    throw new Error(
      `Fixture transform is not deterministic: first ${result.sha256}, second ${repeat.sha256}.`,
    );
  }

  return {
    ...result,
    deterministic: {
      repeatedSha256: repeat.sha256,
      matched: true,
    },
  };
}

export async function buildDictionaryFromManifest({
  manifestPath,
  outDir,
  production,
  generatedAt,
  updateManifest,
  useManifestOutputPath = production,
}) {
  const resolvedManifestPath = resolveInputPath(manifestPath);
  const manifestBytes = readFileSync(resolvedManifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));

  validateBuildManifest(manifest, production);

  if (production) {
    validateApprovedProductionGates(manifest);
  }

  const sourceFiles = {
    dictionary: await verifySourceFiles(manifest.dictionary, "dictionary", resolvedManifestPath),
    frequency: await verifySourceFiles(manifest.frequency, "frequency", resolvedManifestPath),
  };

  if (production) {
    validateRawSourcePolicy(sourceFiles);
  }

  const dictionaryResult = readDictionarySources(sourceFiles.dictionary);
  const frequencyResult = await readFrequencySources(sourceFiles.frequency);
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
    production && useManifestOutputPath && manifest.output?.assetPath
      ? resolveInputPath(manifest.output.assetPath)
      : null;
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
      sha256: binarySha256,
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

  if (!allowedPackageInclusionValues.has(manifest.output?.packageInclusion)) {
    throw new Error("Manifest output.packageInclusion is not a supported value.");
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

function validateApprovedProductionGates(manifest) {
  for (const label of ["dictionary", "frequency"]) {
    const source = manifest[label];

    if (source.redistribution !== "approved") {
      throw new Error(`Approved production transform requires ${label}.redistribution approved.`);
    }

    if (typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(source.sha256)) {
      throw new Error(`Approved production transform requires ${label}.sha256.`);
    }

    if (typeof source.attribution !== "string" || source.attribution.trim().length === 0) {
      throw new Error(`Approved production transform requires ${label}.attribution.`);
    }

    requireProductionNoticeFile(source.licenseFile, `${label}.licenseFile`);

    source.sourceFiles.forEach((entry, index) => {
      if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
        throw new Error(
          `Approved production transform requires ${label}.sourceFiles[${index}].sha256.`,
        );
      }
    });
  }

  requireProductionNoticeFile(relativeToWorkspace(productionAttributionPath), "ATTRIBUTION.md");

  if (manifest.transform?.networkFetchAllowed !== false) {
    throw new Error("Approved production transform requires transform.networkFetchAllowed false.");
  }
}

function validateBlockedManifestState(manifest) {
  if (manifest.output?.packageInclusion !== "blocked") {
    throw new Error("Blocked production validation requires output.packageInclusion blocked.");
  }

  if (manifest.output?.assetPath) {
    const assetPath = resolveInputPath(manifest.output.assetPath);
    const exists = existsSync(assetPath);
    throw new Error(
      `Blocked production validation cannot reference a generated asset path${
        exists ? " that exists" : ""
      }: ${manifest.output.assetPath}.`,
    );
  }

  if (manifest.output?.sha256) {
    throw new Error("Blocked production validation cannot claim output.sha256.");
  }

  if (manifest.output?.wordCount !== null || manifest.output?.byteSize !== null) {
    throw new Error("Blocked production validation cannot claim output wordCount or byteSize.");
  }

  validateBlockersDocumented();
}

function validateBlockersDocumented() {
  if (!existsSync(blockersPath)) {
    throw new Error(
      `Blocked production validation requires blocker documentation: ${relativeToWorkspace(
        blockersPath,
      )}.`,
    );
  }

  const blockers = readFileSync(blockersPath, "utf8");

  if (!/Source affected:/i.test(blockers)) {
    throw new Error("Blocked production validation requires blocker entries with Source affected.");
  }

  if (!/fallback remains host-provided-only/i.test(blockers)) {
    throw new Error(
      "Blocked production validation requires blocker entries to state fallback host-provided-only status.",
    );
  }
}

function validateApprovedOutputIfPresent(manifest) {
  if (!manifest.output?.assetPath) {
    return;
  }

  const assetPath = resolveInputPath(manifest.output.assetPath);

  if (!existsSync(assetPath)) {
    return;
  }

  const bytes = readFileSync(assetPath);
  const actualSha256 = sha256(bytes);
  const decoded = decodeDictionary(bytes);

  if (manifest.output.sha256 && manifest.output.sha256 !== actualSha256) {
    throw new Error(
      `Generated production asset hash mismatch: expected ${manifest.output.sha256}, got ${actualSha256}.`,
    );
  }

  if (manifest.output.wordCount !== null && manifest.output.wordCount !== decoded.entries.length) {
    throw new Error("Generated production asset word count does not match manifest output.");
  }

  if (manifest.output.byteSize !== null && manifest.output.byteSize !== bytes.byteLength) {
    throw new Error("Generated production asset byte size does not match manifest output.");
  }
}

async function verifySourceFiles(source, label, manifestPath) {
  const verified = [];

  for (const [index, file] of source.sourceFiles.entries()) {
    const path = sourceFilePath(file, manifestPath);

    if (!path) {
      throw new Error(
        `${label}.sourceFiles[${index}] must provide a pinned local path. Network fetches are not allowed by default, and this transform has no silent download mode.`,
      );
    }

    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`${label}.sourceFiles[${index}] does not exist: ${path}`);
    }

    if (typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new Error(`${label}.sourceFiles[${index}].sha256 must be a SHA-256 hex string.`);
    }

    const actualSha256 = await sha256File(path);

    if (actualSha256 !== file.sha256.toLowerCase()) {
      throw new Error(
        `${label}.sourceFiles[${index}] hash mismatch: expected ${file.sha256}, got ${actualSha256}.`,
      );
    }

    verified.push({
      path,
      fileName: file.fileName ?? basename(path),
      contents: Array.isArray(file.contents) ? file.contents : [],
      url: file.url ?? file.sourceUrl ?? file.path ?? file.localPath ?? file.file,
      sha256: actualSha256,
      byteSize: statSync(path).size,
    });
  }

  if (source.sourceFiles.length === 1 && typeof source.sha256 === "string" && source.sha256) {
    const expected = source.sha256.toLowerCase();
    const actual = verified[0].sha256;

    if (expected !== actual) {
      throw new Error(`${label}.sha256 mismatch: expected ${expected}, got ${actual}.`);
    }
  }

  return verified;
}

async function sha256File(path) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
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

function validateRawSourcePolicy(sourceFiles) {
  for (const file of [...sourceFiles.dictionary, ...sourceFiles.frequency]) {
    if (isPathUnder(file.path, productionAssetsRoot)) {
      throw new Error(
        `Raw production source files must not be staged under production assets: ${relativeToWorkspace(
          file.path,
        )}.`,
      );
    }
  }
}

function readDictionarySources(files) {
  const words = new Map();
  const excludedCountByReason = new Map();

  for (const file of files.flatMap(expandDictionarySourceFile)) {
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

async function readFrequencySources(files) {
  const frequencies = new Map();
  const excludedCountByReason = new Map();

  for (const file of files) {
    if (isFrequencyMetadataFile(file)) {
      continue;
    }

    for await (const line of readSourceLines(file)) {
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

  if (token.includes("'") || token.includes("\u2019")) {
    return { reason: "invalid_apostrophe" };
  }

  if (/[.,;:!?]$/u.test(token)) {
    return { reason: "invalid_trailing_punctuation" };
  }

  const normalized = token.normalize("NFKC").toLocaleLowerCase("en-US");

  if (!isAscii(normalized)) {
    return { reason: "invalid_non_ascii_token" };
  }

  if (normalized.length < dictionaryMinWordLength || normalized.length > dictionaryMaxWordLength) {
    return { reason: "invalid_word_length" };
  }

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
  return [...words.keys()].sort(compareAscii).map((word) => ({
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
    [...merged.entries()].sort(([left], [right]) => compareAscii(left, right)),
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
  const manifestHash = sha256(manifestBytes);
  const frequencyCoverage = createFrequencyCoverage(entries);
  const sourceHashes = {
    dictionary: sourceFiles.dictionary.map(sourceFileMetadata),
    frequency: sourceFiles.frequency.map(sourceFileMetadata),
  };

  return {
    schemaVersion: 1,
    format: "Typai Dictionary Blob v1",
    assetSchemaVersion: dictionaryBlobVersion,
    language: manifest.language,
    production,
    fixture: !production,
    dictionarySourceHash: manifest.dictionary?.sha256 || sourceSetSha256(sourceFiles.dictionary),
    frequencySourceHash: manifest.frequency?.sha256 || sourceSetSha256(sourceFiles.frequency),
    manifestHash,
    inputManifestHash: manifestHash,
    inputManifest: {
      path: relativeToWorkspace(manifestPath),
      sha256: manifestHash,
    },
    sourceHashes,
    transform: {
      script: relativeToWorkspace(scriptPath),
      version: productionTransformScriptVersion,
      sha256: sha256(scriptBytes),
      networkFetchAllowed: false,
      networkFetches: false,
      filters: manifest.transform?.filters ?? [],
      normalizationPolicy: {
        unicodeNormalization: "NFKC before ASCII validation",
        casing: "lowercase en-US locale after protected-token screening",
        allowedCharacters: "ASCII a-z only",
        apostrophes: "excluded",
        hyphens: "excluded as protected_hyphenated",
        minWordLength: dictionaryMinWordLength,
        maxWordLength: dictionaryMaxWordLength,
        identifiersUrlsEmailsPaths: "excluded",
        sortOrder: "ASCII lexicographic by normalized word",
      },
    },
    generatedAt,
    wordCount: entries.length,
    byteSize: binary.byteLength,
    sha256: binarySha256,
    outputSha256: binarySha256,
    excludedCountByReason,
    excludedCountsByReason: excludedCountByReason,
    frequencyCoveragePercentage: frequencyCoverage.percentage,
    frequencyCoverage,
    packageInclusion: manifest.output?.packageInclusion ?? "blocked",
    packageInclusionPolicy: manifest.output?.packageInclusion ?? "blocked",
    attributionReference: {
      dictionary: manifest.dictionary?.attribution ?? "",
      frequency: manifest.frequency?.attribution ?? "",
      file: relativeToWorkspace(productionAttributionPath),
    },
    output: {
      binaryPath: relativeToWorkspace(binaryPath),
      metadataPath: relativeToWorkspace(metadataPath),
    },
  };
}

function createFrequencyCoverage(entries) {
  const wordsWithFrequency = entries.filter((entry) => entry.frequency > 0).length;
  const wordsWithoutFrequency = entries.length - wordsWithFrequency;
  const percentage =
    entries.length === 0 ? 0 : Number(((wordsWithFrequency / entries.length) * 100).toFixed(4));

  return {
    wordsWithFrequency,
    wordsWithoutFrequency,
    totalWords: entries.length,
    percentage,
  };
}

function sourceSetSha256(files) {
  return sha256(
    Buffer.from(
      files
        .map((file) => `${relativeToWorkspace(file.path)}\t${file.sha256}`)
        .sort(compareAscii)
        .join("\n"),
      "utf8",
    ),
  );
}

function sourceFileMetadata(file) {
  return {
    path: relativeToWorkspace(file.path),
    fileName: file.fileName,
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
  sha256: outputSha256,
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
  manifest.output.sha256 = outputSha256;
  manifest.output.assetPath = relativeToWorkspace(binaryPath);
  manifest.transform.generatedAt = generatedAt;

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function validateBlockedProductionDirectory() {
  const allowed = new Set([
    resolve(productionAssetsRoot, "MANIFEST.json"),
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

      if (typeof file.sha256 !== "string" || file.sha256.length === 0) {
        missing.push(`${label}.sourceFiles[${index}]: raw source SHA-256`);
      }
    });

    if (typeof source.sha256 !== "string" || source.sha256.length === 0) {
      missing.push(`${label}: aggregate/source-set SHA-256`);
    }
  }

  missing.push("production review.status approved");
  missing.push("deterministic generated output hash, word count, and byte size");
  missing.push("quality and package-size gate evidence");

  return missing;
}

function expandDictionarySourceFile(file) {
  if (extname(file.path).toLowerCase() !== ".zip") {
    return [file];
  }

  const archiveBytes = readFileSync(file.path);
  const wantedEntries = new Set(
    file.contents.filter((entry) => entry.toLowerCase().endsWith(".dic")),
  );
  const entries = extractZipEntries(archiveBytes)
    .filter((entry) => entry.name.toLowerCase().endsWith(".dic"))
    .filter(
      (entry) =>
        wantedEntries.size === 0 ||
        wantedEntries.has(entry.name) ||
        wantedEntries.has(basename(entry.name)),
    );

  if (entries.length === 0) {
    throw new Error(`Dictionary archive has no selected .dic entries: ${file.path}`);
  }

  return entries.map((entry) => ({
    ...file,
    path: `${file.path}!${entry.name}`,
    fileName: entry.name,
    bytes: entry.bytes,
    byteSize: entry.bytes.byteLength,
  }));
}

function extractZipEntries(bytes) {
  const eocdOffset = findEndOfCentralDirectory(bytes);

  if (eocdOffset === -1) {
    throw new Error("ZIP archive is missing an end-of-central-directory record.");
  }

  const diskNumber = bytes.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = bytes.readUInt16LE(eocdOffset + 6);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    throw new Error("Split ZIP archives are not supported.");
  }

  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("ZIP central directory is malformed.");
    }

    const compressionMethod = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = bytes.subarray(nameStart, nameEnd).toString("utf8");

    if (!name.endsWith("/")) {
      entries.push({
        name,
        bytes: extractZipEntryBytes({
          archiveBytes: bytes,
          localHeaderOffset,
          compressionMethod,
          compressedSize,
          uncompressedSize,
        }),
      });
    }

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes) {
  const minimumLength = 22;
  const earliest = Math.max(0, bytes.byteLength - 0xffff - minimumLength);

  for (let offset = bytes.byteLength - minimumLength; offset >= earliest; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function extractZipEntryBytes({
  archiveBytes,
  localHeaderOffset,
  compressionMethod,
  compressedSize,
  uncompressedSize,
}) {
  if (archiveBytes.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("ZIP local file header is malformed.");
  }

  const fileNameLength = archiveBytes.readUInt16LE(localHeaderOffset + 26);
  const extraLength = archiveBytes.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  const compressed = archiveBytes.subarray(dataStart, dataEnd);
  const output =
    compressionMethod === 0
      ? Buffer.from(compressed)
      : compressionMethod === 8
        ? inflateRawSync(compressed)
        : null;

  if (!output) {
    throw new Error(`Unsupported ZIP compression method: ${compressionMethod}.`);
  }

  if (output.byteLength !== uncompressedSize) {
    throw new Error("ZIP entry uncompressed size mismatch.");
  }

  return output;
}

async function* readSourceLines(file) {
  if (file.bytes) {
    for (const line of decodeSourceBytes(file).split(/\r?\n/u)) {
      yield line;
    }
    return;
  }

  if (extname(file.path).toLowerCase() === ".gz") {
    const stream = createReadStream(file.path).pipe(createGunzip());
    const lines = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of lines) {
      yield line;
    }
    return;
  }

  for (const line of decodeSourceBytes(file).split(/\r?\n/u)) {
    yield line;
  }
}

function decodeSourceBytes(file) {
  const extension = extname(file.path).toLowerCase();
  const bytes = file.bytes ?? readFileSync(file.path);
  const decodedBytes = extension === ".gz" ? gunzipSync(bytes) : bytes;

  return new TextDecoder("utf-8", { fatal: true }).decode(decodedBytes);
}

function isFrequencyMetadataFile(file) {
  return file.fileName === "totalcounts-1" || basename(file.path) === "totalcounts-1";
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
  return Array.from(new Set(readdirSync(dir))).sort(compareAscii);
}

function requireProductionNoticeFile(path, label) {
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new Error(`Approved production transform requires ${label}.`);
  }

  const resolvedPath = resolveInputPath(path);

  if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
    throw new Error(`Approved production transform requires existing ${label}: ${path}.`);
  }

  if (!isPathUnder(resolvedPath, productionAssetsRoot)) {
    throw new Error(`Approved production transform requires ${label} under production assets.`);
  }

  if (readFileSync(resolvedPath, "utf8").trim().length === 0) {
    throw new Error(`Approved production transform requires non-empty ${label}.`);
  }
}

function printBuildResult(title, result) {
  console.log(title);
  console.log(`binary: ${result.binaryPath}`);
  console.log(`metadata: ${result.metadataPath}`);
  console.log(`words: ${result.wordCount}`);
  console.log(`bytes: ${result.byteSize}`);
  console.log(`sha256: ${result.sha256}`);

  if (result.metadata?.frequencyCoveragePercentage !== undefined) {
    console.log(`frequency coverage: ${result.metadata.frequencyCoveragePercentage}%`);
  }
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

function relativeToWorkspace(path) {
  return relative(workspaceRoot, path).replaceAll("\\", "/");
}

function isPathUnder(path, root) {
  const relativePath = relative(root, path);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
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

function isAscii(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }

  return true;
}
