import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createTypaiCore } from "./createTypaiCore";
import { decodeTypaiDictionaryBlob, encodeTypaiDictionaryBlob } from "./dictionaryBlob";
import { measureSyncLatency } from "./latency";
import { createMemoryStorage } from "./storage";
import type { CorrectionDecision, TypaiMemoryExport, TypaiStorage } from "./types";

const mockDictionaryUrl = new URL("../assets/mock-en-us.dictionary.bin", import.meta.url);

describe("createTypaiCore", () => {
  it("resolves", async () => {
    const core = await createTypaiCore();

    expect(core).toHaveProperty("checkCompletedToken");
    expect(core).toHaveProperty("suggestToken");
    expect(core).toHaveProperty("getDeleteIndexEntryCount");
  });

  it.each([
    ["teh", "the"],
    ["adn", "and"],
    ["recieve", "receive"],
    ["becuase", "because"],
    ["thier", "their"],
  ])("auto-corrects common typo %s", async (token, replacement) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "auto_correct",
      original: token,
      replacement,
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED"],
    });
  });

  it.each([
    ["adress", "address"],
    ["speling", "spelling"],
    ["corection", "correction"],
    ["seperate", "separate"],
    ["definitly", "definitely"],
    ["accomodate", "accommodate"],
    ["occured", "occurred"],
    ["untill", "until"],
    ["tommorow", "tomorrow"],
    ["goverment", "government"],
    ["enviroment", "environment"],
    ["arguement", "argument"],
    ["calender", "calendar"],
    ["embarass", "embarrass"],
    ["publically", "publicly"],
    ["neccessary", "necessary"],
  ])("auto-corrects expanded common typo %s", async (token, replacement) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "auto_correct",
      original: token,
      replacement,
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH", "COMMON_TYPO_TABLE_EXPANDED", "AUTOCORRECT_GATE_PASSED"],
    });
  });

  it.each([
    ["teh", "the", ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED"]],
    ["Teh", "The", ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED", "CASE_PRESERVED"]],
    ["TEH", "THE", ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED", "CASE_PRESERVED"]],
    ["teh,", "the,", ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED", "PUNCTUATION_PRESERVED"]],
    [
      "Teh,",
      "The,",
      ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED", "CASE_PRESERVED", "PUNCTUATION_PRESERVED"],
    ],
  ])("preserves casing and punctuation for %s", async (token, replacement, reasonCodes) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "auto_correct",
      original: token,
      replacement,
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes,
    });
  });

  it.each(["the", "form", "lead"])("does nothing for known valid word %s", async (token) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "do_nothing",
      reasonCodes: ["KNOWN_VALID_WORD", "VALID_WORD_BLOCK"],
    });
  });

  it("treats simple valid contractions as words", async () => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token: "it's" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["KNOWN_VALID_WORD", "VALID_WORD_BLOCK"],
    });
  });

  it("marks unknown lowercase words unresolved", async () => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token: "zzzzword" })).toEqual({
      action: "mark_unresolved",
      original: "zzzzword",
      suggestions: [],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD", "NO_SUGGESTIONS", "AUTOCORRECT_GATE_BLOCKED"],
    });
  });

  it.each([
    ["reciept", "receipt"],
    ["addres", "address"],
  ])("marks %s unresolved with C++ suggestion %s", async (token, suggestion) => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action !== "mark_unresolved") {
      return;
    }

    expect(decision.original).toBe(token);
    expect(decision.mark).toBe("red_spelling_issue");
    expect(decision.suggestions).toContain(suggestion);
    expect(decision.reasonCodes).toContain("UNKNOWN_NON_WORD");
    expect(decision.reasonCodes).toContain("EDIT_DISTANCE_SUGGESTIONS");
    expect(decision.reasonCodes).toContain("AUTOCORRECT_GATE_BLOCKED");
  });

  it.each([
    ["dont", "don't"],
    ["it;s", "it's"],
  ])("suggests contraction repair for %s without autocorrecting", async (token, suggestion) => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token });
    const result = core.suggestToken({ token });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action === "mark_unresolved") {
      expect(decision.suggestions).toContain(suggestion);
      expect(decision.reasonCodes).toContain("AUTOCORRECT_GATE_BLOCKED");
    }

    expect(result.suggestions).toContain(suggestion);
    expect(result.reasonCodes).toContain("AUTOCORRECT_GATE_BLOCKED");
  });

  it("keeps plural ambiguity suggestion-only", async () => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token: "adresss" });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action === "mark_unresolved") {
      expect(decision.suggestions).toEqual(["address", "addresses"]);
      expect(decision.reasonCodes).toContain("AUTOCORRECT_GATE_BLOCKED");
    }
  });

  it("exposes deterministic direct C++ suggestions through Wasm", async () => {
    const core = await createTypaiCore();
    const result = core.suggestToken({ token: "reciept", maxSuggestions: 2 });

    expect(result.suggestions[0]).toBe("receipt");
    expect(result.suggestions).toContain("recipe");
    expect(result.scores).toHaveLength(result.suggestions.length);
    expect(result.scores.every((score) => Number.isFinite(score) && score > 0)).toBe(true);
    expect(result.reasonCodes).toContain("EDIT_DISTANCE_SUGGESTIONS");
    expect(result.reasonCodes).toContain("DELETE_INDEX_SUGGESTIONS");
  });

  it("uses delete-index candidates from a host-provided dictionary for broader misspellings", async () => {
    const bytes = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [
        { word: "separate", frequency: 900, flags: 0 },
        { word: "tomorrow", frequency: 800, flags: 0 },
      ],
    });
    const core = await createTypaiCore({
      dictionary: {
        bytes,
      },
    });

    expect(core.getDeleteIndexEntryCount()).toBeGreaterThan(core.getLoadedDictionaryWordCount());

    for (const [token, expected] of [
      ["separat", "separate"],
      ["tomorow", "tomorrow"],
    ] as const) {
      const result = core.suggestToken({ token, maxSuggestions: 4 });
      const decision = core.checkCompletedToken({ token });

      expect(result.suggestions).toContain(expected);
      expect(result.reasonCodes).toContain("DELETE_INDEX_SUGGESTIONS");
      expect(decision.action).toBe("mark_unresolved");

      if (decision.action === "mark_unresolved") {
        expect(decision.suggestions).toContain(expected);
        expect(decision.mark).toBe("red_spelling_issue");
        expect(decision.reasonCodes).toContain("DELETE_INDEX_SUGGESTIONS");
      }
    }
  });

  it("loads the mock dictionary blob through Wasm during initialization", async () => {
    const bytes = readFileSync(mockDictionaryUrl);
    const blob = decodeTypaiDictionaryBlob(bytes);
    const core = await createTypaiCore({
      dictionary: {
        bytes,
      },
    });

    expect(core.getLoadedDictionaryWordCount()).toBe(blob.wordCount);

    expect(core.checkCompletedToken({ token: "because" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
    expect(core.checkCompletedToken({ token: "nmap" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PROTECTED_LOOKING_TOKEN", "PROTECTED_TOKEN_BLOCK"],
    });
  });

  it("loads dictionary bytes from an async initialization callback", async () => {
    const bytes = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [{ word: "alphaword", frequency: 123, flags: 0 }],
    });
    const core = await createTypaiCore({
      dictionary: {
        load: async () => bytes,
      },
    });

    expect(core.getLoadedDictionaryWordCount()).toBe(1);
    expect(core.checkCompletedToken({ token: "alphaword" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
  });

  it("clears the loaded dictionary through the public core API", async () => {
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryUrl),
      },
    });

    expect(core.getLoadedDictionaryWordCount()).toBeGreaterThan(0);

    core.clearLoadedDictionary();

    expect(core.getLoadedDictionaryWordCount()).toBe(0);
    expect(core.checkCompletedToken({ token: "teh" }).action).toBe("auto_correct");
  });

  it("keeps common typo correction working after dictionary load", async () => {
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryUrl),
      },
    });

    expect(core.checkCompletedToken({ token: "teh" })).toEqual({
      action: "auto_correct",
      original: "teh",
      replacement: "the",
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED"],
    });
    expect(core.checkCompletedToken({ token: "form" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
  });

  it.each([
    ["reciept", "receipt"],
    ["adress", "address"],
    ["corection", "correction"],
    ["speling", "spelling"],
  ])("ranks loaded mock dictionary suggestion %s -> %s first", async (token, expected) => {
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryUrl),
      },
    });
    const result = core.suggestToken({ token, maxSuggestions: 4 });

    expect(result.suggestions[0]).toBe(expected);
    expect(result.scores[0]).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain("EDIT_DISTANCE_SUGGESTIONS");
    expect(result.reasonCodes).toContain("DELETE_INDEX_SUGGESTIONS");
  });

  it("uses frequency as the same-distance suggestion tie-breaker", async () => {
    const bytes = encodeTypaiDictionaryBlob({
      language: "en-US",
      entries: [
        { word: "abb", frequency: 10, flags: 0 },
        { word: "abc", frequency: 100, flags: 0 },
      ],
    });
    const core = await createTypaiCore({
      dictionary: {
        bytes,
      },
    });
    const result = core.suggestToken({ token: "aba", maxSuggestions: 2 });

    expect(result.suggestions).toEqual(["abc", "abb"]);
    expect(result.scores[0]).toBeGreaterThan(result.scores[1]);
  });

  it("returns deterministic duplicate-free delete-index suggestions", async () => {
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryUrl),
      },
    });
    const first = core.suggestToken({ token: "adress", maxSuggestions: 4 });
    const second = core.suggestToken({ token: "adress", maxSuggestions: 4 });

    expect(first).toEqual(second);
    expect(first.suggestions.filter((suggestion) => suggestion === "address")).toHaveLength(1);
    expect(new Set(first.suggestions).size).toBe(first.suggestions.length);
    expect(first.reasonCodes).toContain("DELETE_INDEX_SUGGESTIONS");
  });

  it.each([
    ["reciept", "receipt"],
    ["addres", "address"],
  ])("keeps loaded dictionary edit-distance candidate %s suggestions-only", async (token, expected) => {
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryUrl),
      },
    });
    const decision = core.checkCompletedToken({ token });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action !== "mark_unresolved") {
      return;
    }

    expect(decision.original).toBe(token);
    expect(decision.suggestions[0]).toBe(expected);
    expect(decision.mark).toBe("red_spelling_issue");
  });

  it("throws a clear error for invalid dictionary bytes", async () => {
    await expect(
      createTypaiCore({
        dictionary: {
          bytes: new Uint8Array([0, 1, 2, 3]),
        },
      }),
    ).rejects.toThrow(/Typai dictionary load failed/);
  });

  it("keeps edit-distance suggestions out of autocorrection", async () => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token: "reciept" });

    expect(decision.action).toBe("mark_unresolved");
  });

  it("exposes delete-index stats without changing autocorrect gates", async () => {
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryUrl),
      },
    });

    expect(core.getDeleteIndexEntryCount()).toBeGreaterThan(core.getLoadedDictionaryWordCount());
    expect(core.getDeleteIndexMemoryEstimateBytes()).toBeGreaterThan(0);
    expect(core.checkCompletedToken({ token: "reciept" }).action).toBe("mark_unresolved");
    expect(core.checkCompletedToken({ token: "teh" }).action).toBe("auto_correct");
    expect(core.checkCompletedToken({ token: "form" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
    expect(core.checkCompletedToken({ token: "user@example.com" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PROTECTED_LOOKING_TOKEN", "PROTECTED_TOKEN_BLOCK"],
    });
  });

  it("does nothing for protected-looking tokens", async () => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token: "user@example.com" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PROTECTED_LOOKING_TOKEN", "PROTECTED_TOKEN_BLOCK"],
    });
  });

  it("does nothing for empty tokens before calling Wasm", async () => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token: "" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["INVALID_INPUT"],
    });
  });

  it("uses en-US by default and accepts an explicit en-US language", async () => {
    const core = await createTypaiCore({ language: "en-US" });

    expect(core.checkCompletedToken({ token: "adn", language: "en-US" })).toEqual({
      action: "auto_correct",
      original: "adn",
      replacement: "and",
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED"],
    });
  });

  it("returns synchronously after initialization", async () => {
    const core = await createTypaiCore();
    const decision: CorrectionDecision = core.checkCompletedToken({ token: "teh" });
    const suggestions = core.suggestToken({ token: "reciept" });

    expect("then" in decision).toBe(false);
    expect("then" in suggestions).toBe(false);
    expect(decision.action).toBe("auto_correct");
    expect(suggestions.suggestions).toContain("receipt");
  });

  it("measures finite direct checkCompletedToken latency without a strict threshold", async () => {
    const core = await createTypaiCore();
    const summary = measureSyncLatency(
      () => {
        core.checkCompletedToken({ token: "teh" });
      },
      {
        iterations: 10,
        warmupIterations: 2,
      },
    );

    expect(summary.count).toBe(10);
    expect(Number.isFinite(summary.mean)).toBe(true);
    expect(Number.isFinite(summary.p50)).toBe(true);
    expect(Number.isFinite(summary.p95)).toBe(true);
    expect(Number.isFinite(summary.p99)).toBe(true);
  });

  it("loads with explicit in-memory storage", async () => {
    const storage = createMemoryStorage();
    const core = await createTypaiCore({ storage });

    expect(core.checkCompletedToken({ token: "form" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["KNOWN_VALID_WORD", "VALID_WORD_BLOCK"],
    });
  });

  it("loads personal dictionary entries during initialization", async () => {
    const storage = createMemoryStorage();
    await storage.set("personalDictionary", "zzzzword", {
      word: "zzzzword",
      createdAt: 1,
    });

    const core = await createTypaiCore({ storage });

    expect(core.checkCompletedToken({ token: "zzzzword" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    });
  });

  it.each([
    "nmap",
    "zzzzword",
  ])("personal dictionary short-circuits %s before Wasm", async (word) => {
    const storage = createMemoryStorage();
    const core = await createTypaiCore({ storage });

    await core.addToPersonalDictionary(word);

    expect(core.isInPersonalDictionary(word)).toBe(true);
    expect(core.checkCompletedToken({ token: word })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    });
  });

  it("removes personal dictionary entries from memory and storage", async () => {
    const storage = createMemoryStorage();
    const core = await createTypaiCore({ storage });

    await core.addToPersonalDictionary("zzzzword");
    await core.removeFromPersonalDictionary("zzzzword");

    expect(core.isInPersonalDictionary("zzzzword")).toBe(false);
    expect(await storage.get("personalDictionary", "zzzzword")).toBeNull();
    expect(core.checkCompletedToken({ token: "zzzzword" }).action).toBe("mark_unresolved");
  });

  it("always-correct rules short-circuit before Wasm", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.setAlwaysCorrect("teh", "the");

    expect(core.checkCompletedToken({ token: "teh" })).toEqual({
      action: "auto_correct",
      original: "teh",
      replacement: "the",
      confidence: 1,
      mark: "blue_applied_correction",
      reasonCodes: ["ALWAYS_CORRECT_RULE", "AUTOCORRECT_GATE_PASSED"],
    });
  });

  it("always-correct rules can correct user-defined words unknown to C++", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.setAlwaysCorrect("omw", "on my way");

    expect(core.checkCompletedToken({ token: "omw" })).toEqual({
      action: "auto_correct",
      original: "omw",
      replacement: "on my way",
      confidence: 1,
      mark: "blue_applied_correction",
      reasonCodes: ["ALWAYS_CORRECT_RULE", "AUTOCORRECT_GATE_PASSED"],
    });
  });

  it("never-correct rules suppress Wasm autocorrect into unresolved", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.setNeverCorrect("teh", "the");
    const decision = core.checkCompletedToken({ token: "teh" });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action !== "mark_unresolved") {
      return;
    }

    expect(decision.original).toBe("teh");
    expect(decision.suggestions[0]).toBe("the");
    expect(decision.mark).toBe("red_spelling_issue");
    expect(decision.reasonCodes).toContain("COMMON_TYPO_MATCH");
    expect(decision.reasonCodes).toContain("NEVER_CORRECT_RULE");
  });

  it("never-correct rules suppress expanded common typo autocorrect", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.setNeverCorrect("adress", "address");
    const decision = core.checkCompletedToken({ token: "adress" });

    expect(decision.action).toBe("mark_unresolved");

    if (decision.action === "mark_unresolved") {
      expect(decision.suggestions[0]).toBe("address");
      expect(decision.reasonCodes).toContain("COMMON_TYPO_TABLE_EXPANDED");
      expect(decision.reasonCodes).toContain("NEVER_CORRECT_RULE");
      expect(decision.reasonCodes).toContain("AUTOCORRECT_GATE_BLOCKED");
    }
  });

  it("personal dictionary blocks expanded common typo autocorrect", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.addToPersonalDictionary("adress");

    expect(core.checkCompletedToken({ token: "adress" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    });
  });

  it("correction rule lookup and clear are synchronous after async writes", async () => {
    const storage = createMemoryStorage();
    const core = await createTypaiCore({ storage });

    await core.setAlwaysCorrect("omw", "on my way");
    await core.setNeverCorrect("teh", "the");

    expect(core.getCorrectionRule("omw")).toMatchObject({
      original: "omw",
      replacement: "on my way",
      status: "always",
    });
    expect(core.getCorrectionRule("teh", "the")).toMatchObject({
      original: "teh",
      replacement: "the",
      status: "never",
    });

    await core.clearCorrectionRule("teh", "the");

    expect(core.getCorrectionRule("teh", "the")).toBeNull();
    expect(core.checkCompletedToken({ token: "teh" }).action).toBe("auto_correct");
  });

  it("writes user operations through the storage adapter", async () => {
    const storage = createRecordingStorage();
    const core = await createTypaiCore({ storage });

    await core.addToPersonalDictionary("zzzzword");
    await core.setAlwaysCorrect("omw", "on my way");
    await core.setNeverCorrect("teh", "the");
    await core.clearCorrectionRule("teh", "the");

    expect(storage.events).toEqual(
      expect.arrayContaining([
        "set:personalDictionary:zzzzword",
        "set:correctionRules:always:omw:on%20my%20way",
        "set:correctionRules:never:teh:the",
        "delete:correctionRules:never:teh:the",
      ]),
    );
  });

  it("keeps checkCompletedToken synchronous after storage initialization", async () => {
    const storage = createMemoryStorage();
    const core = await createTypaiCore({ storage });

    await core.addToPersonalDictionary("zzzzword");

    const decision = core.checkCompletedToken({ token: "zzzzword" });

    expect("then" in decision).toBe(false);
    expect(decision).toEqual({
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    });
  });

  it("exports personal dictionary and correction rules without document text", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.addToPersonalDictionary("Nmap");
    await core.setAlwaysCorrect("omw", "on my way");
    await core.setNeverCorrect("teh", "the");

    const exported = await core.exportTypaiMemory();

    expect(exported.version).toBe(1);
    expect(Date.parse(exported.exportedAt)).not.toBeNaN();
    expect(exported.personalDictionary).toEqual([
      expect.objectContaining({
        word: "nmap",
        createdAt: expect.any(Number),
      }),
    ]);
    expect(exported.correctionRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          original: "omw",
          replacement: "on my way",
          status: "always",
        }),
        expect.objectContaining({
          original: "teh",
          replacement: "the",
          status: "never",
        }),
      ]),
    );
    expect(JSON.stringify(exported)).not.toContain("paragraph");
    expect(JSON.stringify(exported)).not.toContain("documentText");
  });

  it("imports memory into a fresh core and restores dictionary and rules", async () => {
    const firstCore = await createTypaiCore({ storage: createMemoryStorage() });

    await firstCore.addToPersonalDictionary("zzzzword");
    await firstCore.setAlwaysCorrect("omw", "on my way");
    await firstCore.setNeverCorrect("teh", "the");

    const exported = await firstCore.exportTypaiMemory();
    const secondCore = await createTypaiCore({ storage: createMemoryStorage() });

    await secondCore.importTypaiMemory(exported);

    expect(secondCore.checkCompletedToken({ token: "zzzzword" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    });
    expect(secondCore.checkCompletedToken({ token: "omw" })).toEqual({
      action: "auto_correct",
      original: "omw",
      replacement: "on my way",
      confidence: 1,
      mark: "blue_applied_correction",
      reasonCodes: ["ALWAYS_CORRECT_RULE", "AUTOCORRECT_GATE_PASSED"],
    });

    const neverDecision = secondCore.checkCompletedToken({ token: "teh" });

    expect(neverDecision.action).toBe("mark_unresolved");
    expect(secondCore.getCorrectionRule("teh", "the")).toMatchObject({
      status: "never",
    });
  });

  it("replaces memory by default and merges when requested", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });
    const exported: TypaiMemoryExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      personalDictionary: [{ word: "beta", createdAt: 1 }],
      correctionRules: [],
    };

    await core.addToPersonalDictionary("alpha");
    await core.importTypaiMemory(exported);

    expect(core.isInPersonalDictionary("alpha")).toBe(false);
    expect(core.isInPersonalDictionary("beta")).toBe(true);

    await core.importTypaiMemory(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        personalDictionary: [{ word: "gamma", createdAt: 2 }],
        correctionRules: [],
      },
      { merge: true },
    );

    expect(core.isInPersonalDictionary("beta")).toBe(true);
    expect(core.isInPersonalDictionary("gamma")).toBe(true);
  });

  it("resets selected memory namespaces", async () => {
    const storage = createMemoryStorage();
    const core = await createTypaiCore({ storage });

    await core.addToPersonalDictionary("zzzzword");
    await core.setAlwaysCorrect("omw", "on my way");

    await core.resetTypaiMemory({ personalDictionary: true, correctionRules: false });

    expect(core.isInPersonalDictionary("zzzzword")).toBe(false);
    expect(core.getCorrectionRule("omw")).toMatchObject({
      status: "always",
    });
    expect(await storage.list("personalDictionary")).toEqual([]);
    expect(await storage.list("correctionRules")).toHaveLength(1);

    await core.resetTypaiMemory();

    expect(core.getCorrectionRule("omw")).toBeNull();
    expect(await storage.list("correctionRules")).toEqual([]);
  });

  it("rejects malformed memory imports safely", async () => {
    const core = await createTypaiCore({ storage: createMemoryStorage() });

    await core.addToPersonalDictionary("zzzzword");
    await expect(
      core.importTypaiMemory({
        version: 1,
        exportedAt: new Date().toISOString(),
        personalDictionary: [{ word: "" }],
        correctionRules: [],
      }),
    ).rejects.toThrow(/personalDictionary/);

    expect(core.isInPersonalDictionary("zzzzword")).toBe(true);
  });
});

describe("createMemoryStorage", () => {
  it("supports async get, set, list, delete, and clear", async () => {
    const storage = createMemoryStorage();

    await storage.set("settings", "one", { enabled: true });
    await storage.set("settings", "two", { enabled: false });

    expect(await storage.get("settings", "one")).toEqual({ enabled: true });
    expect(await storage.list("settings")).toEqual([
      { key: "one", value: { enabled: true } },
      { key: "two", value: { enabled: false } },
    ]);

    await storage.delete("settings", "one");

    expect(await storage.get("settings", "one")).toBeNull();

    await storage.clear("settings");

    expect(await storage.list("settings")).toEqual([]);
  });
});

type RecordingStorage = TypaiStorage & {
  events: string[];
};

function createRecordingStorage(): RecordingStorage {
  const storage = createMemoryStorage();
  const events: string[] = [];

  return {
    events,
    get: storage.get,
    list: storage.list,
    clear(namespace) {
      events.push(`clear:${namespace}`);

      return storage.clear(namespace);
    },
    set(namespace, key, value) {
      events.push(`set:${namespace}:${key}`);

      return storage.set(namespace, key, value);
    },
    delete(namespace, key) {
      events.push(`delete:${namespace}:${key}`);

      return storage.delete(namespace, key);
    },
  };
}
