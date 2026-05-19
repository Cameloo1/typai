import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const demoSource = readFileSync(new URL("./remoteCompletionDemo.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

describe("remote completion demo scaffold", () => {
  it("adds the V4 remote completion tab and package dependency", () => {
    expect(mainSource).toContain('data-demo-tab="remote-completion"');
    expect(mainSource).toContain("mountRemoteCompletionDemo");
    expect(packageJson).toContain('"@typai/completion-remote"');
  });

  it("uses mock-by-default completion with optional proxy controls and metrics", () => {
    expect(demoSource).toContain("createMockCompletionProvider");
    expect(demoSource).toContain("createEndpointCompletionProvider");
    expect(demoSource).toContain("createContenteditableCompletionController");

    for (const selector of [
      "remote-completion-editor",
      "remote-enabled",
      "remote-provider-mode",
      "remote-proxy-endpoint",
      "remote-completion-text",
      "remote-latency",
      "remote-status",
      "remote-active-provider-mode",
      "remote-active-endpoint",
      "remote-request-count",
      "remote-ghost-count",
      "remote-accept-count",
      "remote-dismiss-count",
      "remote-revert-count",
      "remote-p95-ghost-latency",
      "remote-last-latency",
      "remote-last-model",
      "remote-last-ghost",
    ]) {
      expect(demoSource).toContain(selector);
    }
  });

  it("does not add real provider keys or OpenAI browser calls", () => {
    expect(demoSource).not.toMatch(/api[_-]?key/i);
    expect(demoSource).not.toMatch(/\bopenai\b/i);
    expect(demoSource).not.toContain("fetch(");
  });
});
