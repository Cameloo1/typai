import { resolve } from "node:path";

import { assetsRoot, mockFixtureEntries, writeDictionaryAsset } from "./dictionary-asset-utils.mjs";

const binaryPath = resolve(assetsRoot, "mock-en-us.dictionary.bin");
const metaPath = resolve(assetsRoot, "mock-en-us.dictionary.json");

const { meta } = writeDictionaryAsset({
  entries: [...mockFixtureEntries].sort(([left], [right]) => left.localeCompare(right, "en-US")),
  binaryPath,
  metaPath,
  assetKind: "tiny-mock",
  note: "Generated mock fixture for loader tests only. Not a production dictionary asset.",
});

console.log(`Generated ${binaryPath}`);
console.log(`Generated ${metaPath}`);
console.log(`Mock dictionary words: ${meta.generatedWordCount}`);
