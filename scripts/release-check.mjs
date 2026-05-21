import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import {
  privateWorkspacePackages,
  releasePackageNames,
  releasePackages,
  repositoryUrl,
  requiredReleaseScripts,
} from "./release-config.mjs";

const failures = [];
const rootPackage = readJson("package.json");

if (rootPackage.private !== true) {
  failures.push("Root package must remain private.");
}

for (const scriptName of requiredReleaseScripts) {
  if (typeof rootPackage.scripts?.[scriptName] !== "string") {
    failures.push(`Root package is missing script: ${scriptName}`);
  }
}

if (typeof rootPackage.scripts?.publish === "string") {
  failures.push("Root package must not expose a bare publish script.");
}

for (const pkg of releasePackages) {
  validateReleasePackage(pkg);
}

for (const packageJsonPath of findWorkspacePackageJsons()) {
  const manifest = readJson(packageJsonPath);

  if (releasePackageNames.includes(manifest.name)) {
    continue;
  }

  if (privateWorkspacePackages.includes(manifest.name) && manifest.private !== true) {
    failures.push(`${manifest.name} must remain private.`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Release check passed.");
console.log(`Public packages: ${releasePackages.filter((pkg) => pkg.role === "public").length}`);
console.log(`Support packages: ${releasePackages.filter((pkg) => pkg.role === "support").length}`);
console.log("Support package note: @typai/ui is packed because public packages depend on it.");

function validateReleasePackage(pkg) {
  const manifestPath = join(pkg.directory, "package.json");
  const manifest = readJson(manifestPath);

  if (manifest.name !== pkg.name) {
    failures.push(`${pkg.directory} has name ${manifest.name}, expected ${pkg.name}.`);
  }

  if (manifest.private !== false) {
    failures.push(`${pkg.name} must have private=false for release packaging.`);
  }

  for (const field of ["version", "description", "license", "main", "module", "types"]) {
    if (typeof manifest[field] !== "string" || manifest[field].trim().length === 0) {
      failures.push(`${pkg.name} is missing package metadata field: ${field}`);
    }
  }

  if (manifest.license !== "UNLICENSED") {
    failures.push(`${pkg.name} must use UNLICENSED until a project license is selected.`);
  }

  if (
    manifest.repository?.type !== "git" ||
    manifest.repository?.url !== repositoryUrl ||
    manifest.repository?.directory !== pkg.directory
  ) {
    failures.push(`${pkg.name} repository metadata must point to ${pkg.directory}.`);
  }

  if (manifest.exports?.["."]?.types !== manifest.types) {
    failures.push(`${pkg.name} export types must match package types.`);
  }

  if (manifest.exports?.["."]?.import !== manifest.module) {
    failures.push(`${pkg.name} export import must match package module.`);
  }

  if (manifest.types !== "./dist/index.d.ts") {
    failures.push(`${pkg.name} package types must be ./dist/index.d.ts.`);
  }

  if (manifest.main !== "./dist/index.js" || manifest.module !== "./dist/index.js") {
    failures.push(`${pkg.name} main/module must point at ./dist/index.js.`);
  }

  if (!Array.isArray(manifest.files)) {
    failures.push(`${pkg.name} must define package files.`);
  } else {
    for (const requiredFile of pkg.requiredFiles) {
      if (!manifest.files.includes(requiredFile)) {
        failures.push(`${pkg.name} package files must include ${requiredFile}.`);
      }
    }
  }

  if (manifest.sideEffects !== false) {
    failures.push(`${pkg.name} must set sideEffects=false.`);
  }

  if (!existsSync(join(pkg.directory, "README.md"))) {
    failures.push(`${pkg.name} must include a package README.md.`);
  }

  const peerDependencyNames = Object.keys(manifest.peerDependencies ?? {});
  for (const peerDependency of pkg.peerDependencies) {
    if (!peerDependencyNames.includes(peerDependency)) {
      failures.push(`${pkg.name} is missing peer dependency ${peerDependency}.`);
    }
  }

  if (pkg.peerDependencies.length === 0 && peerDependencyNames.length > 0) {
    failures.push(`${pkg.name} should not define peer dependencies.`);
  }

  const allDependencies = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  };

  if (Object.keys(allDependencies).some((dependencyName) => /^openai$/i.test(dependencyName))) {
    failures.push(`${pkg.name} must not depend on the OpenAI SDK.`);
  }

  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    if (dependencyName.startsWith("@typai/") && !releasePackageNames.includes(dependencyName)) {
      failures.push(`${pkg.name} depends on non-release package ${dependencyName}.`);
    }
  }

  if (pkg.requiresWasm) {
    for (const wasmFile of ["pkg/typai_wasm.js", "pkg/typai_wasm_bg.wasm"]) {
      if (!existsSync(join(pkg.directory, wasmFile))) {
        failures.push(`${pkg.name} is missing generated Wasm output ${wasmFile}.`);
      }
    }
  }

  validatePackedFiles(pkg);
}

function validatePackedFiles(pkg) {
  const result = runPackDry(pkg.directory);
  const packed = parsePackJson(result.stdout)[0];
  const files = packed.files.map((file) => file.path);

  for (const requiredPackedFile of pkg.requiredPackedFiles) {
    if (!files.includes(requiredPackedFile)) {
      failures.push(`${pkg.name} packed output is missing ${requiredPackedFile}.`);
    }
  }

  const forbiddenPrefixes = [
    "api/",
    "coverage/",
    "examples/",
    "playwright-report/",
    "reports/",
    "routes/",
    "server/",
    "src/",
    "test/",
    "tests/",
    "test-results/",
  ];

  for (const file of files) {
    if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
      failures.push(`${pkg.name} packed output includes forbidden file: ${file}`);
    }

    if (file.toLowerCase().includes(".env")) {
      failures.push(`${pkg.name} packed output includes env-like file: ${file}`);
    }
  }
}

function runPackDry(cwd) {
  const npmCommand = resolveCommand("npm", ["pack", "--dry-run", "--json"]);
  const result = spawnSync(npmCommand.command, npmCommand.args, {
    cwd: resolve(cwd),
    encoding: "utf8",
    env: createCommandEnv(),
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? result.error?.message ?? "");
    process.exit(result.status ?? 1);
  }

  return result;
}

function parsePackJson(stdout) {
  const match = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/);

  if (match === null) {
    throw new Error(`Could not find npm pack JSON output:\n${stdout}`);
  }

  return JSON.parse(match[0]);
}

function findWorkspacePackageJsons() {
  const roots = ["packages", "examples", "tests"];
  const paths = [];

  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    for (const entry of readdirSync(root)) {
      const packageJson = join(root, entry, "package.json");

      if (existsSync(packageJson) && statSync(packageJson).isFile()) {
        paths.push(packageJson);
      }
    }
  }

  return paths;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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
