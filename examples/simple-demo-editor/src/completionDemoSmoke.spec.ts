import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const reactSource = readFileSync(new URL("./reactDemo.tsx", import.meta.url), "utf8");
const codeMirrorSource = readFileSync(new URL("./codemirrorDemo.ts", import.meta.url), "utf8");
const controllerSource = readFileSync(
  new URL("./completionDemoControllers.ts", import.meta.url),
  "utf8",
);
const allDemoSources = [mainSource, reactSource, codeMirrorSource, controllerSource].join("\n");

describe("V4.1 completion demos", () => {
  it("declares completion controls and metrics for textarea, React, and CodeMirror", () => {
    for (const selector of [
      "textarea-completion-enabled",
      "textarea-completion-status",
      "textarea-completion-requests",
      "textarea-completion-p95",
      "react-completion-enabled",
      "react-completion-requests",
      "react-completion-p95",
      "codemirror-completion-text",
      "codemirror-completion-status",
      "codemirror-completion-requests",
      "codemirror-completion-p95",
    ]) {
      expect(allDemoSources).toContain(selector);
    }
  });

  it("uses mocked completion controllers without real provider calls or browser keys", () => {
    expect(controllerSource).toContain("createMockCompletionProvider");
    expect(controllerSource).toContain("createRemoteCompletion");
    expect(allDemoSources).not.toMatch(/api[_-]?key/i);
    expect(allDemoSources).not.toMatch(/\bopenai\b/i);
    expect(controllerSource).not.toContain("fetch(");
  });
});
