import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const defaultCorpusDir = resolve(moduleDir, "..", "corpus");

export const corpusCategories = [
  "allowed-autocorrect",
  "suggestions-only",
  "valid-word-traps",
  "protected-terms",
  "casing-punctuation",
  "contractions",
  "plural-ambiguity",
  "domain-cybersecurity",
  "domain-trading",
  "markdown-code-contexts",
  "names-proper-nouns",
  "regression-bugs",
];

const allowedCategories = new Set(corpusCategories);
const allowedExpectedActions = new Set([
  "auto_correct",
  "mark_unresolved",
  "do_nothing",
  "suggestions_only",
]);
const allowedSeverities = new Set(["critical", "high", "medium", "low"]);
const allowedSources = new Set([
  "common_typo_table",
  "dictionary",
  "domain_fixture",
  "regression",
  "manual_review",
]);
const allowedModes = new Set(["plain", "markdown", "code", "prompt"]);
const allowedSurfaces = new Set(["core", "contenteditable", "textarea", "react", "codemirror"]);

export function loadSpellQualityCorpus({ corpusDir = defaultCorpusDir } = {}) {
  const files = readdirSync(corpusDir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort((left, right) => left.localeCompare(right, "en-US"));
  const rows = [];
  const seenIds = new Set();

  for (const file of files) {
    const path = join(corpusDir, file);
    const contents = readFileSync(path, "utf8");
    const lines = contents.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (line.trim().length === 0) {
        continue;
      }

      let row;

      try {
        row = JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1} is not valid JSON: ${error.message}`);
      }

      validateSpellQualityRow(row, `${path}:${index + 1}`);

      if (seenIds.has(row.id)) {
        throw new Error(`Duplicate spell-quality corpus id: ${row.id}`);
      }

      seenIds.add(row.id);
      rows.push({ ...row, corpusFile: file, corpusLine: index + 1 });
    }
  }

  if (rows.length === 0) {
    throw new Error(`No spell-quality corpus rows found in ${corpusDir}`);
  }

  return rows;
}

export function validateSpellQualityRow(row, location = "spell-quality row") {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    throw new Error(`${location} must be an object.`);
  }

  requireString(row, "id", location);
  requireString(row, "category", location);
  requireString(row, "input", location);
  requireString(row, "expectedAction", location);
  requireString(row, "severity", location);
  requireString(row, "source", location);
  requireString(row, "mode", location);
  requireBoolean(row, "mustNotAutocorrect", location);
  requireBoolean(row, "protected", location);
  requireBoolean(row, "validWordTrap", location);

  if (!allowedCategories.has(row.category)) {
    throw new Error(`${location} has unknown category: ${row.category}`);
  }

  if (!allowedExpectedActions.has(row.expectedAction)) {
    throw new Error(`${location} has unknown expectedAction: ${row.expectedAction}`);
  }

  if (!allowedSeverities.has(row.severity)) {
    throw new Error(`${location} has unknown severity: ${row.severity}`);
  }

  if (!allowedSources.has(row.source)) {
    throw new Error(`${location} has unknown source: ${row.source}`);
  }

  if (!allowedModes.has(row.mode)) {
    throw new Error(`${location} has unknown mode: ${row.mode}`);
  }

  if (!Array.isArray(row.surfaceApplicability) || row.surfaceApplicability.length === 0) {
    throw new Error(`${location} must include non-empty surfaceApplicability.`);
  }

  for (const surface of row.surfaceApplicability) {
    if (!allowedSurfaces.has(surface)) {
      throw new Error(`${location} has unknown surfaceApplicability: ${surface}`);
    }
  }

  if (row.expectedAction === "auto_correct") {
    requireString(row, "expectedReplacement", location);
  }

  if (row.expectedSuggestions !== undefined) {
    requireStringArray(row, "expectedSuggestions", location);
  }

  if (row.notes !== undefined && typeof row.notes !== "string") {
    throw new Error(`${location}.notes must be a string when present.`);
  }

  if (row.expectedLatencyBudget !== undefined) {
    if (
      row.expectedLatencyBudget === null ||
      typeof row.expectedLatencyBudget !== "object" ||
      Array.isArray(row.expectedLatencyBudget)
    ) {
      throw new Error(`${location}.expectedLatencyBudget must be an object when present.`);
    }

    for (const [key, value] of Object.entries(row.expectedLatencyBudget)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`${location}.expectedLatencyBudget.${key} must be a non-negative number.`);
      }
    }
  }

  return row;
}

export function countByCategory(rows) {
  const counts = Object.fromEntries(corpusCategories.map((category) => [category, 0]));

  for (const row of rows) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }

  return counts;
}

function requireString(row, field, location) {
  if (typeof row[field] !== "string" || row[field].length === 0) {
    throw new Error(`${location}.${field} must be a non-empty string.`);
  }
}

function requireBoolean(row, field, location) {
  if (typeof row[field] !== "boolean") {
    throw new Error(`${location}.${field} must be a boolean.`);
  }
}

function requireStringArray(row, field, location) {
  if (!Array.isArray(row[field]) || row[field].some((value) => typeof value !== "string")) {
    throw new Error(`${location}.${field} must be an array of strings.`);
  }
}
