export const typaiDictionaryMagic = "TYPAIDIC";
export const typaiDictionaryVersion = 1;
export const typaiDictionaryEntryByteLength = 14;

const headerByteLength = 24;
const maxUint16 = 0xffff;

export interface TypaiDictionaryBlobEntry {
  readonly word: string;
  readonly frequency: number;
  readonly flags: number;
}

export interface TypaiDictionaryBlob {
  readonly magic: typeof typaiDictionaryMagic;
  readonly version: typeof typaiDictionaryVersion;
  readonly language: string;
  readonly wordCount: number;
  readonly stringTableByteLength: number;
  readonly entries: TypaiDictionaryBlobEntry[];
}

export interface EncodeTypaiDictionaryBlobInput {
  readonly language: string;
  readonly entries: TypaiDictionaryBlobEntry[];
}

export class TypaiDictionaryBlobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypaiDictionaryBlobError";
  }
}

export function encodeTypaiDictionaryBlob(input: EncodeTypaiDictionaryBlobInput): Uint8Array {
  const encoder = new TextEncoder();
  const languageBytes = encoder.encode(input.language);
  const seenWords = new Set<string>();
  const encodedEntries = input.entries.map((entry) => {
    validateEntry(entry, seenWords);

    return {
      ...entry,
      wordBytes: encoder.encode(entry.word),
    };
  });

  if (languageBytes.length > maxUint16) {
    throw new TypaiDictionaryBlobError("Language code is too long.");
  }

  const stringTableByteLength = encodedEntries.reduce(
    (total, entry) => total + entry.wordBytes.byteLength,
    0,
  );
  const languageTableOffset =
    headerByteLength + encodedEntries.length * typaiDictionaryEntryByteLength;
  const byteLength = languageTableOffset + stringTableByteLength + languageBytes.byteLength;
  const output = new Uint8Array(byteLength);
  const view = new DataView(output.buffer);
  let offset = 0;

  output.set(encoder.encode(typaiDictionaryMagic), offset);
  offset += typaiDictionaryMagic.length;
  view.setUint32(offset, typaiDictionaryVersion, true);
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
    if (entry.wordBytes.byteLength > maxUint16) {
      throw new TypaiDictionaryBlobError(`Word is too long: ${entry.word}`);
    }

    view.setUint32(offset, wordOffset, true);
    offset += 4;
    view.setUint16(offset, entry.wordBytes.byteLength, true);
    offset += 2;
    view.setUint32(offset, entry.frequency, true);
    offset += 4;
    view.setUint32(offset, entry.flags, true);
    offset += 4;
    wordOffset += entry.wordBytes.byteLength;
  }

  for (const entry of encodedEntries) {
    output.set(entry.wordBytes, offset);
    offset += entry.wordBytes.byteLength;
  }

  output.set(languageBytes, offset);

  return output;
}

export function decodeTypaiDictionaryBlob(
  bytes: ArrayBufferView | ArrayBuffer,
): TypaiDictionaryBlob {
  const input = toUint8Array(bytes);

  if (input.byteLength < headerByteLength) {
    throw new TypaiDictionaryBlobError("Dictionary blob is too short.");
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const magic = decodeUtf8(decoder, input.subarray(0, typaiDictionaryMagic.length), "magic");

  if (magic !== typaiDictionaryMagic) {
    throw new TypaiDictionaryBlobError("Invalid dictionary blob magic.");
  }

  let offset = typaiDictionaryMagic.length;
  const version = view.getUint32(offset, true);
  offset += 4;

  if (version !== typaiDictionaryVersion) {
    throw new TypaiDictionaryBlobError(`Unsupported dictionary blob version: ${version}.`);
  }

  const languageByteLength = view.getUint16(offset, true);
  offset += 2;
  const reserved = view.getUint16(offset, true);
  offset += 2;

  if (reserved !== 0) {
    throw new TypaiDictionaryBlobError("Dictionary blob reserved field must be zero.");
  }

  const wordCount = view.getUint32(offset, true);
  offset += 4;
  const stringTableByteLength = view.getUint32(offset, true);
  offset += 4;
  const entriesByteLength = wordCount * typaiDictionaryEntryByteLength;
  const stringTableOffset = headerByteLength + entriesByteLength;
  const languageOffset = stringTableOffset + stringTableByteLength;
  const expectedByteLength = languageOffset + languageByteLength;

  if (expectedByteLength !== input.byteLength) {
    throw new TypaiDictionaryBlobError("Dictionary blob length fields do not match payload size.");
  }

  const stringTable = input.subarray(stringTableOffset, languageOffset);
  const seenWords = new Set<string>();
  const entries: TypaiDictionaryBlobEntry[] = [];

  for (let index = 0; index < wordCount; index += 1) {
    const wordOffset = view.getUint32(offset, true);
    offset += 4;
    const wordByteLength = view.getUint16(offset, true);
    offset += 2;
    const frequency = view.getUint32(offset, true);
    offset += 4;
    const flags = view.getUint32(offset, true);
    offset += 4;
    const wordEnd = wordOffset + wordByteLength;

    if (wordByteLength === 0 || wordEnd > stringTable.byteLength) {
      throw new TypaiDictionaryBlobError(`Dictionary entry ${index} has invalid word bounds.`);
    }

    const word = decodeUtf8(decoder, stringTable.subarray(wordOffset, wordEnd), `entry ${index}`);

    if (seenWords.has(word)) {
      throw new TypaiDictionaryBlobError(`Duplicate dictionary word: ${word}`);
    }

    seenWords.add(word);
    entries.push({
      word,
      frequency,
      flags,
    });
  }

  const language = decodeUtf8(decoder, input.subarray(languageOffset), "language");

  return {
    magic: typaiDictionaryMagic,
    version: typaiDictionaryVersion,
    language,
    wordCount,
    stringTableByteLength,
    entries,
  };
}

function validateEntry(entry: TypaiDictionaryBlobEntry, seenWords: Set<string>): void {
  if (entry.word.length === 0) {
    throw new TypaiDictionaryBlobError("Dictionary words must not be empty.");
  }

  if (entry.word !== entry.word.toLocaleLowerCase("en-US")) {
    throw new TypaiDictionaryBlobError(`Dictionary words must be lowercase: ${entry.word}`);
  }

  if (seenWords.has(entry.word)) {
    throw new TypaiDictionaryBlobError(`Duplicate dictionary word: ${entry.word}`);
  }

  if (!Number.isInteger(entry.frequency) || entry.frequency < 0) {
    throw new TypaiDictionaryBlobError(`Invalid frequency for word: ${entry.word}`);
  }

  if (!Number.isInteger(entry.flags) || entry.flags < 0) {
    throw new TypaiDictionaryBlobError(`Invalid flags for word: ${entry.word}`);
  }

  seenWords.add(entry.word);
}

function toUint8Array(bytes: ArrayBufferView | ArrayBuffer): Uint8Array {
  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }

  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function decodeUtf8(decoder: TextDecoder, bytes: Uint8Array, label: string): string {
  try {
    return decoder.decode(bytes);
  } catch {
    throw new TypaiDictionaryBlobError(`Invalid UTF-8 in dictionary ${label}.`);
  }
}
