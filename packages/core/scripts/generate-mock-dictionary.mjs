import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const magic = "TYPAIDIC";
const version = 1;
const language = "en-US";
const headerByteLength = 24;
const entryByteLength = 14;
const technicalWordFlag = 1;
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = resolve(packageRoot, "assets");
const binaryPath = resolve(assetsRoot, "mock-en-us.dictionary.bin");
const jsonPath = resolve(assetsRoot, "mock-en-us.dictionary.json");
const entries = [
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
  ["typing", 20000, 0],
  ["message", 20000, 0],
  ["prompt", 15000, 0],
  ["nmap", 1000, technicalWordFlag],
].sort(([left], [right]) => left.localeCompare(right, "en-US"));

mkdirSync(assetsRoot, { recursive: true });

const binary = encodeDictionary(entries);

writeFileSync(binaryPath, binary);
writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      format: "Typai Dictionary Blob v1",
      language,
      magic,
      version,
      flags: {
        technicalWord: technicalWordFlag,
      },
      note: "Generated mock fixture for loader tests only. Not a production dictionary asset.",
      entries: entries.map(([word, frequency, flags]) => ({ word, frequency, flags })),
    },
    null,
    2,
  )}\n`,
);

console.log(`Generated ${binaryPath}`);
console.log(`Generated ${jsonPath}`);

function encodeDictionary(inputEntries) {
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
