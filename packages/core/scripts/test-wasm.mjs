import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgRoot = resolve(packageRoot, "pkg");
const jsPath = resolve(pkgRoot, "typai_wasm.js");
const wasmPath = resolve(pkgRoot, "typai_wasm_bg.wasm");

if (!existsSync(jsPath) || !existsSync(wasmPath)) {
  throw new Error("Missing packages/core/pkg. Run pnpm --filter @typai/core build:wasm first.");
}

const wasm = await import(pathToFileURL(jsPath).href);
await wasm.default({ module_or_path: await readFile(wasmPath) });

const cases = [
  ["teh", { code: 1, replacement: "the" }],
  ["the", { code: 0, replacement: "" }],
  ["zzzzword", { code: 2, replacement: "" }],
  ["user@example.com", { code: 0, replacement: "" }],
];

for (const [token, expected] of cases) {
  const actual = wasm.check_token(token);

  if (actual.code !== expected.code || actual.replacement !== expected.replacement) {
    throw new Error(
      `Unexpected check_token(${JSON.stringify(token)}) result: ${JSON.stringify(actual)}`,
    );
  }

  if (typeof actual.confidence !== "number" || typeof actual.reasonFlags !== "number") {
    throw new Error(`Malformed check_token(${JSON.stringify(token)}) result`);
  }
}

const suggestionCases = [
  ["reciept", "receipt"],
  ["adress", "address"],
  ["corection", "correction"],
  ["speling", "spelling"],
];

for (const [token, expectedSuggestion] of suggestionCases) {
  const actual = wasm.suggest_token(token, 4);

  if (!Array.isArray(actual.suggestions) || !actual.suggestions.includes(expectedSuggestion)) {
    throw new Error(
      `Unexpected suggest_token(${JSON.stringify(token)}) result: ${JSON.stringify(actual)}`,
    );
  }

  if (!Array.isArray(actual.scores) || typeof actual.reasonFlags !== "number") {
    throw new Error(`Malformed suggest_token(${JSON.stringify(token)}) result`);
  }
}

console.log("Typai Wasm smoke test passed.");
