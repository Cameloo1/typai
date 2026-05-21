import { describe, expect, it } from "vitest";

import {
  classifyThreshold,
  createMachineReadableLine,
  parseMachineReadableLine,
} from "../../../scripts/benchmark-report-utils.mjs";
import {
  createPackagePolicyReport,
  defaultPackageSizeThresholds,
} from "../../../scripts/package-size-report-utils.mjs";

describe("performance and package gate utilities", () => {
  it("parses machine-readable benchmark output lines", () => {
    const payload = {
      production: { status: "blocked" },
      scenarios: [{ name: "host-provided", summary: { p95: 0.1 } }],
    };
    const line = createMachineReadableLine("language-asset-benchmark-json", payload);

    expect(parseMachineReadableLine("language-asset-benchmark-json", line)).toEqual(payload);
  });

  it("classifies threshold status deterministically", () => {
    const thresholds = { warn: 20, fail: 100 };

    expect(classifyThreshold(10, thresholds)).toBe("pass");
    expect(classifyThreshold(21, thresholds)).toBe("warn");
    expect(classifyThreshold(101, thresholds)).toBe("fail");
    expect(classifyThreshold(Number.NaN, thresholds)).toBe("fail");
  });

  it("fails when a blocked production asset appears in a tarball report", () => {
    const report = createPackagePolicyReport({
      manifest: blockedManifest(),
      packageReports: [
        packageReport({
          name: "@typai/core",
          files: [
            file("dist/index.js", 10),
            file("assets/production/production-en-us.dictionary.bin", 1024),
          ],
          productionBinaryFiles: ["assets/production/production-en-us.dictionary.bin"],
          productionBinaryBytes: 1024,
        }),
      ],
    });

    expect(report.findings.join("\n")).toContain("blocked production asset file");
  });

  it("fails approved bundled assets without package-visible attribution and license files", () => {
    const report = createPackagePolicyReport({
      manifest: approvedBundledManifest(),
      packageReports: [
        packageReport({
          name: "@typai/core",
          files: [
            file("dist/index.js", 10),
            file("assets/production/MANIFEST.json", 200),
            file("assets/production/production-en-us.dictionary.bin", 1024),
          ],
          productionBinaryFiles: ["assets/production/production-en-us.dictionary.bin"],
          productionBinaryBytes: 1024,
        }),
      ],
    });

    expect(report.findings.join("\n")).toContain("assets/production/ATTRIBUTION.md");
    expect(report.findings.join("\n")).toContain("assets/production/LICENSES/README.md");
  });

  it("fails package size reports above the configured hard threshold", () => {
    const report = createPackagePolicyReport({
      manifest: approvedHostProvidedManifest(),
      thresholds: {
        ...defaultPackageSizeThresholds,
        packageWarningBytes: 10,
        packageFailBytes: 20,
      },
      packageReports: [
        packageReport({
          name: "@typai/contenteditable",
          sizeBytes: 21,
          files: [file("dist/index.js", 21)],
        }),
      ],
    });

    expect(report.findings.join("\n")).toContain("exceeds failure threshold");
  });
});

function blockedManifest() {
  return {
    review: { status: "blocked" },
    output: { packageInclusion: "blocked" },
  };
}

function approvedBundledManifest() {
  return {
    review: { status: "approved" },
    output: { packageInclusion: "committed-generated-binary" },
  };
}

function approvedHostProvidedManifest() {
  return {
    review: { status: "approved" },
    output: { packageInclusion: "host-provided-only" },
  };
}

function packageReport(overrides = {}) {
  const files = overrides.files ?? [];

  return {
    name: "@typai/core",
    directory: "packages/core",
    filename: "fixture.tgz",
    sizeBytes: files.reduce((total, entry) => total + entry.sizeBytes, 0),
    unpackedSizeBytes: files.reduce((total, entry) => total + entry.sizeBytes, 0),
    fileCount: files.length,
    files,
    generatedWasmBytes: 0,
    productionBinaryBytes: 0,
    productionBinaryFiles: [],
    rawSourceFiles: [],
    productionNoticeFiles: [],
    ...overrides,
  };
}

function file(path, sizeBytes) {
  return { path, sizeBytes };
}
