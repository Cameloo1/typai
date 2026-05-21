const magic = "TYPAIDIC";
const version = 1;
const language = "en-US";
const headerByteLength = 24;
const entryByteLength = 14;

const baselineWords = [
  "a",
  "accommodate",
  "address",
  "addresses",
  "affect",
  "and",
  "argument",
  "backtest",
  "because",
  "biome",
  "burp",
  "calendar",
  "codemirror",
  "correction",
  "csrf",
  "cve",
  "definitely",
  "drawdown",
  "effect",
  "embarrass",
  "environment",
  "ffuf",
  "from",
  "github",
  "gobuster",
  "government",
  "input",
  "iptables",
  "its",
  "kubectl",
  "lead",
  "led",
  "liquidity",
  "metasploit",
  "nmap",
  "openai",
  "orderflow",
  "output",
  "playwright",
  "private",
  "public",
  "publicly",
  "receipt",
  "receive",
  "recipe",
  "rce",
  "rust",
  "separate",
  "sqlmap",
  "ssrf",
  "stoploss",
  "the",
  "their",
  "there",
  "to",
  "too",
  "turborepo",
  "typescript",
  "until",
  "vwap",
  "avery",
  "wasm",
  "wear",
  "were",
  "where",
  "xss",
];

export function buildQualityDictionaryBytes(rows, extraWords = []) {
  const words = new Set([...baselineWords, ...extraWords]);

  for (const row of rows) {
    if (row.validWordTrap || (row.expectedAction === "do_nothing" && !row.protected)) {
      addAllowedWord(words, row.input);
    }

    if (row.expectedReplacement !== undefined) {
      addAllowedWord(words, row.expectedReplacement);
    }

    for (const suggestion of row.expectedSuggestions ?? []) {
      addAllowedWord(words, suggestion);
    }
  }

  const entries = [...words]
    .filter((word) => /^[a-z]+$/.test(word))
    .sort((left, right) => left.localeCompare(right, "en-US"))
    .map((word, index) => [word, Math.max(1, 1_000_000 - index), 0]);

  return encodeDictionary(entries);
}

function addAllowedWord(words, rawWord) {
  const normalized = rawWord.toLowerCase().replace(/^[`"'([{]+|[`"')\]},.;:!?]+$/g, "");

  if (/^[a-z]+$/.test(normalized)) {
    words.add(normalized);
  }
}

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
  const output = new Uint8Array(byteLength);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  let offset = 0;

  for (const char of magic) {
    output[offset] = char.charCodeAt(0);
    offset += 1;
  }

  view.setUint32(offset, version, true);
  offset += 4;
  view.setUint16(offset, languageBytes.byteLength, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint32(offset, encodedEntries.length, true);
  offset += 4;
  view.setUint32(offset, stringTableByteLength, true);
  offset += 4;

  let wordOffset = 0;

  for (const entry of encodedEntries) {
    view.setUint32(offset, wordOffset, true);
    offset += 4;
    view.setUint16(offset, entry.bytes.byteLength, true);
    offset += 2;
    view.setUint32(offset, entry.frequency, true);
    offset += 4;
    view.setUint32(offset, entry.flags, true);
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
