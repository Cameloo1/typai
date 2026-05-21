import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { formatMs, formatPercent } from "./evaluateSpellQuality.mjs";

export function writeSpellQualityReports(evaluation, { jsonPath, markdownPath } = {}) {
  if (jsonPath !== undefined) {
    mkdirSync(dirname(resolve(jsonPath)), { recursive: true });
    writeFileSync(
      jsonPath,
      `${JSON.stringify(toSerializableEvaluation(evaluation), null, 2)}\n`,
      "utf8",
    );
  }

  const markdown = renderSpellQualityMarkdown(evaluation);

  if (markdownPath !== undefined) {
    mkdirSync(dirname(resolve(markdownPath)), { recursive: true });
    writeFileSync(markdownPath, markdown, "utf8");
  }

  return markdown;
}

export function renderSpellQualityMarkdown(evaluation) {
  const { metrics } = evaluation;

  return [
    "# Spell Quality Latest Report",
    "",
    `Generated at: ${evaluation.generatedAt}`,
    "",
    "## Summary",
    "",
    `- asset mode: ${metrics.assetMode}`,
    `- dictionary source kind: ${metrics.dictionarySourceKind}`,
    `- total cases: ${metrics.totalCases}`,
    `- core cases: ${metrics.coreCases}`,
    `- adapter/E2E-designated cases: ${metrics.adapterOrE2ECases}`,
    `- dictionary words: ${metrics.dictionaryWordCount}`,
    `- dictionary bytes: ${metrics.dictionaryByteSize}`,
    `- delete-index entries: ${metrics.deleteIndexEntryCount}`,
    `- delete-index memory estimate: ${metrics.deleteIndexMemoryEstimateBytes}`,
    `- allowed autocorrect pass rate: ${formatPercent(metrics.allowedAutocorrectPassRate)} (${metrics.allowedAutocorrectPassed}/${metrics.allowedAutocorrectCount})`,
    `- autocorrect precision: ${formatPercent(metrics.autocorrectPrecision)} (${metrics.correctAutocorrectCount}/${metrics.actualAutocorrectCount})`,
    `- suggestion recall@1: ${formatPercent(metrics.suggestionRecallAt1)}`,
    `- suggestion recall@3: ${formatPercent(metrics.suggestionRecallAt3)}`,
    `- suggestion recall@5: ${formatPercent(metrics.suggestionRecallAt5)}`,
    `- valid-word false autocorrect count: ${metrics.validWordFalseAutocorrectCount}`,
    `- protected-token false write count: ${metrics.protectedTokenFalseWriteCount}`,
    `- arbitrary delete-index autocorrect count: ${metrics.arbitraryDeleteIndexAutocorrectCount}`,
    `- domain-term false autocorrect count: ${metrics.domainTermFalseAutocorrectCount}`,
    "",
    "## Performance",
    "",
    `- core check average: ${formatMs(metrics.latency.coreCheck.mean)}`,
    `- core check p50/p95/p99/max: ${formatMs(metrics.latency.coreCheck.p50)} / ${formatMs(metrics.latency.coreCheck.p95)} / ${formatMs(metrics.latency.coreCheck.p99)} / ${formatMs(metrics.latency.coreCheck.max)}`,
    `- suggestion average: ${formatMs(metrics.latency.coreSuggest.mean)}`,
    `- suggestion p50/p95/p99/max: ${formatMs(metrics.latency.coreSuggest.p50)} / ${formatMs(metrics.latency.coreSuggest.p95)} / ${formatMs(metrics.latency.coreSuggest.p99)} / ${formatMs(metrics.latency.coreSuggest.max)}`,
    "",
    "## Category Counts",
    "",
    ...Object.entries(evaluation.categoryCounts).map(
      ([category, count]) => `- ${category}: ${count}`,
    ),
    "",
    "## Gates",
    "",
    `- status: ${metrics.gates.passed ? "passed" : "failed"}`,
    `- failures: ${metrics.gates.failures.length === 0 ? "none" : metrics.gates.failures.join("; ")}`,
    `- warnings: ${metrics.gates.warnings.length === 0 ? "none" : metrics.gates.warnings.join("; ")}`,
    "",
    "## False-Positive Review",
    "",
    renderResultList(metrics.falsePositiveReviewResults, "No false-positive autocorrections."),
    "",
    "## False-Negative Review",
    "",
    renderResultList(metrics.falseNegativeResults, "No approved autocorrect misses."),
    "",
    "## Suggestion Recall Review",
    "",
    renderResultList(metrics.suggestionRecallFailures, "No suggestion recall misses at 5."),
    "",
    "## Ambiguous And Rejected Autocorrect Cases",
    "",
    ...evaluation.caseResults
      .filter((result) => result.row.expectedAction === "suggestions_only")
      .map(
        (result) =>
          `- ${result.row.id}: ${result.row.input} stayed ${result.decision.action}; expected suggestions ${JSON.stringify(result.row.expectedSuggestions ?? [])}`,
      ),
    "",
  ].join("\n");
}

export function printSpellQualitySummary(evaluation) {
  const { metrics } = evaluation;

  console.log("Typai spell quality benchmark");
  console.log(`asset mode: ${metrics.assetMode}`);
  console.log(`dictionary source kind: ${metrics.dictionarySourceKind}`);
  console.log(`total cases: ${metrics.totalCases}`);
  console.log(`core cases: ${metrics.coreCases}`);
  console.log(`adapter/E2E-designated cases: ${metrics.adapterOrE2ECases}`);
  console.log("");
  console.log("corpus category counts");
  for (const [category, count] of Object.entries(evaluation.categoryCounts)) {
    console.log(`${category}: ${count}`);
  }
  console.log("");
  console.log("quality metrics");
  console.log(
    `allowed autocorrect pass rate: ${formatPercent(metrics.allowedAutocorrectPassRate)} (${metrics.allowedAutocorrectPassed}/${metrics.allowedAutocorrectCount})`,
  );
  console.log(
    `autocorrect precision: ${formatPercent(metrics.autocorrectPrecision)} (${metrics.correctAutocorrectCount}/${metrics.actualAutocorrectCount})`,
  );
  console.log(`suggestion recall@1: ${formatPercent(metrics.suggestionRecallAt1)}`);
  console.log(`suggestion recall@3: ${formatPercent(metrics.suggestionRecallAt3)}`);
  console.log(`suggestion recall@5: ${formatPercent(metrics.suggestionRecallAt5)}`);
  console.log(`valid-word false autocorrect count: ${metrics.validWordFalseAutocorrectCount}`);
  console.log(`protected-token false write count: ${metrics.protectedTokenFalseWriteCount}`);
  console.log(
    `arbitrary delete-index autocorrect count: ${metrics.arbitraryDeleteIndexAutocorrectCount}`,
  );
  console.log(`domain-term false autocorrect count: ${metrics.domainTermFalseAutocorrectCount}`);
  console.log(`protected-token non-noop count: ${metrics.protectedTokenNonNoopCount}`);
  console.log("");
  console.log("performance");
  console.log(`average core check latency: ${formatMs(metrics.latency.coreCheck.mean)}`);
  console.log(`p50 core check latency: ${formatMs(metrics.latency.coreCheck.p50)}`);
  console.log(`p95 core check latency: ${formatMs(metrics.latency.coreCheck.p95)}`);
  console.log(`p99 core check latency: ${formatMs(metrics.latency.coreCheck.p99)}`);
  console.log(`average suggestion latency: ${formatMs(metrics.latency.coreSuggest.mean)}`);
  console.log(`p50 suggestion latency: ${formatMs(metrics.latency.coreSuggest.p50)}`);
  console.log(`p95 suggestion latency: ${formatMs(metrics.latency.coreSuggest.p95)}`);
  console.log(`p99 suggestion latency: ${formatMs(metrics.latency.coreSuggest.p99)}`);
  console.log(`worst-case suggestion latency: ${formatMs(metrics.latency.coreSuggest.max)}`);
  console.log("");
  console.log("asset stats");
  console.log(`dictionary word count: ${metrics.dictionaryWordCount}`);
  console.log(`dictionary byte size: ${metrics.dictionaryByteSize}`);
  console.log(`delete-index entry count: ${metrics.deleteIndexEntryCount}`);
  console.log(`delete-index memory estimate: ${metrics.deleteIndexMemoryEstimateBytes}`);
  console.log("");
  console.log("quality gates");
  console.log(`status: ${metrics.gates.passed ? "passed" : "failed"}`);
  console.log(
    `failures: ${metrics.gates.failures.length === 0 ? "none" : metrics.gates.failures.join("; ")}`,
  );
  console.log(
    `warnings: ${metrics.gates.warnings.length === 0 ? "none" : metrics.gates.warnings.join("; ")}`,
  );
}

function renderResultList(results, emptyText) {
  if (results.length === 0) {
    return emptyText;
  }

  return results
    .map(
      (result) =>
        `- ${result.row.id}: input ${JSON.stringify(result.row.input)}, expected ${result.row.expectedAction}, got ${result.decision.action}`,
    )
    .join("\n");
}

function toSerializableEvaluation(evaluation) {
  return {
    generatedAt: evaluation.generatedAt,
    assetMode: evaluation.assetMode,
    dictionarySourceKind: evaluation.dictionarySourceKind,
    thresholds: evaluation.thresholds,
    categoryCounts: evaluation.categoryCounts,
    coreCategoryCounts: evaluation.coreCategoryCounts,
    metrics: {
      ...evaluation.metrics,
      falsePositiveReviewResults: summarizeResults(evaluation.metrics.falsePositiveReviewResults),
      falseNegativeResults: summarizeResults(evaluation.metrics.falseNegativeResults),
      suggestionRecallFailures: summarizeResults(evaluation.metrics.suggestionRecallFailures),
    },
    caseResults: summarizeResults(evaluation.caseResults),
  };
}

function summarizeResults(results) {
  return results.map((result) => ({
    id: result.row.id,
    category: result.row.category,
    input: result.row.input,
    expectedAction: result.row.expectedAction,
    expectedReplacement: result.row.expectedReplacement,
    expectedSuggestions: result.row.expectedSuggestions,
    actualAction: result.decision.action,
    actualReplacement: result.decision.replacement,
    actualSuggestions: result.suggestionsForRecall,
    reasonCodes: result.decision.reasonCodes,
    passed: result.passed,
    failureReasons: result.failureReasons,
  }));
}
