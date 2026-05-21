import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createTypaiCore } from "./createTypaiCore";
import { decodeTypaiDictionaryBlob } from "./dictionaryBlob";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const transformScript = "scripts/build-production-dictionary.mjs";
const fixtureManifestPath = resolve(
  packageRoot,
  "assets/fixtures/production-transform/MANIFEST.fixture.json",
);
const expectedFixtureMetaPath = resolve(
  packageRoot,
  "assets/fixtures/production-transform/expected.fixture.meta.json",
);
const productionManifestPath = resolve(packageRoot, "assets/production/MANIFEST.json");
const productionBinaryPath = resolve(
  packageRoot,
  "assets/production/production-en-us.dictionary.bin",
);
const generatedProductionBinaryPath = resolve(
  packageRoot,
  "assets/generated/production/production-en-us.dictionary.bin",
);
const scaledMockDictionaryPath = resolve(
  packageRoot,
  "assets/generated/scaled-mock-en-us.dictionary.bin",
);
const scaledMockMetaPath = resolve(
  packageRoot,
  "assets/generated/scaled-mock-en-us.dictionary.meta.json",
);

type MutableManifest = {
  dictionary: {
    licenseFile: string;
    sourceFiles: Array<{
      path?: string;
      url?: string;
      sha256: string;
    }>;
  };
  frequency: {
    sourceFiles: Array<{
      path?: string;
      sha256: string;
    }>;
  };
  output: {
    packageInclusion: string;
    assetPath?: string;
  };
  review: {
    status: string;
    reviewedAt: string;
    reviewer: string;
    reviewNotes: string;
  };
};

describe("production dictionary transform pipeline", () => {
  it("produces deterministic fixture binary output across repeated runs", () => {
    const first = buildFixture();
    const second = buildFixture();

    expect(first.binarySha256).toBe(second.binarySha256);
    expect(first.binary.toString("hex")).toBe(second.binary.toString("hex"));
    expect(first.metadata.wordCount).toBe(8);
    expect(first.metadata.byteSize).toBe(first.binary.byteLength);
    expect(first.metadata.sha256).toBe(first.binarySha256);
  });

  it("fails before processing when a pinned input hash is invalid", () => {
    const manifest = JSON.parse(readFileSync(fixtureManifestPath, "utf8"));
    manifest.dictionary.sourceFiles[0].sha256 = "0".repeat(64);

    const manifestPath = resolve(makeTempDir(), "MANIFEST.invalid-hash.json");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const failure = runTransformExpectFailure([
      "build-fixture",
      `--manifest=${manifestPath}`,
      `--out-dir=${makeTempDir()}`,
      "--generated-at=1970-01-01T00:00:00.000Z",
    ]);

    expect(failure).toContain("hash mismatch");
  });

  it("prevents production build while the production manifest is blocked", () => {
    const failure = runTransformExpectFailure(["build-production"]);

    expect(failure).toContain("review.status is blocked");
  });

  it("does not write a production asset while approval is blocked", () => {
    runTransformExpectFailure(["build-production"]);

    expect(existsSync(productionBinaryPath)).toBe(false);
    expect(existsSync(generatedProductionBinaryPath)).toBe(false);
  });

  it("keeps the blocked production manifest free of output claims", () => {
    const manifest = JSON.parse(readFileSync(productionManifestPath, "utf8")) as {
      review: { status: string };
      output: {
        wordCount: number | null;
        byteSize: number | null;
        sha256: string;
        packageInclusion: string;
        assetPath: string;
      };
    };

    expect(manifest.review.status).toBe("blocked");
    expect(manifest.output).toEqual({
      wordCount: null,
      byteSize: null,
      sha256: "",
      packageInclusion: "blocked",
      assetPath: "",
    });
    expect(existsSync(productionBinaryPath)).toBe(false);
    expect(existsSync(generatedProductionBinaryPath)).toBe(false);
  });

  it("generates a valid blob from the approved fixture manifest", () => {
    const result = buildFixture();
    const blob = decodeTypaiDictionaryBlob(result.binary);
    const expected = readExpectedFixtureMeta();

    expect(blob.language).toBe("en-US");
    expect(blob.wordCount).toBe(expected.wordCount);
    expect(blob.entries.map((entry) => entry.word)).toEqual(expected.words);
    expect(result.binarySha256).toBe(expected.outputSha256);
  });

  it("excludes protected-looking and non-alpha source tokens", () => {
    const result = buildFixture();
    const blob = decodeTypaiDictionaryBlob(result.binary);
    const words = new Set(blob.entries.map((entry) => entry.word));

    for (const rejected of [
      "can't",
      "trail.",
      "user@example.com",
      "https://example.com/word",
      "/etc/passwd",
      "snake_case_token",
      "camelCaseToken",
      "CVE-2026-0001",
      "café",
    ]) {
      expect(words.has(rejected)).toBe(false);
    }

    expect(result.metadata.excludedCountByReason.duplicate_dictionary_word).toBe(2);
    expect(result.metadata.excludedCountByReason.invalid_apostrophe).toBe(1);
    expect(result.metadata.excludedCountByReason.invalid_trailing_punctuation).toBe(1);
    expect(result.metadata.excludedCountByReason.invalid_non_ascii_token).toBe(1);
    expect(result.metadata.excludedCountByReason.protected_email).toBe(1);
    expect(result.metadata.excludedCountByReason.protected_url).toBe(1);
    expect(result.metadata.excludedCountByReason.protected_path).toBeGreaterThanOrEqual(2);
    expect(result.metadata.excludedCountByReason.protected_identifier).toBe(2);
    expect(result.metadata.excludedCountByReason.protected_numeric).toBe(1);
  });

  it("handles duplicates and frequencies deterministically", () => {
    const result = buildFixture();
    const blob = decodeTypaiDictionaryBlob(result.binary);
    const frequencies = new Map(blob.entries.map((entry) => [entry.word, entry.frequency]));
    const expected = readExpectedFixtureMeta();

    expect(blob.entries.map((entry) => entry.word)).toEqual([...frequencies.keys()].sort());
    for (const [word, frequency] of Object.entries(expected.frequencies)) {
      expect(frequencies.get(word)).toBe(frequency);
    }
    expect(result.metadata.excludedCountByReason.frequency_word_not_in_dictionary).toBe(1);
    expect(result.metadata.excludedCountByReason.invalid_frequency_row).toBe(1);
    expect(result.metadata.excludedCountByReason.invalid_frequency_count).toBe(1);
  });

  it("loads fixture output through the existing host-provided dictionary loader", async () => {
    const result = buildFixture();
    const core = await createTypaiCore({
      dictionary: {
        bytes: new Uint8Array(result.binary),
      },
    });

    expect(core.getLoadedDictionaryWordCount()).toBe(8);
    expect(core.checkCompletedToken({ token: "gamma" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
  });

  it("keeps the scaled mock fallback mock-only while stress-loading the loader", async () => {
    execFileSync(process.execPath, ["scripts/build-dictionary-asset.mjs", "--word-count=1200"], {
      cwd: packageRoot,
      stdio: "pipe",
    });

    const bytes = readFileSync(scaledMockDictionaryPath);
    const blob = decodeTypaiDictionaryBlob(bytes);
    const meta = JSON.parse(readFileSync(scaledMockMetaPath, "utf8")) as {
      assetKind: string;
      mockOnly: boolean;
      production: boolean;
      packageInclusionPolicy: string;
      generatedWordCount: number;
      note: string;
    };
    const core = await createTypaiCore({
      dictionary: {
        mode: "scaled-mock",
        bytes: new Uint8Array(bytes),
      },
    });
    const suggestions = core.suggestToken({ token: "mockaaa", maxSuggestions: 4 });

    expect(meta.assetKind).toBe("scaled-mock");
    expect(meta.mockOnly).toBe(true);
    expect(meta.production).toBe(false);
    expect(meta.packageInclusionPolicy).toBe("not bundled");
    expect(meta.note).toContain("Not a production dictionary");
    expect(meta.generatedWordCount).toBe(blob.wordCount);
    expect(blob.wordCount).toBeGreaterThanOrEqual(1200);
    expect(core.getLoadedDictionaryWordCount()).toBe(blob.wordCount);
    expect(core.getLoadedDictionaryByteSize()).toBe(bytes.byteLength);
    expect(core.getDeleteIndexEntryCount()).toBeGreaterThan(blob.wordCount);
    expect(suggestions.suggestions).toContain("mockaaaa");
    expect(suggestions.reasonCodes).toContain("DELETE_INDEX_SUGGESTIONS");
  });

  it("emits required fixture metadata fields", () => {
    const result = buildFixture();
    const expected = readExpectedFixtureMeta();

    expect(result.metadata).toMatchObject({
      schemaVersion: 1,
      assetSchemaVersion: 1,
      language: "en-US",
      production: false,
      fixture: true,
      dictionarySourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      frequencySourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      sha256: expected.outputSha256,
      outputSha256: expected.outputSha256,
      frequencyCoverage: expected.frequencyCoverage,
      packageInclusion: expected.packageInclusion,
    });
    expect(result.metadata.excludedCountsByReason).toEqual(expected.excludedCountsByReason);
    expect(result.metadata.transform).toMatchObject({
      version: "prompt-131-production-transform-v1",
      networkFetchAllowed: false,
      networkFetches: false,
    });
  });

  it("validates the blocked production state only when no generated production output is referenced", () => {
    const output = runTransformExpectSuccess(["validate-production"]);

    expect(output).toContain("Production dictionary build is blocked by manifest review.status");
    expect(output).toContain("Validated fixture transform pipeline");
  });

  it("fails blocked production validation when a generated output asset is referenced", () => {
    const manifest = JSON.parse(readFileSync(productionManifestPath, "utf8")) as MutableManifest;
    const outDir = makeTempDir();
    const blockedAssetPath = resolve(outDir, "blocked-production.dictionary.bin");
    writeFileSync(blockedAssetPath, "blocked asset placeholder");
    manifest.output.assetPath = blockedAssetPath;

    const manifestPath = resolve(outDir, "MANIFEST.blocked-output.json");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const failure = runTransformExpectFailure([
      "validate-production",
      `--manifest=${manifestPath}`,
    ]);

    expect(failure).toContain("cannot reference a generated asset path that exists");
  });

  it("fails approved production transform when source files are missing", () => {
    const manifest = createApprovedFixtureProductionManifest();
    manifest.dictionary.sourceFiles[0].path = resolve(makeTempDir(), "missing-dictionary.txt");
    const manifestPath = writeTempManifest(manifest, "MANIFEST.missing-source.json");

    const failure = runTransformExpectFailure([
      "build-production",
      `--manifest=${manifestPath}`,
      `--out-dir=${makeTempDir()}`,
    ]);

    expect(failure).toContain("does not exist");
  });

  it("fails approved production transform when a source hash mismatches", () => {
    const manifest = createApprovedFixtureProductionManifest();
    manifest.frequency.sourceFiles[0].sha256 = "0".repeat(64);
    const manifestPath = writeTempManifest(manifest, "MANIFEST.hash-mismatch.json");

    const failure = runTransformExpectFailure([
      "build-production",
      `--manifest=${manifestPath}`,
      `--out-dir=${makeTempDir()}`,
    ]);

    expect(failure).toContain("hash mismatch");
  });

  it("fails approved production transform when license files are missing", () => {
    const manifest = createApprovedFixtureProductionManifest();
    manifest.dictionary.licenseFile = "packages/core/assets/production/LICENSES/DOES_NOT_EXIST.md";
    const manifestPath = writeTempManifest(manifest, "MANIFEST.missing-license.json");

    const failure = runTransformExpectFailure([
      "build-production",
      `--manifest=${manifestPath}`,
      `--out-dir=${makeTempDir()}`,
    ]);

    expect(failure).toContain("existing dictionary.licenseFile");
  });

  it("does not fetch source files by default", () => {
    const manifest = createApprovedFixtureProductionManifest();
    delete manifest.dictionary.sourceFiles[0].path;
    manifest.dictionary.sourceFiles[0].url = "https://example.invalid/dictionary.fixture.txt";
    const manifestPath = writeTempManifest(manifest, "MANIFEST.no-network.json");

    const failure = runTransformExpectFailure([
      "build-production",
      `--manifest=${manifestPath}`,
      `--out-dir=${makeTempDir()}`,
    ]);

    expect(failure).toContain("Network fetches are not allowed by default");
  });
});

function buildFixture() {
  const outDir = makeTempDir();

  execFileSync(
    process.execPath,
    [
      transformScript,
      "build-fixture",
      `--manifest=${fixtureManifestPath}`,
      `--out-dir=${outDir}`,
      "--generated-at=1970-01-01T00:00:00.000Z",
    ],
    {
      cwd: packageRoot,
      stdio: "pipe",
    },
  );

  const binaryPath = resolve(outDir, "production-transform-fixture-en-us.dictionary.bin");
  const metadataPath = resolve(outDir, "production-transform-fixture-en-us.dictionary.meta.json");
  const binary = readFileSync(binaryPath);

  return {
    binary,
    binarySha256: sha256(binary),
    metadata: JSON.parse(readFileSync(metadataPath, "utf8")) as {
      schemaVersion: number;
      assetSchemaVersion: number;
      language: string;
      production: boolean;
      fixture: boolean;
      dictionarySourceHash: string;
      frequencySourceHash: string;
      manifestHash: string;
      wordCount: number;
      byteSize: number;
      sha256: string;
      outputSha256: string;
      excludedCountByReason: Record<string, number>;
      excludedCountsByReason: Record<string, number>;
      frequencyCoverage: Record<string, number>;
      packageInclusion: string;
      transform: {
        version: string;
        networkFetchAllowed: boolean;
        networkFetches: boolean;
      };
    },
  };
}

function runTransformExpectSuccess(args: string[]): string {
  return execFileSync(process.execPath, [transformScript, ...args], {
    cwd: packageRoot,
    stdio: "pipe",
  }).toString("utf8");
}

function runTransformExpectFailure(args: string[]): string {
  try {
    execFileSync(process.execPath, [transformScript, ...args], {
      cwd: packageRoot,
      stdio: "pipe",
    });
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? error.stderr : undefined;

    if (Buffer.isBuffer(stderr)) {
      return stderr.toString("utf8");
    }

    return String(error);
  }

  throw new Error(`Expected transform command to fail: ${args.join(" ")}`);
}

function makeTempDir(): string {
  return mkdtempSync(resolve(tmpdir(), "typai-production-transform-"));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readExpectedFixtureMeta(): {
  wordCount: number;
  outputSha256: string;
  words: string[];
  frequencies: Record<string, number>;
  excludedCountsByReason: Record<string, number>;
  frequencyCoverage: Record<string, number>;
  packageInclusion: string;
} {
  return JSON.parse(readFileSync(expectedFixtureMetaPath, "utf8"));
}

function createApprovedFixtureProductionManifest(): MutableManifest {
  const manifest = JSON.parse(readFileSync(fixtureManifestPath, "utf8")) as MutableManifest;

  manifest.review = {
    status: "approved",
    reviewedAt: "2026-05-20",
    reviewer: "manual-release-operator",
    reviewNotes: "Test-only approved manifest using repo-local fixtures.",
  };
  manifest.output.packageInclusion = "host-provided-only";

  return manifest;
}

function writeTempManifest(manifest: unknown, fileName: string): string {
  const manifestPath = resolve(makeTempDir(), fileName);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return manifestPath;
}
