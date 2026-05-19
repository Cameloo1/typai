import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const magic = "TYPAIDIC";
export const version = 1;
export const language = "en-US";
export const headerByteLength = 24;
export const entryByteLength = 14;
export const technicalWordFlag = 1;
export const transformScriptVersion = "prompt-101-scaled-mock-v1";
export const defaultScaledMockWordCount = 3600;

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const assetsRoot = resolve(packageRoot, "assets");
export const generatedAssetsRoot = resolve(assetsRoot, "generated");
export const scaledMockBinaryPath = resolve(
  generatedAssetsRoot,
  "scaled-mock-en-us.dictionary.bin",
);
export const scaledMockMetaPath = resolve(
  generatedAssetsRoot,
  "scaled-mock-en-us.dictionary.meta.json",
);

export const mockFixtureEntries = [
  ["the", 1000000, 0],
  ["and", 900000, 0],
  ["from", 800000, 0],
  ["form", 700000, 0],
  ["because", 250000, 0],
  ["their", 240000, 0],
  ["there", 230000, 0],
  ["lead", 100000, 0],
  ["led", 90000, 0],
  ["receive", 50000, 0],
  ["receipt", 45000, 0],
  ["address", 40000, 0],
  ["correction", 35000, 0],
  ["correct", 34000, 0],
  ["recipe", 30000, 0],
  ["spelling", 30000, 0],
  ["separate", 28000, 0],
  ["tomorrow", 27000, 0],
  ["definitely", 26000, 0],
  ["accommodate", 25000, 0],
  ["occurred", 24000, 0],
  ["until", 23000, 0],
  ["government", 22000, 0],
  ["environment", 21000, 0],
  ["argument", 20000, 0],
  ["calendar", 19000, 0],
  ["embarrass", 18000, 0],
  ["publicly", 17000, 0],
  ["necessary", 16000, 0],
  ["addresses", 15000, 0],
  ["typing", 20000, 0],
  ["message", 20000, 0],
  ["prompt", 15000, 0],
  ["nmap", 1000, technicalWordFlag],
];

export const protectedLookingSamples = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "snake_case_identifier",
  "camelCaseIdentifier",
  "CVE-2024-1234",
  "abc123",
  "name-with-hyphen",
];

export function createScaledMockEntries(wordCount = defaultScaledMockWordCount) {
  if (!Number.isInteger(wordCount) || wordCount < mockFixtureEntries.length + 1) {
    throw new Error(
      `Scaled mock word count must be an integer greater than ${mockFixtureEntries.length}.`,
    );
  }

  const entries = new Map();

  for (const [word, frequency, flags] of mockFixtureEntries) {
    entries.set(word, { word, frequency, flags });
  }

  let syntheticIndex = 0;

  while (entries.size < wordCount) {
    const word = `mock${indexToLetters(syntheticIndex, 4)}`;
    syntheticIndex += 1;

    if (entries.has(word)) {
      continue;
    }

    entries.set(word, {
      word,
      frequency: Math.max(1, 600000 - syntheticIndex),
      flags: 0,
    });
  }

  return [...entries.values()]
    .map((entry) => [entry.word, entry.frequency, entry.flags])
    .sort(([left], [right]) => left.localeCompare(right, "en-US"));
}

export function writeDictionaryAsset({
  entries,
  binaryPath,
  metaPath,
  assetKind,
  note,
  generatedAt = new Date().toISOString(),
}) {
  assertEntriesAllowed(entries);
  mkdirSync(dirname(binaryPath), { recursive: true });
  mkdirSync(dirname(metaPath), { recursive: true });

  const binary = encodeDictionary(entries);
  const binarySha256 = sha256(binary);
  const meta = {
    format: "Typai Dictionary Blob v1",
    language,
    magic,
    version,
    assetKind,
    mockOnly: true,
    production: false,
    packageInclusionPolicy: "not bundled",
    sourceName: "Typai deterministic scaled mock generator",
    sourceUrl: "repo-local:packages/core/scripts/build-dictionary-asset.mjs",
    sourceVersion: transformScriptVersion,
    sourceHash: "not-applicable-mock",
    sourceLicense: "repo-local mock fixture; not a production language asset",
    frequencySourceName: "Typai deterministic synthetic frequency ranks",
    frequencySourceUrl: "repo-local:packages/core/scripts/dictionary-asset-utils.mjs",
    frequencySourceVersion: transformScriptVersion,
    frequencyLicense: "repo-local mock fixture; not a production frequency asset",
    attributionText:
      "No third-party attribution. This is a deterministic Typai mock fixture, not a production dictionary or frequency asset.",
    transformScriptVersion,
    generatedWordCount: entries.length,
    generatedAt,
    byteLength: binary.byteLength,
    sha256: binarySha256,
    flags: {
      technicalWord: technicalWordFlag,
    },
    casingPolicy: "lowercase ASCII alphabetic words only",
    protectedTokenPolicy:
      "URL, email, path, identifier, numeric, hyphenated, and mixed-case looking tokens are excluded.",
    note,
    entries: entries.map(([word, frequency, flags]) => ({ word, frequency, flags })),
  };

  writeFileSync(binaryPath, binary);
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  return {
    binaryPath,
    metaPath,
    meta,
  };
}

export function validateDictionaryAsset({
  binaryPath = scaledMockBinaryPath,
  metaPath = scaledMockMetaPath,
  minWordCount = 1000,
} = {}) {
  const binary = readFileSync(binaryPath);
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const decoded = decodeDictionary(binary);

  if (decoded.magic !== magic) {
    throw new Error(`Invalid dictionary magic: ${decoded.magic}`);
  }

  if (decoded.version !== version) {
    throw new Error(`Invalid dictionary version: ${decoded.version}`);
  }

  if (decoded.language !== language) {
    throw new Error(`Invalid dictionary language: ${decoded.language}`);
  }

  if (decoded.entries.length < minWordCount) {
    throw new Error(
      `Dictionary word count ${decoded.entries.length} is below required minimum ${minWordCount}.`,
    );
  }

  if (decoded.entries.length !== meta.generatedWordCount) {
    throw new Error("Dictionary generated word count does not match metadata.");
  }

  if (sha256(binary) !== meta.sha256) {
    throw new Error("Dictionary SHA-256 does not match metadata.");
  }

  if (meta.mockOnly !== true || meta.production !== false) {
    throw new Error("Scaled mock metadata must be explicitly mock-only and non-production.");
  }

  assertEntriesAllowed(decoded.entries.map((entry) => [entry.word, entry.frequency, entry.flags]));

  for (const sample of protectedLookingSamples) {
    if (decoded.entries.some((entry) => entry.word === sample)) {
      throw new Error(`Protected-looking token leaked into dictionary asset: ${sample}`);
    }
  }

  return {
    wordCount: decoded.entries.length,
    byteLength: binary.byteLength,
    sha256: meta.sha256,
    mockOnly: meta.mockOnly,
    production: meta.production,
  };
}

export function encodeDictionary(inputEntries) {
  const encoder = new TextEncoder();
  const languageBytes = encoder.encode(language);
  const encodedEntries = inputEntries.map(([word, frequency, flags]) => ({
    word,
    frequency,
    flags,
    bytes: encoder.encode(word),
  }));
  const stringTableByteLength = encodedEntries.reduce(
    (total, entry) => total + entry.bytes.byteLength,
    0,
  );
  const byteLength =
    headerByteLength +
    encodedEntries.length * entryByteLength +
    stringTableByteLength +
    languageBytes.byteLength;
  const output = Buffer.alloc(byteLength);
  let offset = 0;

  output.write(magic, offset, "ascii");
  offset += magic.length;
  output.writeUInt32LE(version, offset);
  offset += 4;
  output.writeUInt16LE(languageBytes.byteLength, offset);
  offset += 2;
  output.writeUInt16LE(0, offset);
  offset += 2;
  output.writeUInt32LE(encodedEntries.length, offset);
  offset += 4;
  output.writeUInt32LE(stringTableByteLength, offset);
  offset += 4;

  let wordOffset = 0;

  for (const entry of encodedEntries) {
    output.writeUInt32LE(wordOffset, offset);
    offset += 4;
    output.writeUInt16LE(entry.bytes.byteLength, offset);
    offset += 2;
    output.writeUInt32LE(entry.frequency, offset);
    offset += 4;
    output.writeUInt32LE(entry.flags, offset);
    offset += 4;
    wordOffset += entry.bytes.byteLength;
  }

  for (const entry of encodedEntries) {
    output.set(entry.bytes, offset);
    offset += entry.bytes.byteLength;
  }

  output.set(languageBytes, offset);

  return output;
}

export function decodeDictionary(binary) {
  if (binary.byteLength < headerByteLength) {
    throw new Error("Dictionary blob is too short.");
  }

  const magicValue = binary.subarray(0, magic.length).toString("ascii");
  const versionValue = binary.readUInt32LE(8);
  const languageByteLength = binary.readUInt16LE(12);
  const reserved = binary.readUInt16LE(14);
  const wordCount = binary.readUInt32LE(16);
  const stringTableByteLength = binary.readUInt32LE(20);
  const entriesOffset = headerByteLength;
  const stringTableOffset = entriesOffset + wordCount * entryByteLength;
  const languageOffset = stringTableOffset + stringTableByteLength;
  const expectedByteLength = languageOffset + languageByteLength;

  if (reserved !== 0) {
    throw new Error("Dictionary reserved field must be zero.");
  }

  if (expectedByteLength !== binary.byteLength) {
    throw new Error("Dictionary length fields do not match payload size.");
  }

  const stringTable = binary.subarray(stringTableOffset, languageOffset);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries = [];
  const seenWords = new Set();
  let offset = entriesOffset;

  for (let index = 0; index < wordCount; index += 1) {
    const wordOffset = binary.readUInt32LE(offset);
    offset += 4;
    const wordByteLength = binary.readUInt16LE(offset);
    offset += 2;
    const frequency = binary.readUInt32LE(offset);
    offset += 4;
    const flags = binary.readUInt32LE(offset);
    offset += 4;
    const wordEnd = wordOffset + wordByteLength;

    if (wordByteLength === 0 || wordEnd > stringTable.byteLength) {
      throw new Error(`Dictionary entry ${index} has invalid word bounds.`);
    }

    const word = decoder.decode(stringTable.subarray(wordOffset, wordEnd));

    if (seenWords.has(word)) {
      throw new Error(`Duplicate dictionary word: ${word}`);
    }

    seenWords.add(word);
    entries.push({ word, frequency, flags });
  }

  return {
    magic: magicValue,
    version: versionValue,
    language: decoder.decode(binary.subarray(languageOffset)),
    entries,
  };
}

export function assertEntriesAllowed(entries) {
  const seenWords = new Set();

  for (const [word, frequency, flags] of entries) {
    if (!isAllowedDictionaryWord(word)) {
      throw new Error(`Dictionary word is not allowed in v1 assets: ${word}`);
    }

    if (seenWords.has(word)) {
      throw new Error(`Duplicate dictionary word: ${word}`);
    }

    if (!Number.isInteger(frequency) || frequency < 0) {
      throw new Error(`Invalid dictionary frequency for word: ${word}`);
    }

    if (!Number.isInteger(flags) || flags < 0) {
      throw new Error(`Invalid dictionary flags for word: ${word}`);
    }

    seenWords.add(word);
  }
}

export function isAllowedDictionaryWord(word) {
  return /^[a-z]+$/.test(word);
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function indexToLetters(index, width) {
  let value = index;
  let output = "";

  for (let position = 0; position < width; position += 1) {
    output = String.fromCharCode(97 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }

  return output;
}
