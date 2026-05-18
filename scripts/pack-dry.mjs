import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";

const packages = [
  { name: "@typai/core", directory: "packages/core" },
  { name: "@typai/contenteditable", directory: "packages/contenteditable" },
  { name: "@typai/textarea", directory: "packages/textarea" },
  { name: "@typai/ui", directory: "packages/ui" },
  { name: "@typai/react", directory: "packages/react" },
];

for (const pkg of packages) {
  const cwd = resolve(pkg.directory);
  const npmCommand = resolveCommand("npm", ["pack", "--dry-run", "--json"]);
  const result = spawnSync(npmCommand.command, npmCommand.args, {
    cwd,
    encoding: "utf8",
    env: createCommandEnv(),
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? result.error?.message ?? "");
    process.exit(result.status ?? 1);
  }

  const packed = parsePackJson(result.stdout)[0];
  const files = packed.files.map((file) => file.path);

  validatePackedFiles(pkg, files);

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

function validatePackedFiles(pkg, files) {
  const forbiddenPrefixes = [
    "src/",
    "test/",
    "tests/",
    "coverage/",
    "playwright-report/",
    "test-results/",
  ];

  for (const file of files) {
    if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
      throw new Error(`${pkg.name} dry-run includes forbidden package file: ${file}`);
    }
  }

  if (pkg.name === "@typai/react" || pkg.name === "@typai/ui") {
    for (const requiredFile of ["dist/index.js", "dist/index.d.ts", "README.md"]) {
      if (!files.includes(requiredFile)) {
        throw new Error(`${pkg.name} dry-run is missing ${requiredFile}`);
      }
    }
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
