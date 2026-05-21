import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createTypaiCore } from "./createTypaiCore";
import { decodeTypaiDictionaryBlob } from "./dictionaryBlob";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const mockDictionaryUrl = new URL("../assets/mock-en-us.dictionary.bin", import.meta.url);
const scaledMockDictionaryUrl = new URL(
  "../assets/generated/scaled-mock-en-us.dictionary.bin",
  import.meta.url,
);
const scaledMockMetaUrl = new URL(
  "../assets/generated/scaled-mock-en-us.dictionary.meta.json",
  import.meta.url,
);
const protectedLookingSamples = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "snake_case_identifier",
  "camelCaseIdentifier",
  "CVE-2024-1234",
];

describe("blocked-branch dictionary asset pipeline", () => {
  it("builds a mock-only scaled dictionary fixture with manifest metadata", () => {
    buildScaledMockFixture(1200);

    const mockBlob = decodeTypaiDictionaryBlob(readFileSync(mockDictionaryUrl));
    const scaledBlob = decodeTypaiDictionaryBlob(readFileSync(scaledMockDictionaryUrl));
    const meta = JSON.parse(readFileSync(scaledMockMetaUrl, "utf8")) as {
      mockOnly: boolean;
      production: boolean;
      generatedWordCount: number;
      sha256: string;
      entries: Array<{ word: string; frequency: number; flags: number }>;
    };
    const words = new Set(scaledBlob.entries.map((entry) => entry.word));

    expect(meta.mockOnly).toBe(true);
    expect(meta.production).toBe(false);
    expect(meta.generatedWordCount).toBe(scaledBlob.wordCount);
    expect(meta.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(scaledBlob.wordCount).toBeGreaterThan(mockBlob.wordCount);
    expect(scaledBlob.wordCount).toBeGreaterThanOrEqual(1200);

    for (const word of [
      "the",
      "and",
      "because",
      "receive",
      "address",
      "receipt",
      "separate",
      "tomorrow",
    ]) {
      expect(words.has(word)).toBe(true);
    }

    for (const sample of protectedLookingSamples) {
      expect(words.has(sample)).toBe(false);
    }

    expect(scaledBlob.entries.every((entry) => /^[a-z]+$/u.test(entry.word))).toBe(true);
    expect(scaledBlob.entries.every((entry) => entry.frequency >= 0)).toBe(true);
  });

  it("loads an externally generated local fixture through the host-provided bytes path", async () => {
    buildScaledMockFixture(1200);

    const bytes = readFileSync(scaledMockDictionaryUrl);
    const blob = decodeTypaiDictionaryBlob(bytes);
    const core = await createTypaiCore({
      dictionary: {
        load: async () => new Uint8Array(bytes),
      },
    });

    expect(core.getLoadedDictionaryWordCount()).toBe(blob.wordCount);
    expect(core.checkCompletedToken({ token: "because" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
    expect(core.checkCompletedToken({ token: "teh" }).action).toBe("auto_correct");

    const decision = core.checkCompletedToken({ token: "addres" });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action === "mark_unresolved") {
      expect(decision.suggestions).toContain("address");
      expect(decision.mark).toBe("red_spelling_issue");
    }

    const suggestions = core.suggestToken({ token: "reciept", maxSuggestions: 4 });

    expect(suggestions.suggestions).toContain("receipt");
    expect(core.suggestToken({ token: "seperate", maxSuggestions: 4 }).suggestions).toContain(
      "separate",
    );
    expect(core.suggestToken({ token: "tommorow", maxSuggestions: 4 }).suggestions).toContain(
      "tomorrow",
    );
    expect(suggestions.scores).toHaveLength(suggestions.suggestions.length);
    expect(suggestions.scores.every((score) => Number.isFinite(score) && score > 0)).toBe(true);
  });
});

function buildScaledMockFixture(wordCount: number): void {
  execFileSync(
    process.execPath,
    ["scripts/build-dictionary-asset.mjs", `--word-count=${wordCount}`],
    {
      cwd: packageRoot,
      stdio: "pipe",
    },
  );
}
