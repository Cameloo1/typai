import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = resolve(repoRoot, "packages/core/native");
const cppRoot = resolve(nativeRoot, "cpp");
const rustBridgePath = resolve(nativeRoot, "rust/src/lib.rs");
const tsBridgeFiles = [
  resolve(repoRoot, "packages/core/src/createTypaiCore.ts"),
  resolve(repoRoot, "packages/core/src/wasmLoader.ts"),
  resolve(repoRoot, "packages/core/src/types.ts"),
];

const failures = [];
const summaries = [];

const cppFiles = collectFiles(cppRoot, [".cpp", ".hpp", ".h"]);
const cppSource = cppFiles.map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));
const rustBridgeText = readFileSync(rustBridgePath, "utf8");
const tsBridgeSource = tsBridgeFiles.map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));

checkNoMatches(
  "C++ std::string must not appear in the extern C API surface",
  cppSource,
  /std::string/g,
);
checkNoMatches(
  "C++ FFI/delete-index path must not use raw heap allocation",
  cppSource,
  /\b(?:malloc|calloc|realloc|free|new|delete)\b/g,
);
checkNoMatches(
  "Embind/Emscripten binding helpers are not allowed",
  cppSource,
  /\b(?:embind|emscripten|EMSCRIPTEN_BINDINGS)\b/g,
);

const cppExternDeclarations = collectCppExternDeclarations(cppSource);
for (const declaration of cppExternDeclarations) {
  if (/std::string|std::vector|std::unique_ptr|std::shared_ptr|class\s+/u.test(declaration.text)) {
    failures.push(
      `${formatLocation(declaration.file, declaration.line)}: unsupported C++ type in extern C declaration`,
    );
  }

  if (!/\b(?:char|unsigned char|unsigned int|double|int|void)\b/u.test(declaration.text)) {
    failures.push(
      `${formatLocation(declaration.file, declaration.line)}: extern C declaration uses an unexpected primitive surface`,
    );
  }
}

const rustExternBlocks = collectRustExternBlocks(rustBridgeText);
for (const block of rustExternBlocks) {
  if (/\b(?:String|Vec|Box|&str)\b/u.test(block.text)) {
    failures.push(
      `${formatLocation(rustBridgePath, block.line)}: Rust extern block exposes owned Rust data`,
    );
  }
}

checkNoMatches(
  "Core token APIs must not expose full-document text pass-through names",
  [...cppSource, { file: rustBridgePath, text: rustBridgeText }, ...tsBridgeSource],
  /\b(?:documentText|fullDocument|full_document|document_text|wholeDocument|entireDocument)\b/g,
);

summaries.push(`C++ native files scanned: ${cppFiles.length}`);
summaries.push(`C++ extern C declarations scanned: ${cppExternDeclarations.length}`);
summaries.push(`Rust extern C blocks scanned: ${rustExternBlocks.length}`);
summaries.push(`TypeScript bridge files scanned: ${tsBridgeFiles.length}`);

if (failures.length > 0) {
  console.error("Typai FFI audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Typai FFI audit passed.");
for (const summary of summaries) {
  console.log(summary);
}
console.log(
  "Allowed FFI shape: caller-owned buffers, primitive counts, pointer+length byte/string inputs.",
);
console.log(
  "Blocked FFI shape: std::string, heap ownership transfer, Embind/Emscripten bindings, full-document text APIs.",
);

function collectFiles(root, extensions) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extensions));
      continue;
    }

    if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function checkNoMatches(label, sources, pattern) {
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
      pattern.lastIndex = 0;

      if (pattern.test(lines[index])) {
        failures.push(`${formatLocation(source.file, index + 1)}: ${label}`);
      }
    }
  }
}

function collectCppExternDeclarations(sources) {
  const declarations = [];

  for (const source of sources) {
    const lines = source.text.split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].includes('extern "C"')) {
        continue;
      }

      const startLine = index + 1;
      const parts = [lines[index]];

      while (index < lines.length - 1 && !/[;{]\s*$/u.test(lines[index])) {
        index += 1;
        parts.push(lines[index]);
      }

      declarations.push({
        file: source.file,
        line: startLine,
        text: parts.join("\n"),
      });
    }
  }

  return declarations;
}

function collectRustExternBlocks(text) {
  const blocks = [];
  const lines = text.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('extern "C"')) {
      continue;
    }

    const startLine = index + 1;
    const parts = [lines[index]];
    let depth = countChar(lines[index], "{") - countChar(lines[index], "}");

    while (index < lines.length - 1 && depth > 0) {
      index += 1;
      parts.push(lines[index]);
      depth += countChar(lines[index], "{") - countChar(lines[index], "}");
    }

    blocks.push({
      line: startLine,
      text: parts.join("\n"),
    });
  }

  return blocks;
}

function countChar(value, char) {
  return [...value].filter((candidate) => candidate === char).length;
}

function formatLocation(file, line) {
  return `${relative(repoRoot, file).replaceAll("\\", "/")}:${line}`;
}
