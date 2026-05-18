import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  decodeTypaiDictionaryBlob,
  encodeTypaiDictionaryBlob,
  TypaiDictionaryBlobError,
  typaiDictionaryMagic,
  typaiDictionaryVersion,
} from "./dictionaryBlob";

const mockDictionaryUrl = new URL("../assets/mock-en-us.dictionary.bin", import.meta.url);

describe("Typai Dictionary Blob v1", () => {
  it("decodes the generated mock dictionary asset", () => {
    const blob = decodeTypaiDictionaryBlob(readFileSync(mockDictionaryUrl));
    const receipt = blob.entries.find((entry) => entry.word === "receipt");
    const nmap = blob.entries.find((entry) => entry.word === "nmap");

    expect(blob.magic).toBe(typaiDictionaryMagic);
    expect(blob.version).toBe(typaiDictionaryVersion);
    expect(blob.language).toBe("en-US");
    expect(blob.wordCount).toBe(blob.entries.length);
    expect(blob.wordCount).toBeGreaterThanOrEqual(20);
    expect(receipt).toEqual({
      word: "receipt",
      frequency: 45000,
      flags: 0,
    });
    expect(nmap).toEqual({
      word: "nmap",
      frequency: 1000,
      flags: 1,
    });
  });

  it("round-trips entries and preserves frequencies", () => {
    const encoded = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [
        { word: "address", frequency: 40000, flags: 0 },
        { word: "receipt", frequency: 45000, flags: 0 },
      ],
    });

    expect(decodeTypaiDictionaryBlob(encoded)).toMatchObject({
      language: "en-US",
      wordCount: 2,
      entries: [
        { word: "address", frequency: 40000, flags: 0 },
        { word: "receipt", frequency: 45000, flags: 0 },
      ],
    });
  });

  it("rejects invalid magic", () => {
    const encoded = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [{ word: "the", frequency: 1000000, flags: 0 }],
    });

    encoded[0] = "X".charCodeAt(0);

    expect(() => decodeTypaiDictionaryBlob(encoded)).toThrow(TypaiDictionaryBlobError);
  });

  it("rejects future versions", () => {
    const encoded = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [{ word: "the", frequency: 1000000, flags: 0 }],
    });
    const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);

    view.setUint32(8, typaiDictionaryVersion + 1, true);

    expect(() => decodeTypaiDictionaryBlob(encoded)).toThrow(/Unsupported dictionary blob version/);
  });

  it("rejects truncated payloads", () => {
    const encoded = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [{ word: "the", frequency: 1000000, flags: 0 }],
    });

    expect(() => decodeTypaiDictionaryBlob(encoded.subarray(0, encoded.byteLength - 1))).toThrow(
      /length fields/,
    );
  });

  it("rejects invalid UTF-8 in words", () => {
    const encoded = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [{ word: "the", frequency: 1000000, flags: 0 }],
    });
    const wordByteOffset = 24 + 14;

    encoded[wordByteOffset] = 0xff;

    expect(() => decodeTypaiDictionaryBlob(encoded)).toThrow(/Invalid UTF-8/);
  });

  it("rejects duplicate words during encoding", () => {
    expect(() =>
      encodeTypaiDictionaryBlob({
        language: "en-US",
        entries: [
          { word: "the", frequency: 1000000, flags: 0 },
          { word: "the", frequency: 999999, flags: 0 },
        ],
      }),
    ).toThrow(/Duplicate dictionary word/);
  });
});
