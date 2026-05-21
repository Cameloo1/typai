import {
  createScaledMockEntries,
  defaultScaledMockWordCount,
  scaledMockBinaryPath,
  scaledMockMetaPath,
  validateDictionaryAsset,
  writeDictionaryAsset,
} from "./dictionary-asset-utils.mjs";

const wordCount = readWordCountArg();
const entries = createScaledMockEntries(wordCount);
const { meta } = writeDictionaryAsset({
  entries,
  binaryPath: scaledMockBinaryPath,
  metaPath: scaledMockMetaPath,
  assetKind: "scaled-mock",
  note: "Generated scaled mock fixture for loader stress tests only. Not a production dictionary or frequency asset.",
});
const validation = validateDictionaryAsset({
  binaryPath: scaledMockBinaryPath,
  metaPath: scaledMockMetaPath,
  minWordCount: wordCount,
});

console.log("Built Typai scaled mock dictionary asset.");
console.log(`binary: ${scaledMockBinaryPath}`);
console.log(`metadata: ${scaledMockMetaPath}`);
console.log(`words: ${validation.wordCount}`);
console.log(`bytes: ${validation.byteLength}`);
console.log(`sha256: ${validation.sha256}`);
console.log(`mockOnly: ${meta.mockOnly}`);

function readWordCountArg() {
  const rawFlag = process.argv.find((arg) => arg.startsWith("--word-count="));
  const rawValue = rawFlag?.slice("--word-count=".length) ?? process.env.TYPAI_SCALED_MOCK_WORDS;

  if (rawValue === undefined) {
    return defaultScaledMockWordCount;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value)) {
    throw new Error(`Invalid --word-count value: ${rawValue}`);
  }

  return value;
}
