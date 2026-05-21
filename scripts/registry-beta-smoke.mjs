import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

const packages = [
  "@typai/ui",
  "@typai/core",
  "@typai/completion-remote",
  "@typai/contenteditable",
  "@typai/textarea",
  "@typai/react",
  "@typai/codemirror",
];

const peers = [
  "react",
  "react-dom",
  "@codemirror/language",
  "@codemirror/state",
  "@codemirror/view",
];

const smokeRoot = mkdtempSync(join(tmpdir(), "typai-registry-beta-smoke-"));
const keepTemp = process.env.TYPAI_KEEP_REGISTRY_BETA_SMOKE === "1";

try {
  writeFileSync(
    join(smokeRoot, "package.json"),
    `${JSON.stringify({ name: "typai-registry-beta-smoke", private: true, type: "module" }, null, 2)}\n`,
  );

  run("npm", [
    "install",
    "--registry=https://registry.npmjs.org",
    "--legacy-peer-deps",
    "--ignore-scripts",
    ...packages.map((name) => `${name}@beta`),
    ...peers,
  ]);

  writeFileSync(join(smokeRoot, "registry-beta-runtime-smoke.mjs"), runtimeSmokeSource());
  run("node", ["registry-beta-runtime-smoke.mjs"]);
  console.log("Registry beta smoke passed.");
  console.log(`Installed packages: ${packages.map((name) => `${name}@beta`).join(", ")}`);
  console.log("Source: public npm registry");
  console.log("Local tarballs: no");
  console.log("Workspace symlinks: no");
  console.log("Provider mode: mock-only");
} finally {
  if (keepTemp) {
    console.log(`Registry beta smoke temp root kept at ${smokeRoot}`);
  } else {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}

function runtimeSmokeSource() {
  return [
    'import { createServer } from "node:http";',
    'import { lstatSync, readFileSync, readdirSync, statSync } from "node:fs";',
    'import { join } from "node:path";',
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
    `const packageNames = ${JSON.stringify(packages)};`,
    "",
    "for (const packageName of packageNames) {",
    "  const packageRoot = packageRootFor(packageName);",
    "  assert(!lstatSync(packageRoot).isSymbolicLink(), packageName + ' must be installed from registry, not a workspace symlink.');",
    "  await import(packageName);",
    "}",
    "",
    'assert(typeof createTypaiCore === "function", "Expected createTypaiCore.");',
    'assert(typeof attachContenteditable === "function", "Expected attachContenteditable.");',
    'assert(typeof attachTextarea === "function", "Expected attachTextarea.");',
    'assert(typeof TypaiReact.TypaiProvider === "function", "Expected React provider.");',
    'assert(typeof TypaiCodeMirror.createTypaiCodeMirrorExtension === "function", "Expected CodeMirror extension.");',
    'assert(typeof createRemoteCompletion === "function", "Expected remote completion factory.");',
    'assert(typeof createMockCompletionProvider === "function", "Expected mock completion provider.");',
    'assert(typeof createEndpointCompletionProvider === "function", "Expected endpoint completion provider.");',
    "",
    "const typai = await createTypaiCore();",
    'const correction = typai.checkCompletedToken({ token: "teh" });',
    'assert(correction.action === "auto_correct", "Expected teh autocorrect.");',
    'assert(correction.replacement === "the", "Expected teh -> the.");',
    'assert(typai.checkCompletedToken({ token: "form" }).action === "do_nothing", "Expected valid word trap to remain unchanged.");',
    "",
    "const hostBytes = createDictionaryBlob([",
    '  ["receipt", 50000, 0],',
    '  ["receive", 45000, 0],',
    '  ["because", 40000, 0],',
    "]);",
    'const hostTypai = await createTypaiCore({ dictionary: { mode: "host-provided", bytes: hostBytes } });',
    'assert(hostTypai.getLoadedDictionaryWordCount() === 3, "Expected host-provided dictionary word count.");',
    'assert(hostTypai.suggestToken({ token: "reciept", maxSuggestions: 3 }).suggestions.includes("receipt"), "Expected host-provided suggestion.");',
    "",
    "await createTypaiCore({ dictionary: { mode: 'production' } })",
    "  .then(() => { throw new Error('Expected production mode to be blocked.'); })",
    "  .catch((error) => {",
    "    assert(/production dictionary asset is unavailable/i.test(String(error?.message ?? error)), 'Expected blocked production-mode error.');",
    "  });",
    "",
    'const remote = createRemoteCompletion({ provider: createMockCompletionProvider(" world"), debounceMs: 0, minPrefixChars: 1 });',
    "remote.schedule({",
    "  id: 'registry-smoke',",
    "  mode: 'prompt',",
    "  contextBefore: 'hello',",
    "  contextAfter: '',",
    "  currentLine: 'hello',",
    "  cursorOffset: 5,",
    "});",
    "await waitForRemoteState(remote, 'showing');",
    "assert(remote.getState().text === ' world', 'Expected mock completion text.');",
    "remote.destroy();",
    "",
    "const endpointServer = createMockProxyServer();",
    "await new Promise((resolve) => endpointServer.listen(0, '127.0.0.1', resolve));",
    "const address = endpointServer.address();",
    "try {",
    "  const endpointProvider = createEndpointCompletionProvider({ endpoint: 'http://127.0.0.1:' + address.port + '/api/typai/completion', timeoutMs: 1000 });",
    "  const response = await endpointProvider.complete({",
    "    id: 'registry-endpoint-smoke',",
    "    mode: 'prompt',",
    "    contextBefore: 'hello',",
    "    contextAfter: '',",
    "    currentLine: 'hello',",
    "    cursorOffset: 5,",
    "    maxCompletionChars: 80,",
    "    stopSequences: [],",
    "    instruction: { task: 'continue', style: 'same_voice', output: 'continuation_only', constraints: [] },",
    "  }, { timeoutMs: 1000 });",
    "  assert(response.text === ' proxied', 'Expected endpoint mock proxy text.');",
    "} finally {",
    "  await new Promise((resolve, reject) => endpointServer.close((error) => error === undefined ? resolve() : reject(error)));",
    "}",
    "",
    "const corePackage = readPackageJson('@typai/core');",
    "const coreDeps = Object.keys({ ...corePackage.dependencies, ...corePackage.peerDependencies, ...corePackage.optionalDependencies });",
    "assert(!coreDeps.includes('@typai/completion-remote'), '@typai/core must not depend on completion-remote.');",
    "",
    "for (const packageName of packageNames) {",
    "  assertNoProviderKeyPath(packageName);",
    "  if (packageName === '@typai/core') {",
    "    assertNoProductionAssets(packageName);",
    "  }",
    "}",
    "",
    "console.log('registry beta runtime checks passed');",
    "",
    "function packageRootFor(packageName) {",
    "  return join('node_modules', ...packageName.split('/'));",
    "}",
    "",
    "function readPackageJson(packageName) {",
    "  return JSON.parse(readFileSync(join(packageRootFor(packageName), 'package.json'), 'utf8'));",
    "}",
    "",
    "function assertNoProviderKeyPath(packageName) {",
    "  for (const file of listFiles(packageRootFor(packageName))) {",
    "    if (!/\\.(?:cjs|cts|d\\.ts|js|json|mjs|mts|ts)$/.test(file) || file.toLowerCase().endsWith('readme.md')) {",
    "      continue;",
    "    }",
    "    const contents = readFileSync(join(packageRootFor(packageName), file), 'utf8');",
    "    assert(!contents.includes('dangerouslyAllowBrowserKey'), packageName + ' exposes a browser key escape hatch in ' + file + '.');",
    "    assert(!/api\\.openai\\.com/i.test(contents), packageName + ' contains a direct provider endpoint in ' + file + '.');",
    "    assert(!/\\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\\b/.test(contents), packageName + ' contains provider secret-like content in ' + file + '.');",
    "  }",
    "}",
    "",
    "function assertNoProductionAssets(packageName) {",
    "  for (const file of listFiles(packageRootFor(packageName))) {",
    "    assert(!file.replaceAll('\\\\\\\\', '/').startsWith('assets/'), packageName + ' contains blocked asset path ' + file + '.');",
    "    assert(!/production.*(?:dictionary|frequency)/i.test(file), packageName + ' contains production asset ' + file + '.');",
    "    assert(!/\\.(?:aff|dic|gz|tsv|zip)$/i.test(file), packageName + ' contains raw language source ' + file + '.');",
    "  }",
    "}",
    "",
    "function listFiles(root, current = '') {",
    "  const directory = current.length === 0 ? root : join(root, current);",
    "  const files = [];",
    "  for (const entry of readdirSync(directory)) {",
    "    const relative = current.length === 0 ? entry : join(current, entry);",
    "    const absolute = join(root, relative);",
    "    if (statSync(absolute).isDirectory()) {",
    "      files.push(...listFiles(root, relative));",
    "    } else {",
    "      files.push(relative);",
    "    }",
    "  }",
    "  return files;",
    "}",
    "",
    "function createMockProxyServer() {",
    "  return createServer((request, response) => {",
    "    if (request.method !== 'POST' || request.url !== '/api/typai/completion') {",
    "      response.writeHead(405, { 'content-type': 'application/json' });",
    "      response.end(JSON.stringify({ error: { code: 'invalid_method', message: 'POST JSON is required.' } }));",
    "      return;",
    "    }",
    "    let body = '';",
    "    request.setEncoding('utf8');",
    "    request.on('data', (chunk) => { body += chunk; });",
    "    request.on('end', () => {",
    "      const payload = JSON.parse(body);",
    "      assert(payload.request?.contextBefore === 'hello', 'Expected endpoint provider payload.');",
    "      response.writeHead(200, { 'content-type': 'application/json' });",
    "      response.end(JSON.stringify({ text: ' proxied', model: 'mock-proxy', usage: { inputTokens: 1, outputTokens: 1 }, finishReason: 'stop' }));",
    "    });",
    "  });",
    "}",
    "",
    "function waitForRemoteState(controller, status) {",
    "  return new Promise((resolve, reject) => {",
    "    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Timed out waiting for completion state ' + status)); }, 1000);",
    "    const unsubscribe = controller.subscribe((event) => {",
    "      if (event.state.status === status) {",
    "        clearTimeout(timeout);",
    "        unsubscribe();",
    "        resolve(event.state);",
    "      }",
    "    });",
    "  });",
    "}",
    "",
    "function createDictionaryBlob(entries) {",
    "  const languageBytes = Buffer.from('en-US', 'utf8');",
    "  const encodedEntries = [...entries].sort(([left], [right]) => left.localeCompare(right, 'en-US')).map(([word, frequency, flags]) => ({ wordBytes: Buffer.from(word, 'utf8'), frequency, flags }));",
    "  const stringTableByteLength = encodedEntries.reduce((total, entry) => total + entry.wordBytes.byteLength, 0);",
    "  const byteLength = 24 + encodedEntries.length * 14 + stringTableByteLength + languageBytes.byteLength;",
    "  const output = Buffer.alloc(byteLength);",
    "  let offset = 0;",
    "  output.write('TYPAIDIC', offset, 'ascii');",
    "  offset += 8;",
    "  output.writeUInt32LE(1, offset);",
    "  offset += 4;",
    "  output.writeUInt16LE(languageBytes.byteLength, offset);",
    "  offset += 2;",
    "  output.writeUInt16LE(0, offset);",
    "  offset += 2;",
    "  output.writeUInt32LE(encodedEntries.length, offset);",
    "  offset += 4;",
    "  output.writeUInt32LE(stringTableByteLength, offset);",
    "  offset += 4;",
    "  let wordOffset = 0;",
    "  for (const entry of encodedEntries) {",
    "    output.writeUInt32LE(wordOffset, offset); offset += 4;",
    "    output.writeUInt16LE(entry.wordBytes.byteLength, offset); offset += 2;",
    "    output.writeUInt32LE(entry.frequency, offset); offset += 4;",
    "    output.writeUInt32LE(entry.flags, offset); offset += 4;",
    "    wordOffset += entry.wordBytes.byteLength;",
    "  }",
    "  for (const entry of encodedEntries) {",
    "    output.set(entry.wordBytes, offset);",
    "    offset += entry.wordBytes.byteLength;",
    "  }",
    "  output.set(languageBytes, offset);",
    "  return new Uint8Array(output);",
    "}",
    "",
    "function assert(condition, message) {",
    "  if (!condition) throw new Error(message);",
    "}",
    "",
  ].join("\n");
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: smokeRoot,
    env: createCommandEnv(),
    stdio: "inherit",
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
    CI: "true",
    NPM_CONFIG_CACHE: join(smokeRoot, "npm-cache"),
    PROVIDER_MODE: "mock",
    TYPAI_ALLOW_REAL_PROVIDER_TEST: "0",
  };
}
