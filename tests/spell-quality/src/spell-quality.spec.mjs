import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createTypaiCore } from "../../../packages/core/dist/index.js";
import { evaluateQualityGates, evaluateSpellQuality } from "./evaluateSpellQuality.mjs";
import {
  corpusCategories,
  loadSpellQualityCorpus,
  validateSpellQualityRow,
} from "./loadCorpus.mjs";
import { buildQualityDictionaryBytes } from "./qualityDictionary.mjs";
import { renderSpellQualityMarkdown } from "./report.mjs";

const validRow = {
  id: "unit-valid-001",
  category: "allowed-autocorrect",
  input: "teh",
  expectedAction: "auto_correct",
  expectedReplacement: "the",
  expectedSuggestions: ["the"],
  mustNotAutocorrect: false,
  protected: false,
  validWordTrap: false,
  severity: "critical",
  source: "common_typo_table",
  mode: "plain",
  surfaceApplicability: ["core"],
  notes: "",
};

describe("spell-quality corpus", () => {
  it("loads all structured categories", () => {
    const rows = loadSpellQualityCorpus();
    const counts = new Map();

    for (const row of rows) {
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    }

    expect(rows.length).toBeGreaterThan(100);
    for (const category of corpusCategories) {
      expect(counts.get(category)).toBeGreaterThan(0);
    }
  });

  it("rejects unknown categories", () => {
    expect(() => validateSpellQualityRow({ ...validRow, category: "unknown-category" })).toThrow(
      /unknown category/,
    );
  });

  it("rejects malformed rows", () => {
    const { severity: _severity, ...malformed } = validRow;

    expect(() => validateSpellQualityRow(malformed)).toThrow(/severity/);
  });

  it("rejects duplicate IDs", () => {
    const dir = mkdtempSync(join(tmpdir(), "typai-spell-quality-"));

    try {
      writeFileSync(
        join(dir, "dupes.jsonl"),
        `${JSON.stringify(validRow)}\n${JSON.stringify({ ...validRow })}\n`,
        "utf8",
      );

      expect(() => loadSpellQualityCorpus({ corpusDir: dir })).toThrow(/Duplicate/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("spell-quality evaluation", () => {
  it("evaluates the committed corpus through the core host-provided fixture", async () => {
    const rows = loadSpellQualityCorpus();
    const bytes = buildQualityDictionaryBytes(rows);
    const core = await createTypaiCore({
      dictionary: {
        mode: "host-provided",
        bytes,
      },
    });
    const evaluation = await evaluateSpellQuality({
      rows,
      core,
      assetMode: "host-provided-quality-fixture",
      dictionarySourceKind: "unit quality fixture",
      latencyIterationsPerToken: 2,
      latencyWarmupIterationsPerToken: 1,
    });

    expect(evaluation.metrics.gates.passed).toBe(true);
    expect(evaluation.metrics.validWordFalseAutocorrectCount).toBe(0);
    expect(evaluation.metrics.protectedTokenFalseWriteCount).toBe(0);
    expect(evaluation.metrics.arbitraryDeleteIndexAutocorrectCount).toBe(0);
    expect(evaluation.metrics.allowedAutocorrectPassRate).toBe(1);
    expect(evaluation.metrics.dictionaryWordCount).toBeGreaterThan(0);
    expect(evaluation.metrics.deleteIndexEntryCount).toBeGreaterThan(0);
  });

  it("computes metrics for a small controlled fixture", async () => {
    const rows = [
      validRow,
      {
        ...validRow,
        id: "unit-suggestion-001",
        category: "suggestions-only",
        input: "reciept",
        expectedAction: "suggestions_only",
        expectedReplacement: undefined,
        expectedSuggestions: ["receipt"],
        mustNotAutocorrect: true,
        source: "manual_review",
      },
      {
        ...validRow,
        id: "unit-valid-word-001",
        category: "valid-word-traps",
        input: "from",
        expectedAction: "do_nothing",
        expectedReplacement: undefined,
        expectedSuggestions: [],
        mustNotAutocorrect: true,
        validWordTrap: true,
        source: "dictionary",
      },
    ];
    const evaluation = await evaluateSpellQuality({
      rows,
      core: createFakeCore({
        teh: {
          action: "auto_correct",
          original: "teh",
          replacement: "the",
          confidence: 1,
          mark: "blue_applied_correction",
          reasonCodes: ["COMMON_TYPO_MATCH"],
        },
        reciept: {
          action: "mark_unresolved",
          original: "reciept",
          suggestions: ["receipt"],
          mark: "red_spelling_issue",
          reasonCodes: ["SPELLING_SUGGESTION"],
        },
        from: {
          action: "do_nothing",
          reasonCodes: ["VALID_WORD_BLOCK"],
        },
      }),
      latencyIterationsPerToken: 0,
    });

    expect(evaluation.metrics.totalCases).toBe(3);
    expect(evaluation.metrics.allowedAutocorrectPassRate).toBe(1);
    expect(evaluation.metrics.autocorrectPrecision).toBe(1);
    expect(evaluation.metrics.suggestionRecallAt1).toBe(1);
  });

  it("fails the protected-token false-write gate", () => {
    const metrics = baseGateMetrics({
      protectedTokenFalseWriteCount: 1,
    });
    const gates = evaluateQualityGates({
      categoryCounts: Object.fromEntries(corpusCategories.map((category) => [category, 1])),
      caseResults: [],
      metrics,
      thresholds: {
        autocorrectPrecision: 0.99,
        suggestionRecallAt3Warning: 0.9,
        coreCheckP95HardMs: 100,
        coreSuggestP95HardMs: 100,
        coreCheckP95WarningMs: 20,
        coreSuggestP95WarningMs: 20,
        minCategoryRows: 1,
      },
    });

    expect(gates.passed).toBe(false);
    expect(gates.failures.join("\n")).toContain("protected-token false write count 1");
  });

  it("fails the valid-word false-autocorrect gate", () => {
    const metrics = baseGateMetrics({
      validWordFalseAutocorrectCount: 1,
    });
    const gates = evaluateQualityGates({
      categoryCounts: Object.fromEntries(corpusCategories.map((category) => [category, 1])),
      caseResults: [],
      metrics,
      thresholds: {
        autocorrectPrecision: 0.99,
        suggestionRecallAt3Warning: 0.9,
        coreCheckP95HardMs: 100,
        coreSuggestP95HardMs: 100,
        coreCheckP95WarningMs: 20,
        coreSuggestP95WarningMs: 20,
        minCategoryRows: 1,
      },
    });

    expect(gates.passed).toBe(false);
    expect(gates.failures.join("\n")).toContain("valid-word false autocorrect count 1");
  });

  it("renders a human-readable report", async () => {
    const evaluation = await evaluateSpellQuality({
      rows: [validRow],
      core: createFakeCore({
        teh: {
          action: "auto_correct",
          original: "teh",
          replacement: "the",
          confidence: 1,
          mark: "blue_applied_correction",
          reasonCodes: ["COMMON_TYPO_MATCH"],
        },
      }),
      latencyIterationsPerToken: 0,
    });
    const markdown = renderSpellQualityMarkdown(evaluation);

    expect(markdown).toContain("# Spell Quality Latest Report");
    expect(markdown).toContain("## False-Positive Review");
    expect(markdown).toContain("allowed autocorrect pass rate");
  });

  it("handles large corpus slices without pairwise work", async () => {
    const rows = Array.from({ length: 1_000 }, (_value, index) => ({
      ...validRow,
      id: `large-valid-${index.toString().padStart(4, "0")}`,
      category: "valid-word-traps",
      input: `word${index}`,
      expectedAction: "do_nothing",
      expectedReplacement: undefined,
      expectedSuggestions: [],
      mustNotAutocorrect: true,
      validWordTrap: true,
      source: "dictionary",
    }));
    const core = createFakeCore(
      Object.fromEntries(
        rows.map((row) => [
          row.input,
          {
            action: "do_nothing",
            reasonCodes: ["VALID_WORD_BLOCK"],
          },
        ]),
      ),
    );
    const evaluation = await evaluateSpellQuality({
      rows,
      core,
      latencyIterationsPerToken: 0,
    });

    expect(evaluation.metrics.totalCases).toBe(1_000);
    expect(evaluation.metrics.validWordFalseAutocorrectCount).toBe(0);
    expect(evaluation.metrics.gates.passed).toBe(true);
  });
});

function createFakeCore(decisionsByToken) {
  return {
    checkCompletedToken({ token }) {
      return decisionsByToken[token] ?? { action: "do_nothing", reasonCodes: ["TEST_DEFAULT"] };
    },
    suggestToken({ token }) {
      const decision = decisionsByToken[token];

      if (decision?.action === "mark_unresolved") {
        return {
          suggestions: decision.suggestions,
          scores: decision.suggestions.map(() => 1),
          reasonCodes: decision.reasonCodes,
        };
      }

      return {
        suggestions: [],
        scores: [],
        reasonCodes: ["TEST_DEFAULT"],
      };
    },
    getLoadedDictionaryWordCount() {
      return 10;
    },
    getLoadedDictionaryByteSize() {
      return 128;
    },
    getDeleteIndexEntryCount() {
      return 20;
    },
    getDeleteIndexMemoryEstimateBytes() {
      return 256;
    },
  };
}

function baseGateMetrics(overrides = {}) {
  return {
    protectedTokenFalseWriteCount: 0,
    validWordFalseAutocorrectCount: 0,
    arbitraryDeleteIndexAutocorrectCount: 0,
    domainTermFalseAutocorrectCount: 0,
    allowedAutocorrectPassRate: 1,
    autocorrectPrecision: 1,
    suggestionRecallAt3: 1,
    latency: {
      coreCheck: { p95: 0 },
      coreSuggest: { p95: 0 },
    },
    ...overrides,
  };
}
