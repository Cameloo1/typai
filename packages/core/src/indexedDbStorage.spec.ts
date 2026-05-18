import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createTypaiCore } from "./createTypaiCore";
import { createIndexedDbStorage } from "./storage";

describe("createIndexedDbStorage", () => {
  it("supports async set, get, list, delete, and namespace clear", async () => {
    const storage = createIndexedDbStorage({ dbName: uniqueDbName() });

    await storage.set("settings", "one", { enabled: true });
    await storage.set("settings", "two", { enabled: false });
    await storage.set("other", "one", { untouched: true });

    expect(await storage.get("settings", "one")).toEqual({ enabled: true });
    expect(await sortedList(storage, "settings")).toEqual([
      { key: "one", value: { enabled: true } },
      { key: "two", value: { enabled: false } },
    ]);

    await storage.delete("settings", "one");

    expect(await storage.get("settings", "one")).toBeNull();

    await storage.clear("settings");

    expect(await storage.list("settings")).toEqual([]);
    expect(await storage.get("other", "one")).toEqual({ untouched: true });
  });

  it("persists personal dictionary entries across core initialization", async () => {
    const dbName = uniqueDbName();
    const firstCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    await firstCore.addToPersonalDictionary("zzzzword");

    const secondCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    expect(secondCore.isInPersonalDictionary("zzzzword")).toBe(true);
    expect(secondCore.checkCompletedToken({ token: "zzzzword" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
    });
  });

  it("persists always-correct rules across core initialization", async () => {
    const dbName = uniqueDbName();
    const firstCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    await firstCore.setAlwaysCorrect("omw", "on my way");

    const secondCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    expect(secondCore.getCorrectionRule("omw")).toMatchObject({
      original: "omw",
      replacement: "on my way",
      status: "always",
    });
    expect(secondCore.checkCompletedToken({ token: "omw" })).toEqual({
      action: "auto_correct",
      original: "omw",
      replacement: "on my way",
      confidence: 1,
      mark: "blue_applied_correction",
      reasonCodes: ["ALWAYS_CORRECT_RULE"],
    });
  });

  it("persists never-correct rules across core initialization", async () => {
    const dbName = uniqueDbName();
    const firstCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    await firstCore.setNeverCorrect("teh", "the");

    const secondCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });
    const decision = secondCore.checkCompletedToken({ token: "teh" });

    expect(secondCore.getCorrectionRule("teh", "the")).toMatchObject({
      original: "teh",
      replacement: "the",
      status: "never",
    });
    expect(decision.action).toBe("mark_unresolved");

    if (decision.action !== "mark_unresolved") {
      return;
    }

    expect(decision.suggestions[0]).toBe("the");
    expect(decision.reasonCodes).toContain("NEVER_CORRECT_RULE");
  });

  it("exports and imports persisted memory across reinitialization", async () => {
    const sourceDbName = uniqueDbName();
    const targetDbName = uniqueDbName();
    const firstCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName: sourceDbName }),
    });

    await firstCore.addToPersonalDictionary("zzzzword");
    await firstCore.setAlwaysCorrect("omw", "on my way");
    await firstCore.setNeverCorrect("teh", "the");

    const exported = await firstCore.exportTypaiMemory();
    const targetCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName: targetDbName }),
    });

    await targetCore.importTypaiMemory(exported);

    const reloadedCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName: targetDbName }),
    });

    expect(reloadedCore.isInPersonalDictionary("zzzzword")).toBe(true);
    expect(reloadedCore.getCorrectionRule("omw")).toMatchObject({
      status: "always",
      replacement: "on my way",
    });
    expect(reloadedCore.getCorrectionRule("teh", "the")).toMatchObject({
      status: "never",
    });
  });

  it("reset clears persisted dictionary and rules", async () => {
    const dbName = uniqueDbName();
    const firstCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    await firstCore.addToPersonalDictionary("zzzzword");
    await firstCore.setAlwaysCorrect("omw", "on my way");
    await firstCore.resetTypaiMemory();

    const secondCore = await createTypaiCore({
      storage: createIndexedDbStorage({ dbName }),
    });

    expect(secondCore.isInPersonalDictionary("zzzzword")).toBe(false);
    expect(secondCore.getCorrectionRule("omw")).toBeNull();
  });

  it("clears only the requested namespace", async () => {
    const storage = createIndexedDbStorage({ dbName: uniqueDbName() });

    await storage.set("personalDictionary", "nmap", { word: "nmap" });
    await storage.set("correctionRules", "always:omw:on%20my%20way", {
      original: "omw",
      replacement: "on my way",
      status: "always",
    });

    await storage.clear("personalDictionary");

    expect(await storage.list("personalDictionary")).toEqual([]);
    expect(await storage.list("correctionRules")).toHaveLength(1);
  });

  it("does not require a browser key-value fallback", async () => {
    const forbiddenFallbackName = ["local", "Storage"].join("");

    expect(forbiddenFallbackName in globalThis).toBe(false);

    const storage = createIndexedDbStorage({ dbName: uniqueDbName() });

    await storage.set("settings", "one", { enabled: true });

    expect(await storage.get("settings", "one")).toEqual({ enabled: true });
  });
});

async function sortedList(
  storage: ReturnType<typeof createIndexedDbStorage>,
  namespace: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const values = await storage.list<unknown>(namespace);

  return values.sort((left, right) => left.key.localeCompare(right.key));
}

function uniqueDbName(): string {
  return `typai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
