import { validateDictionaryAsset } from "./dictionary-asset-utils.mjs";

const validation = validateDictionaryAsset();

console.log("Validated Typai scaled mock dictionary asset.");
console.log(`words: ${validation.wordCount}`);
console.log(`bytes: ${validation.byteLength}`);
console.log(`sha256: ${validation.sha256}`);
console.log(`mockOnly: ${validation.mockOnly}`);
console.log(`production: ${validation.production}`);
