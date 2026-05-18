import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";

const repoRoot = resolve(".");
const smokeRoot = mkdtempSync(join(tmpdir(), "typai-package-smoke-"));
const tarballRoot = join(smokeRoot, "tarballs");
const appRoot = join(smokeRoot, "app");

try {
  run("node", ["scripts/pack-local.mjs"], repoRoot);

  const packedCore = resolve(".pack", "typai-core-0.0.0-dev.tgz");
  const packedContenteditable = resolve(".pack", "typai-contenteditable-0.0.0-dev.tgz");
  const packedTextarea = resolve(".pack", "typai-textarea-0.0.0-dev.tgz");
  const packedUi = resolve(".pack", "typai-ui-0.0.0-dev.tgz");
  const packedReact = resolve(".pack", "typai-react-0.0.0-dev.tgz");
  const localReact = resolve("packages/react/node_modules/react");
  const localReactDom = resolve("packages/react/node_modules/react-dom");

  mkdirSync(tarballRoot, { recursive: true });
  copyFileSync(packedCore, join(tarballRoot, basename(packedCore)));
  copyFileSync(packedContenteditable, join(tarballRoot, basename(packedContenteditable)));
  copyFileSync(packedTextarea, join(tarballRoot, basename(packedTextarea)));
  copyFileSync(packedUi, join(tarballRoot, basename(packedUi)));
  copyFileSync(packedReact, join(tarballRoot, basename(packedReact)));
  mkdirSync(appRoot, { recursive: true });

  writeFileSync(
    join(appRoot, "package.json"),
    `${JSON.stringify({ name: "typai-package-smoke", private: true, type: "module" }, null, 2)}\n`,
  );

  run(
    "npm",
    [
      "install",
      "--legacy-peer-deps",
      "--ignore-scripts",
      join(tarballRoot, basename(packedCore)),
      join(tarballRoot, basename(packedContenteditable)),
      join(tarballRoot, basename(packedTextarea)),
      join(tarballRoot, basename(packedUi)),
      join(tarballRoot, basename(packedReact)),
      localReact,
      localReactDom,
    ],
    appRoot,
  );

  writeFileSync(
    join(appRoot, "smoke.mjs"),
    [
      'import { readFileSync } from "node:fs";',
      'import { createTypaiCore } from "@typai/core";',
      'import { attachContenteditable } from "@typai/contenteditable";',
      'import { attachTextarea } from "@typai/textarea";',
      'import * as TypaiReact from "@typai/react";',
      "",
      "class SmokeTextarea extends EventTarget {",
      '  nodeName = "TEXTAREA";',
      '  value = "";',
      "  selectionStart = 0;",
      "  selectionEnd = 0;",
      "  setSelectionRange(selectionStart, selectionEnd) {",
      "    this.selectionStart = selectionStart;",
      "    this.selectionEnd = selectionEnd;",
      "  }",
      "}",
      "",
      "const typai = await createTypaiCore();",
      'const decision = typai.checkCompletedToken({ token: "teh" });',
      "",
      'if (decision.action !== "auto_correct" || decision.replacement !== "the") {',
      '  throw new Error("Expected teh -> the auto_correct, got " + JSON.stringify(decision));',
      "}",
      "",
      'if (typeof attachContenteditable !== "function") {',
      '  throw new Error("Expected @typai/contenteditable to export attachContenteditable.");',
      "}",
      "",
      'if (typeof attachTextarea !== "function") {',
      '  throw new Error("Expected @typai/textarea to export attachTextarea.");',
      "}",
      "",
      'if (typeof TypaiReact.TypaiProvider !== "function") {',
      '  throw new Error("Expected @typai/react to export TypaiProvider.");',
      "}",
      "",
      'if (typeof TypaiReact.useTypaiCore !== "function") {',
      '  throw new Error("Expected @typai/react to export useTypaiCore.");',
      "}",
      "",
      "if (TypaiReact.TypaiTextarea === undefined) {",
      '  throw new Error("Expected @typai/react to export TypaiTextarea.");',
      "}",
      "",
      'if ("TypaiGhostText" in TypaiReact || "createCompletionRemote" in TypaiReact) {',
      '  throw new Error("Unexpected remote completion export from @typai/react.");',
      "}",
      "",
      "const corePackageJson = JSON.parse(",
      '  readFileSync("node_modules/@typai/core/package.json", "utf8"),',
      ");",
      "",
      "if (corePackageJson.dependencies?.react || corePackageJson.peerDependencies?.react) {",
      '  throw new Error("React must not be a dependency or peerDependency of @typai/core.");',
      "}",
      "",
      "const textarea = new SmokeTextarea();",
      "const detach = attachTextarea({ textarea, typai, overlay: { enabled: false } });",
      'textarea.value = "teh ";',
      "textarea.selectionStart = textarea.value.length;",
      "textarea.selectionEnd = textarea.value.length;",
      'const input = new Event("input");',
      'Object.defineProperty(input, "data", { value: " " });',
      "textarea.dispatchEvent(input);",
      "",
      'if (textarea.value !== "the ") {',
      '  throw new Error("Expected textarea smoke to correct teh -> the, got " + textarea.value);',
      "}",
      "",
      "detach();",
      "",
      'console.log("typai package install smoke passed.");',
      "",
    ].join("\n"),
  );

  run("node", ["smoke.mjs"], appRoot);
} finally {
  rmSync(smokeRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd,
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
