import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { delimiter, resolve } from "node:path";

const outputDirectory = resolve(".pack");
const packages = [
  "@typai/core",
  "@typai/contenteditable",
  "@typai/textarea",
  "@typai/ui",
  "@typai/react",
];

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

for (const packageName of packages) {
  run("pnpm", ["--filter", packageName, "pack", "--pack-destination", outputDirectory]);
}

console.log(`Local package tarballs written to ${outputDirectory}`);

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
