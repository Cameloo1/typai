import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";

const packages = [
  { name: "@typai/core", directory: "packages/core" },
  { name: "@typai/contenteditable", directory: "packages/contenteditable" },
  { name: "@typai/textarea", directory: "packages/textarea" },
  { name: "@typai/ui", directory: "packages/ui" },
  { name: "@typai/react", directory: "packages/react" },
  { name: "@typai/codemirror", directory: "packages/codemirror" },
  { name: "@typai/completion-remote", directory: "packages/completion-remote" },
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

  validatePackedFiles(pkg, cwd, files);

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

function validatePackedFiles(pkg, cwd, files) {
  const forbiddenPrefixes = [
    "api/",
    "src/",
    "server/",
    "test/",
    "tests/",
    "coverage/",
    "examples/",
    "playwright-report/",
    "reports/",
    "routes/",
    "test-results/",
  ];

  for (const file of files) {
    if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
      throw new Error(`${pkg.name} dry-run includes forbidden package file: ${file}`);
    }
  }

  validatePackedMetadata(pkg, cwd, files);
  validatePackedSecrets(pkg, cwd, files);

  if (
    pkg.name === "@typai/react" ||
    pkg.name === "@typai/codemirror" ||
    pkg.name === "@typai/ui" ||
    pkg.name === "@typai/completion-remote"
  ) {
    for (const requiredFile of ["dist/index.js", "dist/index.d.ts", "README.md"]) {
      if (!files.includes(requiredFile)) {
        throw new Error(`${pkg.name} dry-run is missing ${requiredFile}`);
      }
    }
  }
}

function validatePackedMetadata(pkg, cwd, files) {
  if (!files.includes("package.json")) {
    throw new Error(`${pkg.name} dry-run is missing package.json`);
  }

  const packageJson = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  const serializedPackage = JSON.stringify(packageJson);
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };

  if (/api[_-]?key|private[_-]?key|provider[_-]?key|OPENAI_API_KEY/i.test(serializedPackage)) {
    throw new Error(`${pkg.name} dry-run metadata contains private provider-key wording.`);
  }

  if (Object.keys(dependencies).some((dependencyName) => /^openai$/i.test(dependencyName))) {
    throw new Error(`${pkg.name} dry-run metadata must not include an OpenAI SDK dependency.`);
  }
}

function validatePackedSecrets(pkg, cwd, files) {
  const inspectableFiles = files.filter(
    (file) =>
      !file.toLowerCase().endsWith("readme.md") &&
      /\.(?:cjs|cts|d\.ts|js|json|mjs|mts|ts)$/.test(file),
  );

  for (const file of inspectableFiles) {
    const contents = readFileSync(resolve(cwd, file), "utf8");

    if (/\bOPENAI_API_KEY\b/i.test(contents) || /\bsk-[A-Za-z0-9_-]{8,}\b/.test(contents)) {
      throw new Error(`${pkg.name} dry-run includes provider secret-like content in ${file}`);
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
