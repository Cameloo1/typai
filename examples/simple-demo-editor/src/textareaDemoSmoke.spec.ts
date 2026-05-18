import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

describe("textarea demo scaffold", () => {
  it("imports the native textarea adapter", () => {
    expect(source).toContain('from "@typai/textarea"');
    expect(packageJson).toContain('"@typai/textarea"');
  });

  it("declares textarea and chat demo selectors", () => {
    for (const selector of [
      "textarea-demo-root",
      "textarea-editor",
      "textarea-overlay",
      "chat-demo-root",
      "chat-input",
      "chat-send",
      "sent-message",
      "textarea-reset",
      "textarea-autocorrect-toggle",
      "textarea-spellcheck-toggle",
      "textarea-debug-latency",
      "textarea-debug-correction-count",
    ]) {
      expect(source).toContain(selector);
    }
  });

  it("documents chat enter behavior in the demo source", () => {
    expect(source).toContain("Enter sends, Shift+Enter inserts a newline.");
  });
});
