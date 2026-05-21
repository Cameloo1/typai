import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releasePackages } from "./release-config.mjs";

const targetVersion = process.env.TYPAI_RELEASE_VERSION ?? "0.0.0-beta.0";
const versions = new Map();

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(targetVersion)) {
  throw new Error(`Invalid TYPAI_RELEASE_VERSION: ${targetVersion}`);
}

for (const pkg of releasePackages) {
  const manifest = JSON.parse(readFileSync(join(pkg.directory, "package.json"), "utf8"));
  versions.set(pkg.name, manifest.version);
}

const currentVersions = new Set(versions.values());

if (currentVersions.size !== 1) {
  throw new Error(
    `Release packages must start from one version. Found: ${[...currentVersions].join(", ")}`,
  );
}

console.log("Version dry-run only. No files were changed.");
console.log(`Current version: ${[...currentVersions][0]}`);
console.log(`Target version: ${targetVersion}`);

for (const pkg of releasePackages) {
  console.log(`- would set ${pkg.name} to ${targetVersion}`);
}
