import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const packages = [
  { name: "@typai/core", directory: "packages/core" },
  { name: "@typai/contenteditable", directory: "packages/contenteditable" },
  { name: "@typai/textarea", directory: "packages/textarea" },
];

for (const pkg of packages) {
  const cwd = resolve(pkg.directory);
  const npmCommand = resolveCommand("npm", ["pack", "--dry-run", "--json"]);
  const result = spawnSync(npmCommand.command, npmCommand.args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? result.error?.message ?? "");
    process.exit(result.status ?? 1);
  }

  const packed = parsePackJson(result.stdout)[0];

  console.log(`\n${pkg.name} dry-run tarball`);
  console.log(`filename: ${packed.filename}`);
  console.log(`files: ${packed.files.length}`);

  for (const file of packed.files) {
    console.log(`- ${file.path}`);
  }

  if (result.stderr.trim().length > 0) {
    process.stderr.write(result.stderr);
  }
}

console.log(
  "\nDry run complete. Local install smoke uses pnpm pack so workspace dependencies are normalized for tarball consumers.",
);

function parsePackJson(stdout) {
  const match = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/);

  if (match === null) {
    throw new Error(`Could not find npm pack JSON output:\n${stdout}`);
  }

  return JSON.parse(match[0]);
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
