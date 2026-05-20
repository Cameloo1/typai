import { readFileSync } from "node:fs";

import { createTypaiCore } from "../packages/core/dist/index.js";

const directCoreWarningP95Ms = 20;
const directCoreHardP95Ms = 100;
const autocorrectPrecisionHardTarget = 0.99;
const suggestionRecallWarningTarget = 0.9;
const latencyIterationsPerToken = 500;

const expandedCommonTypos = [
  ["teh", "the"],
  ["adn", "and"],
  ["recieve", "receive"],
  ["becuase", "because"],
  ["thier", "their"],
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
].map(([token, replacement]) => ({ token, replacement }));

const casingAndPunctuation = [
  { token: "Teh", replacement: "The" },
  { token: "TEH", replacement: "THE" },
  { token: "teh,", replacement: "the," },
  { token: "Adress", replacement: "Address" },
  { token: "adress.", replacement: "address." },
  { token: "definitly!", replacement: "definitely!" },
];

const suggestionsOnlyMisspellings = [
  { token: "reciept", suggestion: "receipt", category: "delete-index-only misspelling" },
  { token: "addres", suggestion: "address", category: "delete-index-only misspelling" },
  { token: "separat", suggestion: "separate", category: "delete-index-only misspelling" },
  { token: "tomorow", suggestion: "tomorrow", category: "delete-index-only misspelling" },
  { token: "becaus", suggestion: "because", category: "delete-index-only misspelling" },
  { token: "calandar", suggestion: "calendar", category: "delete-index-only misspelling" },
  { token: "neccesary", suggestion: "necessary", category: "delete-index-only misspelling" },
  { token: "definately", suggestion: "definitely", category: "delete-index-only misspelling" },
  { token: "acommodate", suggestion: "accommodate", category: "delete-index-only misspelling" },
];

const contractions = [
  { token: "dont", suggestion: "don't", category: "contraction" },
  { token: "it;s", suggestion: "it's", category: "contraction punctuation" },
];

const pluralAmbiguities = [
  { token: "adresss", suggestion: "address", category: "plural ambiguity" },
];

const validWordTraps = ["form", "lead", "to", "its", "there", "their", "from", "too", "led"];

const protectedTerms = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "~/project/src",
  "snake_case_identifier",
  "camelCaseIdentifier",
  "PascalCaseClass",
  "CVE-2024-1234",
];

const technicalTerms = ["nmap", "sqlmap", "ffuf", "gobuster", "kubectl", "iptables"];
const acronyms = ["XSS", "CSRF", "API", "NASA", "SQL", "HTTP"];
const properNouns = ["Alice", "Cameloo", "Typai", "OpenAI"];
const tradingAndDomainTerms = ["BTC", "ETH", "SPY", "NVDA"];

const allowedAutocorrections = [...expandedCommonTypos, ...casingAndPunctuation];
const suggestionCases = [...suggestionsOnlyMisspellings, ...contractions, ...pluralAmbiguities];
const noAutocorrectCases = [
  ...validWordTraps.map((token) => ({ token, category: "valid-word trap" })),
  ...protectedTerms.map((token) => ({ token, category: "protected term" })),
  ...technicalTerms.map((token) => ({ token, category: "technical term" })),
  ...acronyms.map((token) => ({ token, category: "acronym" })),
  ...properNouns.map((token) => ({ token, category: "proper noun" })),
  ...tradingAndDomainTerms.map((token) => ({ token, category: "trading/domain term" })),
];
const latencyTokens = uniqueTokens([
  ...allowedAutocorrections.map(({ token }) => token),
  ...suggestionCases.map(({ token }) => token),
  ...noAutocorrectCases.map(({ token }) => token),
]);

const core = await createTypaiCore();
const autocorrectResults = allowedAutocorrections.map((testCase) => {
  const decision = core.checkCompletedToken({ token: testCase.token });
  const passed =
    decision.action === "auto_correct" && decision.replacement === testCase.replacement;

  return {
    ...testCase,
    decision,
    passed,
  };
});
const suggestionResults = suggestionCases.map((testCase) => {
  const decision = core.checkCompletedToken({ token: testCase.token });
  const directSuggestion = core.suggestToken({ token: testCase.token, maxSuggestions: 4 });
  const suggestions =
    decision.action === "mark_unresolved" ? decision.suggestions : directSuggestion.suggestions;
  const recalled = suggestions.includes(testCase.suggestion);
  const suggestionsOnly = decision.action === "mark_unresolved";

  return {
    ...testCase,
    decision,
    directSuggestion,
    recalled,
    suggestionsOnly,
  };
});
const noAutocorrectResults = noAutocorrectCases.map((testCase) => {
  const decision = core.checkCompletedToken({ token: testCase.token });

  return {
    ...testCase,
    decision,
    falseAutocorrect: decision.action === "auto_correct",
  };
});
const latencySummary = measureDirectCoreLatency(core, latencyTokens);
const productionModeBlocked = await createTypaiCore({
  dictionary: {
    mode: "production",
  },
}).then(
  () => false,
  (error) =>
    error instanceof Error && /production dictionary asset is unavailable/i.test(error.message),
);
const hostProvidedDictionaryBytes = readFileSync(
  new URL("../packages/core/assets/mock-en-us.dictionary.bin", import.meta.url),
);
const hostProvidedCore = await createTypaiCore({
  dictionary: {
    mode: "host-provided",
    bytes: hostProvidedDictionaryBytes,
  },
});
const hostProvidedSummary = {
  loadedWordCount: hostProvidedCore.getLoadedDictionaryWordCount(),
  deleteIndexEntryCount: hostProvidedCore.getDeleteIndexEntryCount(),
  receiptSuggestionRecalled: hostProvidedCore
    .suggestToken({ token: "reciept", maxSuggestions: 4 })
    .suggestions.includes("receipt"),
  validWordUnchanged:
    hostProvidedCore.checkCompletedToken({ token: "receipt" }).action === "do_nothing",
};

const allowedAutocorrectCount = autocorrectResults.filter((result) => result.passed).length;
const falseAutocorrections = [
  ...autocorrectResults.filter((result) => !result.passed),
  ...suggestionResults.filter((result) => result.decision.action === "auto_correct"),
  ...noAutocorrectResults.filter((result) => result.falseAutocorrect),
];
const autocorrectPrecision = precision(allowedAutocorrectCount, falseAutocorrections.length);
const suggestionRecallCount = suggestionResults.filter((result) => result.recalled).length;
const suggestionRecall = ratio(suggestionRecallCount, suggestionResults.length);
const suggestionsOnlyCount = suggestionResults.filter((result) => result.suggestionsOnly).length;
const validWordFalseAutocorrectCount = noAutocorrectResults.filter(
  (result) => result.category === "valid-word trap" && result.falseAutocorrect,
).length;
const protectedTokenFalseWriteCount = noAutocorrectResults.filter(
  (result) =>
    (result.category === "protected term" ||
      result.category === "technical term" ||
      result.category === "acronym" ||
      result.category === "trading/domain term") &&
    result.falseAutocorrect,
).length;
const protectedTokenNonNoopCount = noAutocorrectResults.filter(
  (result) =>
    (result.category === "protected term" ||
      result.category === "technical term" ||
      result.category === "acronym" ||
      result.category === "trading/domain term") &&
    result.decision.action !== "do_nothing",
).length;
const reviewedFalsePositiveAutocorrectCount = noAutocorrectResults.filter(
  (result) => result.category === "proper noun" && result.falseAutocorrect,
).length;

const failures = [];
const warnings = [];

if (allowedAutocorrectCount !== allowedAutocorrections.length) {
  failures.push(
    `allowed autocorrect count ${allowedAutocorrectCount}/${allowedAutocorrections.length}`,
  );
}

if (autocorrectPrecision < autocorrectPrecisionHardTarget) {
  failures.push(
    `autocorrect precision ${formatPercent(autocorrectPrecision)} below ${formatPercent(
      autocorrectPrecisionHardTarget,
    )}`,
  );
}

if (validWordFalseAutocorrectCount > 0) {
  failures.push(`valid-word false autocorrect count ${validWordFalseAutocorrectCount}`);
}

if (protectedTokenFalseWriteCount > 0) {
  failures.push(`protected-token false write count ${protectedTokenFalseWriteCount}`);
}

if (reviewedFalsePositiveAutocorrectCount > 0) {
  failures.push(
    `reviewed false-positive autocorrect count ${reviewedFalsePositiveAutocorrectCount}`,
  );
}

if (!productionModeBlocked) {
  failures.push("production dictionary mode was not blocked");
}

if (hostProvidedSummary.loadedWordCount <= 0) {
  failures.push("host-provided dictionary fixture did not load");
}

if (!hostProvidedSummary.receiptSuggestionRecalled || !hostProvidedSummary.validWordUnchanged) {
  failures.push("host-provided dictionary fixture behavior check failed");
}

if (latencySummary.p95 > directCoreHardP95Ms) {
  failures.push(
    `direct core p95 ${formatMs(latencySummary.p95)} above ${formatMs(directCoreHardP95Ms)}`,
  );
}

if (suggestionRecall < suggestionRecallWarningTarget) {
  warnings.push(
    `suggestion recall ${formatPercent(suggestionRecall)} below ${formatPercent(
      suggestionRecallWarningTarget,
    )}`,
  );
}

if (latencySummary.p95 > directCoreWarningP95Ms) {
  warnings.push(
    `direct core p95 ${formatMs(latencySummary.p95)} above ${formatMs(
      directCoreWarningP95Ms,
    )} warning target`,
  );
}

printReport();

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`error: ${failure}`);
  }

  process.exitCode = 1;
}

function printReport() {
  console.log("Typai spell quality benchmark");
  console.log(
    `allowed autocorrect count: ${allowedAutocorrectCount}/${allowedAutocorrections.length}`,
  );
  console.log(
    `autocorrect precision on corpus: ${formatPercent(autocorrectPrecision)} (${allowedAutocorrectCount} correct, ${falseAutocorrections.length} false)`,
  );
  console.log(
    `suggestion recall on corpus: ${formatPercent(suggestionRecall)} (${suggestionRecallCount}/${suggestionResults.length})`,
  );
  console.log(`valid-word false autocorrect count: ${validWordFalseAutocorrectCount}`);
  console.log(`protected-token false write count: ${protectedTokenFalseWriteCount}`);
  console.log(`protected-token non-noop count: ${protectedTokenNonNoopCount}`);
  console.log(
    `reviewed false-positive autocorrect count: ${reviewedFalsePositiveAutocorrectCount}`,
  );
  console.log(`suggestions-only count: ${suggestionsOnlyCount}/${suggestionResults.length}`);
  console.log(
    `host-provided dictionary words: ${hostProvidedSummary.loadedWordCount} (${hostProvidedSummary.deleteIndexEntryCount} delete-index entries)`,
  );
  console.log(`production dictionary mode blocked: ${productionModeBlocked ? "yes" : "no"}`);
  console.log(`average direct core latency: ${formatMs(latencySummary.mean)}`);
  console.log(`p95 direct core latency: ${formatMs(latencySummary.p95)}`);
  console.log("p95 browser correction latency: measured by pnpm bench:browser");

  console.log("");
  console.log("corpus category counts");
  console.log(`expanded common typos: ${expandedCommonTypos.length}`);
  console.log(`casing/punctuation: ${casingAndPunctuation.length}`);
  console.log(`suggestions-only misspellings: ${suggestionsOnlyMisspellings.length}`);
  console.log(`contractions: ${contractions.length}`);
  console.log(`plural ambiguities: ${pluralAmbiguities.length}`);
  console.log(`valid-word traps: ${validWordTraps.length}`);
  console.log(`protected terms: ${protectedTerms.length}`);
  console.log(`technical terms: ${technicalTerms.length}`);
  console.log(`acronyms: ${acronyms.length}`);
  console.log(`proper nouns reviewed: ${properNouns.length}`);
  console.log(`trading/domain terms: ${tradingAndDomainTerms.length}`);

  console.log("");
  console.log("quality gates");
  console.log(`protected false writes = ${protectedTokenFalseWriteCount === 0 ? "pass" : "fail"}`);
  console.log(
    `valid-word false autocorrections = ${validWordFalseAutocorrectCount === 0 ? "pass" : "fail"}`,
  );
  console.log(
    `reviewed false-positive autocorrections = ${
      reviewedFalsePositiveAutocorrectCount === 0 ? "pass" : "fail"
    }`,
  );
  console.log(`production mode blocked = ${productionModeBlocked ? "pass" : "fail"}`);
  console.log(
    `host-provided fixture behavior = ${
      hostProvidedSummary.loadedWordCount > 0 &&
      hostProvidedSummary.receiptSuggestionRecalled &&
      hostProvidedSummary.validWordUnchanged
        ? "pass"
        : "fail"
    }`,
  );
  console.log(
    `autocorrect precision >= ${formatPercent(autocorrectPrecisionHardTarget)} = ${
      autocorrectPrecision >= autocorrectPrecisionHardTarget ? "pass" : "fail"
    }`,
  );
  console.log(
    `direct core p95 < ${formatMs(directCoreHardP95Ms)} = ${
      latencySummary.p95 < directCoreHardP95Ms ? "pass" : "fail"
    }`,
  );
  console.log(
    `suggestion recall target ${formatPercent(suggestionRecallWarningTarget)} = ${
      suggestionRecall >= suggestionRecallWarningTarget ? "pass" : "warn"
    }`,
  );
  console.log(`browser completion p95 warning/fail thresholds = delegated to pnpm bench:browser`);
}

function measureDirectCoreLatency(typai, tokens) {
  let tokenIndex = 0;
  const samples = [];
  const warmupIterations = tokens.length * 10;
  const measuredIterations = tokens.length * latencyIterationsPerToken;

  for (let index = 0; index < warmupIterations; index += 1) {
    typai.checkCompletedToken({ token: tokens[index % tokens.length] });
  }

  for (let index = 0; index < measuredIterations; index += 1) {
    const token = tokens[tokenIndex % tokens.length];

    tokenIndex += 1;
    const startedAt = performance.now();
    typai.checkCompletedToken({ token });
    samples.push(performance.now() - startedAt);
  }

  return summarizeLatencies(samples);
}

function summarizeLatencies(samples) {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample >= 0)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      mean: 0,
      p95: 0,
    };
  }

  return {
    count: sorted.length,
    mean: sorted.reduce((sum, sample) => sum + sample, 0) / sorted.length,
    p95: percentile(sorted, 95),
  };
}

function percentile(sorted, value) {
  const index = Math.ceil((sorted.length * value) / 100) - 1;

  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function precision(correct, falsePositiveCount) {
  const denominator = correct + falsePositiveCount;

  return denominator === 0 ? 1 : correct / denominator;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : numerator / denominator;
}

function formatMs(value) {
  return `${value.toFixed(4)} ms`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function uniqueTokens(tokens) {
  return [...new Set(tokens)];
}
