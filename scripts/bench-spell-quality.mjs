import { createTypaiCore } from "../packages/core/dist/index.js";
import { evaluateSpellQuality } from "../tests/spell-quality/src/evaluateSpellQuality.mjs";
import { loadSpellQualityCorpus } from "../tests/spell-quality/src/loadCorpus.mjs";
import { buildQualityDictionaryBytes } from "../tests/spell-quality/src/qualityDictionary.mjs";
import {
  printSpellQualitySummary,
  writeSpellQualityReports,
} from "../tests/spell-quality/src/report.mjs";

const rows = loadSpellQualityCorpus();
const qualityDictionaryBytes = buildQualityDictionaryBytes(rows);
const core = await createTypaiCore({
  dictionary: {
    mode: "host-provided",
    bytes: qualityDictionaryBytes,
  },
});
const evaluation = await evaluateSpellQuality({
  rows,
  core,
  assetMode: "host-provided-quality-fixture",
  dictionarySourceKind: "in-memory Typai Dictionary Blob v1 quality fixture",
});
const productionModeBlocked = await createTypaiCore({
  dictionary: {
    mode: "production",
  },
}).then(
  () => false,
  (error) =>
    error instanceof Error && /production dictionary asset is unavailable/i.test(error.message),
);

evaluation.metrics.productionModeBlocked = productionModeBlocked;

if (!productionModeBlocked) {
  evaluation.metrics.gates.failures.push("production dictionary mode was not blocked");
  evaluation.metrics.gates.passed = false;
}

writeSpellQualityReports(evaluation, {
  jsonPath: "reports/spell-quality/latest.json",
  markdownPath: "reports/spell-quality/latest.md",
});
printSpellQualitySummary(evaluation);
console.log(`production dictionary mode blocked: ${productionModeBlocked ? "yes" : "no"}`);
console.log("reports: reports/spell-quality/latest.md, reports/spell-quality/latest.json");

if (evaluation.metrics.gates.warnings.length > 0) {
  for (const warning of evaluation.metrics.gates.warnings) {
    console.warn(`warning: ${warning}`);
  }
}

if (!evaluation.metrics.gates.passed) {
  for (const failure of evaluation.metrics.gates.failures) {
    console.error(`error: ${failure}`);
  }

  process.exitCode = 1;
}
