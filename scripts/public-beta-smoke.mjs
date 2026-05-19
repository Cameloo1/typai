import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { publicPackageNames, releasePackages } from "./release-config.mjs";

const repoRoot = resolve(".");
const smokeRoot = mkdtempSync(join(tmpdir(), "typai-public-beta-smoke-"));
const tarballRoot = join(smokeRoot, "tarballs");
const keepTemp =
  process.env.TYPAI_KEEP_PUBLIC_BETA_SMOKE === "1" ||
  process.env.TYPAI_DEBUG_PUBLIC_BETA_SMOKE === "1";

const runtimeScenarios = [
  "import package",
  "run minimal correction",
  "run minimal completion with mock provider",
  "run endpoint completion against mock proxy",
  "verify no core -> completion dependency",
  "verify no browser API key path",
  "verify package artifacts contain expected files only",
];
const results = [];

try {
  run("node", ["scripts/pack-local.mjs"], repoRoot);
  copyPackedTarballs();

  record("runtime package matrix", runRuntimePackageMatrix);
  record("vanilla Vite app", () => buildViteApp("vanilla-vite-app", createVanillaViteAppFiles()));
  record("React Vite app", () => buildViteApp("react-vite-app", createReactViteAppFiles()));
  record("CodeMirror consumer app", () =>
    buildViteApp("codemirror-consumer-app", createCodeMirrorViteAppFiles()),
  );
  record("provider proxy mock app", () =>
    buildViteApp("provider-proxy-mock-app", createProviderProxyMockAppFiles()),
  );

  printSummary();
} finally {
  if (keepTemp) {
    console.log(`Public beta smoke temp root kept at ${smokeRoot}`);
  } else {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}

function record(name, task) {
  const startedAt = performance.now();

  try {
    task();
    results.push({
      durationMs: Math.round(performance.now() - startedAt),
      name,
      status: "passed",
    });
  } catch (error) {
    results.push({
      durationMs: Math.round(performance.now() - startedAt),
      name,
      status: "failed",
    });
    throw error;
  }
}

function copyPackedTarballs() {
  mkdirSync(tarballRoot, { recursive: true });

  for (const pkg of releasePackages) {
    const source = resolve(".pack", getPackedTarballName(pkg.name));

    if (!existsSync(source)) {
      throw new Error(`Missing packed tarball for ${pkg.name}: ${source}`);
    }

    copyFileSync(source, join(tarballRoot, basename(source)));
  }
}

function runRuntimePackageMatrix() {
  const appRoot = createTempApp("runtime-package-matrix");

  writeFileSync(join(appRoot, "public-beta-runtime-smoke.mjs"), createRuntimeSmokeScript());
  run("node", ["public-beta-runtime-smoke.mjs"], appRoot);
}

function buildViteApp(name, files) {
  const appRoot = createTempApp(name);

  for (const [path, contents] of Object.entries(files)) {
    const filePath = join(appRoot, path);
    mkdirSync(resolve(filePath, ".."), { recursive: true });
    writeFileSync(filePath, contents);
  }

  run("node", [resolve("node_modules/vite/bin/vite.js"), "build"], appRoot);
}

function createTempApp(name) {
  const appRoot = join(smokeRoot, name);

  mkdirSync(appRoot, { recursive: true });
  writeFileSync(
    join(appRoot, "package.json"),
    `${JSON.stringify({ name: `typai-${name}`, private: true, type: "module" }, null, 2)}\n`,
  );

  run(
    "npm",
    [
      "install",
      "--legacy-peer-deps",
      "--ignore-scripts",
      ...releasePackages.map((pkg) => join(tarballRoot, getPackedTarballName(pkg.name))),
      resolve("packages/react/node_modules/react"),
      resolve("packages/react/node_modules/react-dom"),
    ],
    appRoot,
  );

  linkPackage(
    appRoot,
    "@codemirror",
    "language",
    resolve("packages/codemirror/node_modules/@codemirror/language"),
  );
  linkPackage(
    appRoot,
    "@codemirror",
    "state",
    resolve("packages/codemirror/node_modules/@codemirror/state"),
  );
  linkPackage(
    appRoot,
    "@codemirror",
    "view",
    resolve("packages/codemirror/node_modules/@codemirror/view"),
  );

  return appRoot;
}

function createRuntimeSmokeScript() {
  return [
    'import { createServer } from "node:http";',
    'import { readdirSync, readFileSync, statSync } from "node:fs";',
    'import { join } from "node:path";',
    'import * as React from "react";',
    'import { createTypaiCore } from "@typai/core";',
    'import { attachContenteditable } from "@typai/contenteditable";',
    'import { attachTextarea } from "@typai/textarea";',
    'import * as TypaiReact from "@typai/react";',
    'import * as TypaiCodeMirror from "@typai/codemirror";',
    "import {",
    "  createEndpointCompletionProvider,",
    "  createMockCompletionProvider,",
    "  createRemoteCompletion,",
    '} from "@typai/completion-remote";',
    "",
    "const publicPackageNames = [",
    ...publicPackageNames.map((name) => `  ${JSON.stringify(name)},`),
    "];",
    "const releasePackages = [",
    ...releasePackages.map(
      (pkg) =>
        `  ${JSON.stringify({
          files: pkg.requiredFiles,
          name: pkg.name,
          requiredPackedFiles: pkg.requiredPackedFiles,
        })},`,
    ),
    "];",
    "",
    "for (const packageName of publicPackageNames) {",
    "  await import(packageName);",
    "}",
    "",
    'assert(typeof createTypaiCore === "function", "Expected createTypaiCore import.");',
    'assert(typeof attachContenteditable === "function", "Expected attachContenteditable import.");',
    'assert(typeof attachTextarea === "function", "Expected attachTextarea import.");',
    'assert(typeof TypaiReact.TypaiProvider === "function", "Expected TypaiProvider import.");',
    'assert(TypaiReact.TypaiTextarea !== undefined, "Expected TypaiTextarea import.");',
    'assert(TypaiReact.TypaiContenteditable !== undefined, "Expected TypaiContenteditable import.");',
    'assert(typeof TypaiCodeMirror.createTypaiCodeMirrorExtension === "function", "Expected CodeMirror extension import.");',
    'assert(typeof createRemoteCompletion === "function", "Expected createRemoteCompletion import.");',
    'assert(typeof createMockCompletionProvider === "function", "Expected mock completion provider import.");',
    'assert(typeof createEndpointCompletionProvider === "function", "Expected endpoint completion provider import.");',
    "",
    "const typai = await createTypaiCore();",
    'const correction = typai.checkCompletedToken({ token: "teh" });',
    'assert(correction.action === "auto_correct", "Expected minimal correction to auto-correct teh.");',
    'assert(correction.replacement === "the", "Expected teh -> the replacement.");',
    "",
    'const mockProvider = createMockCompletionProvider(" world");',
    "const remote = createRemoteCompletion({",
    "  provider: mockProvider,",
    "  debounceMs: 0,",
    "  minPrefixChars: 1,",
    "  maxCompletionChars: 80,",
    "});",
    "remote.schedule({",
    '  mode: "prompt",',
    '  contextBefore: "hello",',
    '  contextAfter: "",',
    '  currentLine: "hello",',
    "  cursorOffset: 5,",
    "});",
    'await waitForRemoteState(remote, "showing");',
    'assert(remote.getState().text === " world", "Expected deterministic mock completion text.");',
    "remote.destroy();",
    "",
    "const endpointServer = createMockProxyServer();",
    'await new Promise((resolve) => endpointServer.listen(0, "127.0.0.1", resolve));',
    "const address = endpointServer.address();",
    "try {",
    "  const endpointProvider = createEndpointCompletionProvider({",
    '    endpoint: "http://127.0.0.1:" + address.port + "/api/typai/completion",',
    "    timeoutMs: 1000,",
    "  });",
    "  const response = await endpointProvider.complete(createCompletionRequest(), { timeoutMs: 1000 });",
    '  assert(response.text === " proxied", "Expected endpoint mock proxy completion text.");',
    '  assert(response.model === "mock-proxy", "Expected mock proxy model metadata.");',
    "} finally {",
    "  await new Promise((resolve, reject) => {",
    "    endpointServer.close((error) => (error === undefined ? resolve() : reject(error)));",
    "  });",
    "}",
    "",
    'const corePackage = readPackageJson("@typai/core");',
    "const coreDependencies = Object.keys({",
    "  ...corePackage.dependencies,",
    "  ...corePackage.peerDependencies,",
    "  ...corePackage.optionalDependencies,",
    "});",
    'assert(!coreDependencies.includes("@typai/completion-remote"), "@typai/core must not depend on completion-remote.");',
    "",
    "for (const pkg of releasePackages) {",
    "  assertExpectedPackageFiles(pkg);",
    "  assertNoBrowserProviderKeyPath(pkg.name);",
    "}",
    "",
    'console.log("public beta runtime package matrix passed.");',
    "",
    "function createCompletionRequest() {",
    "  return {",
    '    id: "public-beta-endpoint-smoke",',
    '    mode: "prompt",',
    '    contextBefore: "hello",',
    '    contextAfter: "",',
    '    currentLine: "hello",',
    "    cursorOffset: 5,",
    "    maxCompletionChars: 80,",
    "    stopSequences: [],",
    "    instruction: {",
    '      task: "continue",',
    '      style: "same_voice",',
    '      output: "continuation_only",',
    "      constraints: [],",
    "    },",
    "  };",
    "}",
    "",
    "function createMockProxyServer() {",
    "  return createServer((request, response) => {",
    '    if (request.method !== "POST" || request.url !== "/api/typai/completion") {',
    '      response.writeHead(405, { "content-type": "application/json" });',
    '      response.end(JSON.stringify({ error: { code: "invalid_method", message: "POST JSON is required." } }));',
    "      return;",
    "    }",
    "",
    '    if (!String(request.headers["content-type"] ?? "").includes("application/json")) {',
    '      response.writeHead(415, { "content-type": "application/json" });',
    '      response.end(JSON.stringify({ error: { code: "invalid_content_type", message: "JSON is required." } }));',
    "      return;",
    "    }",
    "",
    '    let body = "";',
    '    request.setEncoding("utf8");',
    '    request.on("data", (chunk) => {',
    "      body += chunk;",
    "      if (body.length > 64 * 1024) {",
    "        request.destroy();",
    "      }",
    "    });",
    '    request.on("end", () => {',
    "      const payload = JSON.parse(body);",
    '      assert(payload.request?.contextBefore === "hello", "Expected endpoint provider request payload.");',
    "      response.writeHead(200, {",
    '        "access-control-allow-origin": "http://localhost:5173",',
    '        "content-type": "application/json",',
    "      });",
    "      response.end(JSON.stringify({",
    '        text: " proxied",',
    '        model: "mock-proxy",',
    "        usage: { inputTokens: 1, outputTokens: 1 },",
    '        finishReason: "stop",',
    "      }));",
    "    });",
    "  });",
    "}",
    "",
    "function readPackageJson(packageName) {",
    '  return JSON.parse(readFileSync(join("node_modules", ...packageName.split("/"), "package.json"), "utf8"));',
    "}",
    "",
    "function assertExpectedPackageFiles(pkg) {",
    '  const packageRoot = join("node_modules", ...pkg.name.split("/"));',
    '  const files = listFiles(packageRoot).map((file) => file.replaceAll("\\\\", "/")).sort();',
    '  const allowedEntries = new Set(["package.json", ...pkg.files]);',
    "",
    '  for (const requiredFile of ["package.json", ...pkg.requiredPackedFiles]) {',
    '    assert(files.includes(requiredFile), pkg.name + " is missing expected artifact " + requiredFile + ".");',
    "  }",
    "",
    "  for (const file of files) {",
    '    assert(!file.toLowerCase().includes(".env"), pkg.name + " contains env-like artifact " + file + ".");',
    '    assert(!/^(?:api|examples|routes|server|src|test|tests|test-results|playwright-report)\\//.test(file), pkg.name + " contains unexpected artifact " + file + ".");',
    '    const [topLevel] = file.split("/");',
    '    assert(allowedEntries.has(file) || allowedEntries.has(topLevel), pkg.name + " contains artifact outside expected package files: " + file + ".");',
    "  }",
    "}",
    "",
    "function assertNoBrowserProviderKeyPath(packageName) {",
    '  const packageRoot = join("node_modules", ...packageName.split("/"));',
    "  const inspectable = listFiles(packageRoot).filter((file) =>",
    '    /\\.(?:cjs|cts|d\\.ts|js|json|mjs|mts|ts)$/.test(file) && !file.toLowerCase().endsWith("readme.md"),',
    "  );",
    "",
    "  for (const file of inspectable) {",
    '    const contents = readFileSync(join(packageRoot, file), "utf8");',
    '    assert(!/\\bOPENAI_API_KEY\\b/i.test(contents), packageName + " exposes OPENAI_API_KEY in " + file + ".");',
    '    assert(!/\\bapi\\.openai\\.com\\b/i.test(contents), packageName + " contains a direct OpenAI endpoint in " + file + ".");',
    '    assert(!/dangerouslyAllowBrowserKey/i.test(contents), packageName + " exposes a browser key escape hatch in " + file + ".");',
    '    assert(!/\\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\\b/.test(contents), packageName + " contains provider secret-like content in " + file + ".");',
    "  }",
    "}",
    "",
    'function listFiles(root, current = "") {',
    "  const directory = current.length === 0 ? root : join(root, current);",
    "  const files = [];",
    "",
    "  for (const entry of readdirSync(directory)) {",
    "    const relativePath = current.length === 0 ? entry : join(current, entry);",
    "    const absolutePath = join(root, relativePath);",
    "",
    "    if (statSync(absolutePath).isDirectory()) {",
    "      files.push(...listFiles(root, relativePath));",
    "    } else {",
    "      files.push(relativePath);",
    "    }",
    "  }",
    "",
    "  return files;",
    "}",
    "",
    "function waitForRemoteState(controller, status) {",
    "  return new Promise((resolve, reject) => {",
    "    const timeoutId = setTimeout(() => {",
    "      unsubscribe();",
    '      reject(new Error("Timed out waiting for remote completion state " + status + "."));',
    "    }, 1000);",
    "",
    "    const unsubscribe = controller.subscribe((event) => {",
    "      if (event.state.status === status) {",
    "        clearTimeout(timeoutId);",
    "        unsubscribe();",
    "        resolve(event.state);",
    "      }",
    "    });",
    "  });",
    "}",
    "",
    "function assert(condition, message) {",
    "  if (!condition) {",
    "    throw new Error(message);",
    "  }",
    "}",
    "",
  ].join("\n");
}

function createVanillaViteAppFiles() {
  return {
    "index.html":
      '<!doctype html><div id="editor" contenteditable>Try typing teh.</div><textarea id="textarea">Try typing teh.</textarea><script type="module" src="/src/main.ts"></script>\n',
    "src/main.ts": [
      'import { attachContenteditable } from "@typai/contenteditable";',
      'import { createTypaiCore } from "@typai/core";',
      'import { attachTextarea } from "@typai/textarea";',
      "",
      'const editor = document.querySelector<HTMLElement>("#editor");',
      'const textarea = document.querySelector<HTMLTextAreaElement>("#textarea");',
      "",
      "if (editor === null || textarea === null) {",
      '  throw new Error("Missing Typai vanilla smoke elements.");',
      "}",
      "",
      "const typai = await createTypaiCore();",
      "attachContenteditable({ element: editor, typai });",
      "attachTextarea({ textarea, typai, overlay: { enabled: false } });",
      "",
    ].join("\n"),
  };
}

function createReactViteAppFiles() {
  return {
    "index.html":
      '<!doctype html><div id="root"></div><script type="module" src="/src/main.js"></script>\n',
    "src/main.js": [
      'import { createTypaiCore } from "@typai/core";',
      'import { TypaiContenteditable, TypaiProvider, TypaiTextarea } from "@typai/react";',
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      "",
      "const completion = {",
      "  onEditorInput() {},",
      "  onEditorSelectionChange() {},",
      "  onEditorBlur() {},",
      "  onEditorCompositionStart() {},",
      "  onCorrectionTransaction() {},",
      "  destroy() {},",
      "};",
      "",
      "function App() {",
      "  return React.createElement(",
      "    TypaiProvider,",
      "    { createCore: createTypaiCore },",
      '    React.createElement(TypaiTextarea, { completion, defaultValue: "Try typing teh." }),',
      "    React.createElement(",
      "      TypaiContenteditable,",
      "      { completion, spellCheck: false },",
      '      "Try typing teh.",',
      "    ),",
      "  );",
      "}",
      "",
      'const root = document.querySelector("#root");',
      "if (root === null) {",
      '  throw new Error("Missing React root.");',
      "}",
      "createRoot(root).render(React.createElement(App));",
      "",
    ].join("\n"),
  };
}

function createCodeMirrorViteAppFiles() {
  return {
    "index.html":
      '<!doctype html><div id="editor"></div><script type="module" src="/src/main.ts"></script>\n',
    "src/main.ts": [
      'import { EditorState } from "@codemirror/state";',
      'import { EditorView } from "@codemirror/view";',
      'import { createTypaiCodeMirrorExtension } from "@typai/codemirror";',
      'import { createTypaiCore } from "@typai/core";',
      "",
      'const mount = document.querySelector<HTMLElement>("#editor");',
      "if (mount === null) {",
      '  throw new Error("Missing CodeMirror mount.");',
      "}",
      "",
      "const typai = await createTypaiCore();",
      "const state = EditorState.create({",
      '  doc: "Try typing teh CodeMirror update.\\n",',
      "  extensions: [createTypaiCodeMirrorExtension({ typai })],",
      "});",
      "new EditorView({ parent: mount, state });",
      "",
    ].join("\n"),
  };
}

function createProviderProxyMockAppFiles() {
  return {
    "index.html":
      '<!doctype html><div id="editor" contenteditable>Write a short continuation.</div><script type="module" src="/src/main.ts"></script>\n',
    "src/main.ts": [
      "import {",
      "  createContenteditableCompletionController,",
      "  createEndpointCompletionProvider,",
      "  createRemoteCompletion,",
      '} from "@typai/completion-remote";',
      'import { attachContenteditable } from "@typai/contenteditable";',
      'import { createTypaiCore } from "@typai/core";',
      "",
      'const editor = document.querySelector<HTMLElement>("#editor");',
      "if (editor === null) {",
      '  throw new Error("Missing provider proxy smoke editor.");',
      "}",
      "",
      "const provider = createEndpointCompletionProvider({",
      '  endpoint: "/api/typai/completion",',
      "  timeoutMs: 1000,",
      "});",
      "const remote = createRemoteCompletion({",
      "  provider,",
      "  debounceMs: 250,",
      "  minPrefixChars: 3,",
      "  maxCompletionChars: 80,",
      "});",
      'const completion = createContenteditableCompletionController({ remote, mode: "prose" });',
      "const typai = await createTypaiCore();",
      'const detach = attachContenteditable({ element: editor, typai, completion, completionMode: "prose" });',
      "completion.connectEditor(detach);",
      "",
    ].join("\n"),
  };
}

function printSummary() {
  console.log("\nPublic beta smoke matrix passed.");
  console.log(`Packages: ${publicPackageNames.join(", ")}`);
  console.log("Runtime scenarios:");
  for (const scenario of runtimeScenarios) {
    console.log(`- ${scenario}: passed`);
  }
  console.log("Consumer environments:");
  for (const result of results) {
    console.log(`- ${result.name}: ${result.status} (${result.durationMs} ms)`);
  }
  console.log("Provider mode: mock-only; no real provider calls were made.");
}

function getPackedTarballName(packageName) {
  return `${packageName.replace("@typai/", "typai-").replace("/", "-")}-0.0.0-dev.tgz`;
}

function run(command, args, cwd) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd,
    env: createCommandEnv(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveCommand(command, args) {
  if (command === "node") {
    return { args, command: process.execPath };
  }

  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", `${command}.cmd`, ...args],
      command: "cmd.exe",
    };
  }

  return { args, command };
}

function linkPackage(appRoot, scope, name, source) {
  if (!existsSync(source)) {
    throw new Error(`Missing local peer dependency for ${scope}/${name}: ${source}`);
  }

  const scopeRoot = join(appRoot, "node_modules", scope);
  const target = join(scopeRoot, name);

  mkdirSync(scopeRoot, { recursive: true });
  rmSync(target, { force: true, recursive: true });
  symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
}

function createCommandEnv() {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const currentPath = process.env[pathKey] ?? process.env.PATH ?? "";
  const localBins = [resolve(".codex-tools"), resolve("node_modules", ".bin")];
  const npmCache = join(smokeRoot, "npm-cache");

  return {
    ...process.env,
    [pathKey]: [...localBins, currentPath].filter(Boolean).join(delimiter),
    CI: "true",
    NPM_CONFIG_CACHE: npmCache,
    OPENAI_API_KEY: "",
    PROVIDER_MODE: "mock",
    TYPAI_ALLOW_REAL_PROVIDER_TEST: "0",
  };
}
