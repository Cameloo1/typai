import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";

run("node", ["scripts/release-check.mjs"]);
run("pnpm", ["bench:language-asset"]);
run("pnpm", ["package:size-report"]);
run("pnpm", ["bench:spell-quality"]);
run("pnpm", ["scan:package-secrets"]);
run("pnpm", ["smoke:install"]);
run("pnpm", ["smoke:public-beta"]);
run("node", ["scripts/pack-local.mjs"]);

console.log("Release pack dry-run complete. No package was published.");

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
