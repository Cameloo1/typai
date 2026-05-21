import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMPLETION_METRIC_EVENT_TYPES,
  type CompletionProvider,
  createCompletionRequest,
  createEndpointCompletionProvider,
  createMockCompletionProvider,
  createMockStreamingCompletionProvider,
  createNoopCompletionProvider,
  createRemoteCompletion,
  sanitizeCompletionText,
} from "../src";

describe("@typai/completion-remote scaffold", () => {
  it("exports package APIs", () => {
    expect(typeof createRemoteCompletion).toBe("function");
    expect(typeof createNoopCompletionProvider).toBe("function");
    expect(typeof createMockCompletionProvider).toBe("function");
    expect(typeof createMockStreamingCompletionProvider).toBe("function");
    expect(typeof createEndpointCompletionProvider).toBe("function");
  });

  it("lets the provider interface be implemented by a mock provider", async () => {
    const provider: CompletionProvider = createMockCompletionProvider(
      (request) => ` after ${request.currentLine}`,
    );
    const request = createCompletionRequest({
      id: "request-1",
      mode: "prompt",
      contextBefore: "write a test",
    });

    const response = await provider.complete(request, {});

    expect(provider.name).toBe("mock");
    expect(response).toMatchObject({
      id: "request-1",
      providerName: "mock",
      text: " after write a test",
      finishReason: "mock",
    });
  });

  it("creates a remote completion controller without editor integration", () => {
    const provider = createMockCompletionProvider(" completion");
    const controller = createRemoteCompletion({ provider, debounceMs: 150 });

    expect(controller.provider).toBe(provider);
    expect(controller.debounceMs).toBe(150);
    expect(controller.maxCompletionChars).toBe(220);
    expect(controller.getState()).toEqual({ status: "idle" });
  });

  it("exports metrics event types", () => {
    expect(COMPLETION_METRIC_EVENT_TYPES).toEqual([
      "request_scheduled",
      "request_canceled_before_send",
      "request_aborted_in_flight",
      "request_budget_exceeded",
      "provider_error",
      "provider_timeout",
      "invalid_response",
      "rate_limit_cooldown_started",
      "provider_latency",
      "stream_started",
      "stream_delta",
      "stream_completed",
      "stream_aborted",
      "stream_stale_delta_dropped",
      "ghost_shown",
      "ghost_dismissed_by_typing",
      "ghost_dismissed_by_escape",
      "ghost_dismissed_by_selection_change",
      "ghost_dismissed_by_blur",
      "ghost_dismissed_by_composition",
      "ghost_accepted",
      "completion_reverted",
      "stale_response_dropped",
    ]);
  });

  it("supports deterministic mock text and local sanitization helpers", async () => {
    const provider = createMockCompletionProvider("abcdefSTOPghi");
    const request = createCompletionRequest({
      id: "request-3",
      mode: "markdown",
      contextBefore: "hello",
      maxCompletionChars: 3,
      stopSequences: ["STOP"],
    });

    const response = await provider.complete(request, {});
    const sanitized = sanitizeCompletionText(response.text, {
      maxCompletionChars: request.maxCompletionChars,
      stopSequences: request.stopSequences,
    });

    expect(sanitized).toBe("abc");
  });

  it("supports deterministic mock streaming deltas without network access", async () => {
    const provider = createMockStreamingCompletionProvider(" streaming text", {
      deltas: [" stream", "ing", " text"],
    });
    const request = createCompletionRequest({
      id: "request-4",
      mode: "prompt",
      contextBefore: "hello",
    });
    const deltas = [];

    for await (const delta of provider.streamComplete?.(request, {}) ?? []) {
      deltas.push(delta);
    }

    expect(deltas).toEqual([
      { id: "request-4", textDelta: " stream" },
      { id: "request-4", textDelta: "ing" },
      { id: "request-4", textDelta: " text" },
      { id: "request-4", textDelta: "", done: true },
    ]);
  });

  it("does not include direct OpenAI provider source", () => {
    const sourceText = readSourceTree(resolve(packageRoot, "src"));

    expect(sourceText).not.toMatch(/\bopenai\b/i);
  });

  it("has package metadata ready for optional tarball consumption", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
      exports?: Record<string, { types?: string; import?: string }>;
      files?: string[];
      types?: string;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const serializedPackage = JSON.stringify(packageJson);

    expect(packageJson.types).toBe("./dist/index.d.ts");
    expect(packageJson.exports?.["."]).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
    expect(packageJson.files).toEqual(["dist", "README.md"]);
    expect(serializedPackage).not.toMatch(/\bopenai\b/i);
    expect(serializedPackage).not.toMatch(/api[_-]?key/i);
    expect(packageJson.dependencies ?? {}).toEqual({});
    expect(packageJson.peerDependencies ?? {}).toEqual({});
    expect(packageJson.optionalDependencies ?? {}).toEqual({});
  });

  it("@typai/core does not import completion-remote", () => {
    const coreSourceText = readSourceTree(resolve(repoRoot, "packages", "core"));

    expect(coreSourceText).not.toContain("@typai/completion-remote");
    expect(coreSourceText).not.toContain("completion-remote");
  });
});

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, "..");
const repoRoot = resolve(packageRoot, "..", "..");

function readSourceTree(root: string): string {
  const entries = readdirSync(root, { withFileTypes: true });
  const chunks: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") {
        continue;
      }

      chunks.push(readSourceTree(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
      chunks.push(readFileSync(fullPath, "utf8"));
    }
  }

  return chunks.join("\n");
}
