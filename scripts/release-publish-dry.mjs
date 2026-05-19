import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { releasePackages } from "./release-config.mjs";

run("node", ["scripts/release-check.mjs"]);
run("node", ["scripts/scan-package-secrets.mjs"]);

console.log("Publish dry-run only. No npm publish command was executed.");
console.log("Manual approval is required before any registry publish.");
console.log("Publish order preview:");

for (const pkg of releasePackages) {
  console.log(`- ${pkg.name} (${pkg.role})`);
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
