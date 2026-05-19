import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "README.md",
  "docs/README.md",
  "docs/getting-started.md",
  "docs/installation.md",
  "docs/concepts/deterministic-correction.md",
  "docs/concepts/protected-spans.md",
  "docs/concepts/red-blue-marks.md",
  "docs/concepts/completion.md",
  "docs/concepts/storage-memory.md",
  "docs/concepts/provider-proxy.md",
  "docs/packages/core.md",
  "docs/packages/contenteditable.md",
  "docs/packages/textarea.md",
  "docs/packages/react.md",
  "docs/packages/codemirror.md",
  "docs/packages/completion-remote.md",
  "docs/examples.md",
  "docs/security.md",
  "docs/privacy.md",
  "docs/api-stability.md",
  "docs/release-checklist.md",
  "docs/troubleshooting.md",
  "docs/roadmap.md",
  "docs/intelligence-quality-foundation-complete.md",
  "docs/dictionary-source-selection.md",
  "docs/dictionary-asset-policy.md",
  "docs/dictionary-production-approval.md",
  "docs/dictionary-asset-blockers.md",
  "docs/spell-quality-report.md",
  "docs/spell-false-positive-review.md",
  "docs/common-typo-table.md",
];

const forbiddenOverclaims = [
  /production dictionary included/i,
  /production dictionary asset exists/i,
  /real Codex integration/i,
  /browser API key/i,
  /@typai\/core uses remote completion/i,
  /npm install @typai\//i,
  /local model inference exists/i,
];

const consumerExampleDirs = [
  "examples/consumer-vanilla-contenteditable",
  "examples/consumer-vanilla-textarea",
  "examples/consumer-react",
  "examples/consumer-codemirror",
  "examples/consumer-completion-with-proxy",
];

const consumerForbidden = [/OPENAI_API_KEY/i, /api\.openai\.com/i, /dangerouslyAllowBrowserKey/i];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    failures.push(`Missing required docs file: ${file}`);
  }
}

for (const file of requiredFiles.filter((candidate) => existsSync(candidate))) {
  const text = readFileSync(file, "utf8");

  for (const pattern of forbiddenOverclaims) {
    if (pattern.test(text)) {
      failures.push(`Forbidden overclaim in ${file}: ${pattern}`);
    }
  }
}

for (const dir of consumerExampleDirs) {
  if (!existsSync(dir)) {
    failures.push(`Missing consumer example: ${dir}`);
    continue;
  }

  for (const file of walkFiles(dir)) {
    const text = readFileSync(file, "utf8");

    for (const pattern of consumerForbidden) {
      if (pattern.test(text)) {
        failures.push(`Forbidden provider reference in ${file}: ${pattern}`);
      }
    }
  }
}

const completionExampleSource = join("examples/consumer-completion-with-proxy/src/main.ts");
const completionExampleReadme = join("examples/consumer-completion-with-proxy/README.md");

if (existsSync(completionExampleSource)) {
  const source = readFileSync(completionExampleSource, "utf8");

  if (!source.includes("createEndpointCompletionProvider")) {
    failures.push("Completion consumer example must use createEndpointCompletionProvider.");
  }
}

if (existsSync(completionExampleReadme)) {
  const readme = readFileSync(completionExampleReadme, "utf8");

  if (!readme.includes("PROVIDER_MODE=mock")) {
    failures.push("Completion consumer README must document mock proxy mode.");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Docs check passed: ${requiredFiles.length} required docs and consumer examples verified.`,
);

function walkFiles(dir) {
  const results = [];

  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".turbo") {
      continue;
    }

    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      results.push(...walkFiles(path));
    } else {
      results.push(path);
    }
  }

  return results;
}
