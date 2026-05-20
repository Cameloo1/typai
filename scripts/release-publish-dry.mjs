import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { releasePackages } from "./release-config.mjs";

run("node", ["scripts/release-check.mjs"]);
run("node", ["scripts/scan-package-secrets.mjs"]);

const approval = readApproval();
const expectedVersion = approval.approvedVersion;
const distTag = approval.approvedDistTag;
const approvedOrder = approval.approvedPublishOrder;

if (distTag === "latest") {
  throw new Error("Refusing beta publish dry-run with npm latest dist-tag.");
}

if (
  !sameStringArray(
    approvedOrder,
    releasePackages.map((pkg) => pkg.name),
  )
) {
  throw new Error("Approved publish order does not match release package order.");
}

console.log("Publish dry-run only. No npm publish command was executed.");
console.log(`Approved version: ${expectedVersion}`);
console.log(`Approved npm dist-tag: ${distTag}`);
console.log("Publish order preview:");

for (const pkg of releasePackages) {
  const packageJson = readPackageJson(pkg.directory);
  if (packageJson.name !== pkg.name) {
    throw new Error(`Package name mismatch for ${pkg.directory}: expected ${pkg.name}.`);
  }

  if (packageJson.version !== expectedVersion) {
    throw new Error(
      `${pkg.name} version ${packageJson.version} does not match approved version ${expectedVersion}.`,
    );
  }

  if (packageJson.private === true) {
    throw new Error(`${pkg.name} is private and must not be included in the publish set.`);
  }

  const accessArgs = pkg.name.startsWith("@") ? " --access public" : "";
  console.log(`- ${pkg.name} (${pkg.role})`);
  console.log(`  npm publish ${pkg.directory} --tag ${distTag}${accessArgs} --dry-run`);
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: resolve("."),
    stdio: "inherit",
    env: createCommandEnv(),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readApproval() {
  const record = JSON.parse(readFileSync("release/beta-approval.json", "utf8"));
  const manualApproval = record.manualApproval ?? {};

  if (manualApproval.approvalStatus !== "approved") {
    throw new Error("release:publish:dry requires approved beta publish approval.");
  }

  const requiredFields = [
    "approvedVersion",
    "approvedDistTag",
    "approvedPublishOrder",
    "approvedAssetStatus",
    "approvedRollbackPlan",
  ];
  for (const field of requiredFields) {
    if (manualApproval[field] == null || manualApproval[field] === "") {
      throw new Error(`Manual approval is missing ${field}.`);
    }
  }

  if (!/blocked/i.test(manualApproval.approvedAssetStatus)) {
    throw new Error("Manual approval must acknowledge blocked production asset status.");
  }

  if (!/host-provided/i.test(manualApproval.approvedAssetStatus)) {
    throw new Error("Manual approval must acknowledge host-provided-only asset status.");
  }

  return manualApproval;
}

function readPackageJson(directory) {
  return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function resolveCommand(command, args) {
  if (command === "node") {
    return { command: process.execPath, args };
  }

  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `${command}.cmd`, ...args],
    };
  }

  return { command, args };
}

function createCommandEnv() {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const currentPath = process.env[pathKey] ?? process.env.PATH ?? "";
  const localBins = [resolve(".codex-tools"), resolve("node_modules", ".bin")];

  return {
    ...process.env,
    [pathKey]: [...localBins, currentPath].filter(Boolean).join(delimiter),
  };
}
