import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/npm-trusted-publish.yml";
const workflow = readFileSync(workflowPath, "utf8");
const requestedVersionPlaceholder = "$" + "{REQUESTED_VERSION}";

const approvedOrder = [
  {
    name: "@typai/ui",
    tarball: `.pack/typai-ui-${requestedVersionPlaceholder}.tgz`,
  },
  {
    name: "@typai/core",
    tarball: `.pack/typai-core-${requestedVersionPlaceholder}.tgz`,
  },
  {
    name: "@typai/completion-remote",
    tarball: `.pack/typai-completion-remote-${requestedVersionPlaceholder}.tgz`,
  },
  {
    name: "@typai/contenteditable",
    tarball: `.pack/typai-contenteditable-${requestedVersionPlaceholder}.tgz`,
  },
  {
    name: "@typai/textarea",
    tarball: `.pack/typai-textarea-${requestedVersionPlaceholder}.tgz`,
  },
  {
    name: "@typai/react",
    tarball: `.pack/typai-react-${requestedVersionPlaceholder}.tgz`,
  },
  {
    name: "@typai/codemirror",
    tarball: `.pack/typai-codemirror-${requestedVersionPlaceholder}.tgz`,
  },
];

assertIncludes("manual workflow dispatch trigger", "workflow_dispatch:");
assertNotMatches("automatic push trigger", /^\s+push:\s*$/m);
assertNotMatches("automatic pull_request trigger", /^\s+pull_request:\s*$/m);
assertIncludes("contents read permission", "contents: read");
assertIncludes("OIDC id-token permission", "id-token: write");
assertNotIncludes("NPM token secret", "NPM_TOKEN");
assertNotIncludes("Node auth token secret", "NODE_AUTH_TOKEN");
assertMatches("Node 24 runtime", /node-version:\s*24\b/);
assertIncludes("npm registry URL", "registry-url: https://registry.npmjs.org");
assertIncludes("npm latest install for 11.5.1+ runtime", "npm install -g npm@latest");
assertIncludes("npm minimum version check", "below trusted publishing minimum 11.5.1");
assertIncludes("version input", "version:");
assertIncludes("dist-tag input", "distTag:");
assertIncludes("confirm publish input", "confirmPublish:");
assertIncludes("strict publish phrase", 'CONFIRM_PUBLISH" != "PUBLISH_BETA"');
assertIncludes("beta-only dist-tag gate", 'REQUESTED_DIST_TAG" != "beta"');
assertIncludes("frozen pnpm install", "pnpm install --frozen-lockfile");
assertIncludes("build gate", "pnpm build");
assertIncludes("test gate", "pnpm test");
assertIncludes("e2e gate", "pnpm test:e2e");
assertIncludes("lint gate", "pnpm lint");
assertIncludes("package scan gate", "pnpm scan:package-secrets");
assertIncludes("release dry-run gate", "pnpm release:publish:dry");
assertIncludes("package availability check", "already exists on npm");
assertIncludes("publish tag argument", '--tag "$REQUESTED_DIST_TAG"');
assertIncludes("public access publish flag", "--access public");
assertNotIncludes("latest dist-tag publish flag", "--tag latest");

const publishCalls = [...workflow.matchAll(/publish_one "([^"]+)" "([^"]+)"/g)].map((match) => ({
  tarball: match[1],
  name: match[2],
}));

if (publishCalls.length !== approvedOrder.length) {
  throw new Error(
    `Expected ${approvedOrder.length} publish_one calls, found ${publishCalls.length}.`,
  );
}

for (const [index, expected] of approvedOrder.entries()) {
  const actual = publishCalls[index];
  if (actual.name !== expected.name || actual.tarball !== expected.tarball) {
    throw new Error(
      `Publish order mismatch at ${index + 1}: expected ${expected.name} ${expected.tarball}, found ${actual.name} ${actual.tarball}.`,
    );
  }
}

console.log("Trusted publish workflow check passed.");
console.log(`Workflow: ${workflowPath}`);
console.log("Trigger: workflow_dispatch only");
console.log("OIDC permission: id-token: write");
console.log("Token secrets: none");
console.log("Publish order:");
for (const item of approvedOrder) {
  console.log(`- ${item.name} -> ${item.tarball}`);
}

function assertIncludes(label, needle) {
  if (!workflow.includes(needle)) {
    throw new Error(`Workflow is missing ${label}: ${needle}`);
  }
}

function assertNotIncludes(label, needle) {
  if (workflow.includes(needle)) {
    throw new Error(`Workflow must not include ${label}: ${needle}`);
  }
}

function assertMatches(label, pattern) {
  if (!pattern.test(workflow)) {
    throw new Error(`Workflow is missing ${label}: ${pattern}`);
  }
}

function assertNotMatches(label, pattern) {
  if (pattern.test(workflow)) {
    throw new Error(`Workflow must not include ${label}: ${pattern}`);
  }
}
