import { countByCategory } from "./loadCorpus.mjs";

export const defaultQualityThresholds = {
  autocorrectPrecision: 0.99,
  suggestionRecallAt3Warning: 0.9,
  coreCheckP95HardMs: 100,
  coreSuggestP95HardMs: 100,
  coreCheckP95WarningMs: 20,
  coreSuggestP95WarningMs: 20,
  minCategoryRows: 1,
};

const defaultLatencyIterationsPerToken = 100;
const defaultLatencyWarmupIterationsPerToken = 5;

export async function evaluateSpellQuality({
  rows,
  core,
  createCore,
  assetMode = "unknown",
  dictionarySourceKind = assetMode,
  latencyIterationsPerToken = defaultLatencyIterationsPerToken,
  latencyWarmupIterationsPerToken = defaultLatencyWarmupIterationsPerToken,
  thresholds = defaultQualityThresholds,
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("evaluateSpellQuality requires a non-empty rows array.");
  }

  const typai =
    core ??
    (createCore === undefined
      ? undefined
      : await createCore({
          dictionary: { mode: "built-in" },
        }));

  if (typai === undefined) {
    throw new Error("evaluateSpellQuality requires core or createCore.");
  }

  const coreRows = rows.filter((row) => row.surfaceApplicability.includes("core"));
  const caseResults = coreRows.map((row) => evaluateRow(typai, row));
  const categoryCounts = countByCategory(rows);
  const coreCategoryCounts = countByCategory(coreRows);
  const metrics = computeMetrics({
    allRows: rows,
    coreRows,
    caseResults,
    typai,
    assetMode,
    dictionarySourceKind,
  });

  metrics.latency = measureLatency({
    rows: coreRows,
    typai,
    latencyIterationsPerToken,
    latencyWarmupIterationsPerToken,
  });

  metrics.gates = evaluateQualityGates({
    categoryCounts,
    caseResults,
    metrics,
    thresholds,
  });

  return {
    generatedAt: new Date().toISOString(),
    assetMode,
    dictionarySourceKind,
    thresholds,
    rows,
    coreRows,
    categoryCounts,
    coreCategoryCounts,
    caseResults,
    metrics,
  };
}

export function evaluateQualityGates({ categoryCounts, caseResults, metrics, thresholds }) {
  const failures = [];
  const warnings = [];

  for (const [category, count] of Object.entries(categoryCounts)) {
    if (count < thresholds.minCategoryRows) {
      warnings.push(`category ${category} has ${count} rows`);
    }
  }

  if (metrics.protectedTokenFalseWriteCount > 0) {
    failures.push(`protected-token false write count ${metrics.protectedTokenFalseWriteCount}`);
  }

  if (metrics.validWordFalseAutocorrectCount > 0) {
    failures.push(`valid-word false autocorrect count ${metrics.validWordFalseAutocorrectCount}`);
  }

  if (metrics.arbitraryDeleteIndexAutocorrectCount > 0) {
    failures.push(
      `arbitrary delete-index autocorrect count ${metrics.arbitraryDeleteIndexAutocorrectCount}`,
    );
  }

  if (metrics.domainTermFalseAutocorrectCount > 0) {
    failures.push(`domain-term false autocorrect count ${metrics.domainTermFalseAutocorrectCount}`);
  }

  if (metrics.allowedAutocorrectPassRate < 1) {
    failures.push(
      `allowed autocorrect pass rate ${formatPercent(metrics.allowedAutocorrectPassRate)} below 100.00%`,
    );
  }

  if (metrics.autocorrectPrecision < thresholds.autocorrectPrecision) {
    failures.push(
      `autocorrect precision ${formatPercent(metrics.autocorrectPrecision)} below ${formatPercent(
        thresholds.autocorrectPrecision,
      )}`,
    );
  }

  if (metrics.latency.coreCheck.p95 > thresholds.coreCheckP95HardMs) {
    failures.push(
      `core check p95 ${formatMs(metrics.latency.coreCheck.p95)} above ${formatMs(
        thresholds.coreCheckP95HardMs,
      )}`,
    );
  }

  if (metrics.latency.coreSuggest.p95 > thresholds.coreSuggestP95HardMs) {
    failures.push(
      `core suggestion p95 ${formatMs(metrics.latency.coreSuggest.p95)} above ${formatMs(
        thresholds.coreSuggestP95HardMs,
      )}`,
    );
  }

  if (metrics.suggestionRecallAt3 < thresholds.suggestionRecallAt3Warning) {
    warnings.push(
      `suggestion recall@3 ${formatPercent(metrics.suggestionRecallAt3)} below ${formatPercent(
        thresholds.suggestionRecallAt3Warning,
      )}`,
    );
  }

  if (metrics.latency.coreCheck.p95 > thresholds.coreCheckP95WarningMs) {
    warnings.push(
      `core check p95 ${formatMs(metrics.latency.coreCheck.p95)} above warning ${formatMs(
        thresholds.coreCheckP95WarningMs,
      )}`,
    );
  }

  if (metrics.latency.coreSuggest.p95 > thresholds.coreSuggestP95WarningMs) {
    warnings.push(
      `core suggestion p95 ${formatMs(metrics.latency.coreSuggest.p95)} above warning ${formatMs(
        thresholds.coreSuggestP95WarningMs,
      )}`,
    );
  }

  for (const result of caseResults) {
    if (!result.passed) {
      if (
        result.row.expectedAction === "auto_correct" ||
        result.row.protected ||
        result.row.validWordTrap
      ) {
        failures.push(`case ${result.row.id} failed: ${result.failureReasons.join("; ")}`);
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}

export function assertQualityGates(evaluation) {
  if (!evaluation.metrics.gates.passed) {
    throw new Error(evaluation.metrics.gates.failures.join("\n"));
  }
}

function evaluateRow(typai, row) {
  const decision = typai.checkCompletedToken({ token: row.input });
  const suggestionResult = typai.suggestToken({ token: row.input, maxSuggestions: 5 });
  const suggestionsForRecall =
    decision.action === "mark_unresolved" ? decision.suggestions : suggestionResult.suggestions;
  const failureReasons = [];

  if (row.mustNotAutocorrect && decision.action === "auto_correct") {
    failureReasons.push("mustNotAutocorrect row auto-corrected");
  }

  if (row.expectedAction === "auto_correct") {
    if (decision.action !== "auto_correct") {
      failureReasons.push(`expected auto_correct, got ${decision.action}`);
    } else if (decision.replacement !== row.expectedReplacement) {
      failureReasons.push(
        `expected replacement ${row.expectedReplacement}, got ${decision.replacement}`,
      );
    }
  }

  if (row.expectedAction === "do_nothing" && decision.action !== "do_nothing") {
    failureReasons.push(`expected do_nothing, got ${decision.action}`);
  }

  if (row.expectedAction === "mark_unresolved" && decision.action !== "mark_unresolved") {
    failureReasons.push(`expected mark_unresolved, got ${decision.action}`);
  }

  if (row.expectedAction === "suggestions_only") {
    if (decision.action === "auto_correct") {
      failureReasons.push("expected suggestions_only, got auto_correct");
    }

    if (!recallsAny(suggestionsForRecall, row.expectedSuggestions ?? [], 5)) {
      failureReasons.push(
        `expected one of ${JSON.stringify(row.expectedSuggestions ?? [])} in top 5 suggestions`,
      );
    }
  }

  if (
    row.expectedAction === "auto_correct" &&
    !decision.reasonCodes.includes("COMMON_TYPO_MATCH")
  ) {
    failureReasons.push("auto_correct case did not include COMMON_TYPO_MATCH");
  }

  return {
    row,
    decision,
    suggestionResult,
    suggestionsForRecall,
    passed: failureReasons.length === 0,
    failureReasons,
    recallAt1: recallsAny(suggestionsForRecall, row.expectedSuggestions ?? [], 1),
    recallAt3: recallsAny(suggestionsForRecall, row.expectedSuggestions ?? [], 3),
    recallAt5: recallsAny(suggestionsForRecall, row.expectedSuggestions ?? [], 5),
  };
}

function computeMetrics({
  allRows,
  coreRows,
  caseResults,
  typai,
  assetMode,
  dictionarySourceKind,
}) {
  const autocorrectResults = caseResults.filter(
    (result) => result.decision.action === "auto_correct",
  );
  const correctAutocorrectResults = autocorrectResults.filter(
    (result) =>
      result.row.expectedAction === "auto_correct" &&
      result.decision.action === "auto_correct" &&
      result.decision.replacement === result.row.expectedReplacement,
  );
  const allowedAutocorrectResults = caseResults.filter(
    (result) => result.row.expectedAction === "auto_correct",
  );
  const allowedAutocorrectPassResults = allowedAutocorrectResults.filter((result) => result.passed);
  const suggestionEligibleResults = caseResults.filter(
    (result) =>
      result.row.expectedAction !== "auto_correct" &&
      Array.isArray(result.row.expectedSuggestions) &&
      result.row.expectedSuggestions.length > 0,
  );
  const suggestionsOnlyResults = caseResults.filter(
    (result) => result.row.expectedAction === "suggestions_only",
  );
  const validWordFalseAutocorrectResults = caseResults.filter(
    (result) => result.row.validWordTrap && result.decision.action === "auto_correct",
  );
  const protectedTokenFalseWriteResults = caseResults.filter(
    (result) => result.row.protected && result.decision.action === "auto_correct",
  );
  const protectedTokenNonNoopResults = caseResults.filter(
    (result) => result.row.protected && result.decision.action !== "do_nothing",
  );
  const arbitraryDeleteIndexAutocorrectResults = caseResults.filter(
    (result) =>
      result.row.expectedAction !== "auto_correct" &&
      result.decision.action === "auto_correct" &&
      (result.row.expectedSuggestions?.length ?? 0) > 0,
  );
  const domainTermFalseAutocorrectResults = caseResults.filter(
    (result) =>
      (result.row.category === "domain-cybersecurity" ||
        result.row.category === "domain-trading" ||
        result.row.category === "names-proper-nouns") &&
      result.decision.action === "auto_correct",
  );
  const falsePositiveReviewResults = caseResults.filter(
    (result) =>
      result.decision.action === "auto_correct" && result.row.expectedAction !== "auto_correct",
  );
  const falseNegativeResults = caseResults.filter(
    (result) => result.row.expectedAction === "auto_correct" && !result.passed,
  );
  const suggestionRecallFailures = suggestionEligibleResults.filter((result) => !result.recallAt5);

  return {
    totalCases: allRows.length,
    coreCases: coreRows.length,
    adapterOrE2ECases: allRows.length - coreRows.length,
    assetMode,
    dictionarySourceKind,
    dictionaryWordCount: typai.getLoadedDictionaryWordCount(),
    dictionaryByteSize: typai.getLoadedDictionaryByteSize(),
    deleteIndexEntryCount: typai.getDeleteIndexEntryCount(),
    deleteIndexMemoryEstimateBytes: typai.getDeleteIndexMemoryEstimateBytes(),
    allowedAutocorrectCount: allowedAutocorrectResults.length,
    allowedAutocorrectPassed: allowedAutocorrectPassResults.length,
    allowedAutocorrectPassRate: ratio(
      allowedAutocorrectPassResults.length,
      allowedAutocorrectResults.length,
    ),
    actualAutocorrectCount: autocorrectResults.length,
    correctAutocorrectCount: correctAutocorrectResults.length,
    autocorrectPrecision: ratio(correctAutocorrectResults.length, autocorrectResults.length),
    suggestionEligibleCount: suggestionEligibleResults.length,
    suggestionRecallAt1: ratio(
      suggestionEligibleResults.filter((result) => result.recallAt1).length,
      suggestionEligibleResults.length,
    ),
    suggestionRecallAt3: ratio(
      suggestionEligibleResults.filter((result) => result.recallAt3).length,
      suggestionEligibleResults.length,
    ),
    suggestionRecallAt5: ratio(
      suggestionEligibleResults.filter((result) => result.recallAt5).length,
      suggestionEligibleResults.length,
    ),
    suggestionsOnlyCount: suggestionsOnlyResults.length,
    suggestionsOnlyPassed: suggestionsOnlyResults.filter((result) => result.passed).length,
    validWordFalseAutocorrectCount: validWordFalseAutocorrectResults.length,
    protectedTokenFalseWriteCount: protectedTokenFalseWriteResults.length,
    protectedTokenNonNoopCount: protectedTokenNonNoopResults.length,
    arbitraryDeleteIndexAutocorrectCount: arbitraryDeleteIndexAutocorrectResults.length,
    domainTermFalseAutocorrectCount: domainTermFalseAutocorrectResults.length,
    falsePositiveReviewCount: falsePositiveReviewResults.length,
    falseNegativeCount: falseNegativeResults.length,
    suggestionRecallFailureCount: suggestionRecallFailures.length,
    falsePositiveReviewResults,
    falseNegativeResults,
    suggestionRecallFailures,
  };
}

function measureLatency({
  rows,
  typai,
  latencyIterationsPerToken,
  latencyWarmupIterationsPerToken,
}) {
  const tokens = [...new Set(rows.map((row) => row.input))];
  const checkSamples = [];
  const suggestSamples = [];

  if (tokens.length === 0 || latencyIterationsPerToken <= 0) {
    return {
      coreCheck: summarizeLatencies([]),
      coreSuggest: summarizeLatencies([]),
    };
  }

  for (let index = 0; index < tokens.length * latencyWarmupIterationsPerToken; index += 1) {
    const token = tokens[index % tokens.length];

    typai.checkCompletedToken({ token });
    typai.suggestToken({ token, maxSuggestions: 5 });
  }

  for (let index = 0; index < tokens.length * latencyIterationsPerToken; index += 1) {
    const token = tokens[index % tokens.length];
    let startedAt = performance.now();
    typai.checkCompletedToken({ token });
    checkSamples.push(performance.now() - startedAt);

    startedAt = performance.now();
    typai.suggestToken({ token, maxSuggestions: 5 });
    suggestSamples.push(performance.now() - startedAt);
  }

  return {
    coreCheck: summarizeLatencies(checkSamples),
    coreSuggest: summarizeLatencies(suggestSamples),
  };
}

function summarizeLatencies(samples) {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample >= 0)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
    };
  }

  return {
    count: sorted.length,
    mean: sorted.reduce((sum, sample) => sum + sample, 0) / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
  };
}

function percentile(sorted, value) {
  const index = Math.ceil((sorted.length * value) / 100) - 1;

  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function recallsAny(suggestions, expectedSuggestions, topN) {
  if (expectedSuggestions.length === 0) {
    return true;
  }

  const topSuggestions = suggestions.slice(0, topN);

  return expectedSuggestions.some((suggestion) => topSuggestions.includes(suggestion));
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function formatMs(value) {
  return `${value.toFixed(4)} ms`;
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}
