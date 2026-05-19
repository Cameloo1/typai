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
const productionBinaryPath = resolve(
  packageRoot,
  "assets/production/production-en-us.dictionary.bin",
);

describe("production dictionary transform pipeline", () => {
  it("produces deterministic fixture binary output across repeated runs", () => {
    const first = buildFixture();
    const second = buildFixture();

    expect(first.binarySha256).toBe(second.binarySha256);
    expect(first.binary.toString("hex")).toBe(second.binary.toString("hex"));
    expect(first.metadata.wordCount).toBe(5);
    expect(first.metadata.byteSize).toBe(first.binary.byteLength);
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
  });

  it("generates a valid blob from the approved fixture manifest", () => {
    const result = buildFixture();
    const blob = decodeTypaiDictionaryBlob(result.binary);

    expect(blob.language).toBe("en-US");
    expect(blob.wordCount).toBe(5);
    expect(blob.entries.map((entry) => entry.word)).toEqual([
      "alpha",
      "bravo",
      "delta",
      "gamma",
      "typai",
    ]);
  });

  it("excludes protected-looking and non-alpha source tokens", () => {
    const result = buildFixture();
    const blob = decodeTypaiDictionaryBlob(result.binary);
    const words = new Set(blob.entries.map((entry) => entry.word));

    for (const rejected of [
      "can't",
      "user@example.com",
      "https://example.com",
      "/etc/passwd",
      "snake_case_identifier",
      "camelCaseIdentifier",
      "CVE-2024-1234",
      "abc123",
    ]) {
      expect(words.has(rejected)).toBe(false);
    }

    expect(result.metadata.excludedCountByReason.duplicate_dictionary_word).toBe(2);
    expect(result.metadata.excludedCountByReason.protected_email).toBe(1);
    expect(result.metadata.excludedCountByReason.protected_url).toBe(1);
    expect(result.metadata.excludedCountByReason.protected_path).toBeGreaterThanOrEqual(2);
    expect(result.metadata.excludedCountByReason.invalid_non_alpha_token).toBe(1);
  });

  it("handles duplicates and frequencies deterministically", () => {
    const result = buildFixture();
    const blob = decodeTypaiDictionaryBlob(result.binary);
    const frequencies = new Map(blob.entries.map((entry) => [entry.word, entry.frequency]));

    expect(blob.entries.map((entry) => entry.word)).toEqual([...frequencies.keys()].sort());
    expect(frequencies.get("alpha")).toBe(15);
    expect(frequencies.get("bravo")).toBe(7);
    expect(frequencies.get("delta")).toBe(3);
    expect(frequencies.get("gamma")).toBe(0);
    expect(frequencies.get("typai")).toBe(21);
  });

  it("loads fixture output through the existing host-provided dictionary loader", async () => {
    const result = buildFixture();
    const core = await createTypaiCore({
      dictionary: {
        bytes: new Uint8Array(result.binary),
      },
    });

    expect(core.getLoadedDictionaryWordCount()).toBe(5);
    expect(core.checkCompletedToken({ token: "gamma" })).toEqual({
      action: "do_nothing",
      reasonCodes: ["DYNAMIC_DICTIONARY_MATCH", "VALID_WORD_BLOCK"],
    });
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
      wordCount: number;
      byteSize: number;
      excludedCountByReason: Record<string, number>;
    },
  };
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
