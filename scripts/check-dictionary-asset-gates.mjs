import { existsSync, readFileSync } from "node:fs";

const manifestPath = "packages/core/assets/production/MANIFEST.json";
const blockersPath = "docs/dictionary-asset-blockers.md";

if (!existsSync(manifestPath)) {
  console.error(`Dictionary gate status: missing manifest at ${manifestPath}.`);
  process.exit(1);
}

let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  console.error(`Dictionary gate status: invalid manifest JSON: ${error.message}`);
  process.exit(1);
}

const blockerText = existsSync(blockersPath) ? readFileSync(blockersPath, "utf8") : "";
const blockerCount = (blockerText.match(/^### /gm) ?? []).length;

console.log("Production language asset gate status");
console.log(`- phase: Production Asset Unblock`);
console.log(`- review status: ${manifest.review?.status ?? "unknown"}`);
console.log(`- reviewer: ${manifest.review?.reviewer ?? "unknown"}`);
console.log(`- reviewed at: ${manifest.review?.reviewedAt ?? "unknown"}`);
console.log(
  `- dictionary: ${manifest.dictionary?.name ?? "unknown"} (${sourceHashStatus(
    manifest.dictionary,
  )})`,
);
console.log(
  `- frequency: ${manifest.frequency?.name ?? "unknown"} (${sourceHashStatus(manifest.frequency)})`,
);
console.log(`- package inclusion: ${manifest.output?.packageInclusion ?? "unknown"}`);
console.log(
  `- generated output: ${manifest.output?.assetPath ? manifest.output.assetPath : "none"}`,
);
console.log(`- blockers documented: ${blockerCount}`);
console.log(
  manifest.review?.status === "blocked"
    ? "- result: blocked fail-closed; host-provided dictionary blob path remains the fallback"
    : "- result: approved by manifest; packaging still follows package inclusion policy",
);

function sourceHashStatus(source) {
  if (!source || !Array.isArray(source.sourceFiles)) {
    return "hash status unknown";
  }

  const total = source.sourceFiles.length;
  const hashed = source.sourceFiles.filter((entry) => entry.sha256).length;

  if (source.sha256 && hashed === total) {
    return "all source hashes pinned";
  }

  if (hashed > 0) {
    return `${hashed}/${total} source hashes pinned`;
  }

  return "source hashes missing";
}
