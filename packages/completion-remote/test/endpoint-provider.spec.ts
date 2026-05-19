import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletionRequest } from "../src";
import {
  createCompletionRequest,
  createEndpointCompletionProvider,
  EndpointCompletionProviderError,
} from "../src";

describe("createEndpointCompletionProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends a POST body with the CompletionRequest", async () => {
    const request = createTestRequest();
    const calls: Array<{
      input: RequestInfo | URL;
      init?: RequestInit;
      body: unknown;
    }> = [];

    mockFetch(async (input, init) => {
      calls.push({
        input,
        init,
        body: JSON.parse(String(init?.body)),
      });

      return jsonResponse({
        text: " world",
        model: "gpt-test",
        usage: { inputTokens: 12, outputTokens: 2 },
        finishReason: "stop",
      });
    });

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });
    const response = await provider.complete(request, {});

    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("/typai/complete");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(new Headers(calls[0]?.init?.headers).get("content-type")).toBe("application/json");
    expect(calls[0]?.body).toEqual({ request });
    expect(response).toMatchObject({
      id: request.id,
      text: " world",
      providerName: "endpoint",
      model: "gpt-test",
      usage: { inputTokens: 12, outputTokens: 2 },
      finishReason: "stop",
    });
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("supports static and async headers", async () => {
    const seenHeaders: Headers[] = [];

    mockFetch(async (_input, init) => {
      seenHeaders.push(new Headers(init?.headers));
      return jsonResponse({ text: "done" });
    });

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
      headers: async () => ({
        "x-csrf-token": "csrf-token",
        "x-session-id": "session-id",
      }),
    });

    await provider.complete(createTestRequest(), {});

    expect(seenHeaders[0]?.get("x-csrf-token")).toBe("csrf-token");
    expect(seenHeaders[0]?.get("x-session-id")).toBe("session-id");
    expect(seenHeaders[0]?.get("content-type")).toBe("application/json");
  });

  it("supports AbortSignal cancellation", async () => {
    const controller = new AbortController();
    mockFetch((_input, init) => rejectWhenAborted(init?.signal));

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });
    const pending = provider.complete(createTestRequest(), {
      signal: controller.signal,
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "abort",
      kind: "abort",
      name: "EndpointCompletionProviderError",
    });
  });

  it("enforces timeout", async () => {
    mockFetch((_input, init) => rejectWhenAborted(init?.signal));

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
      timeoutMs: 1,
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "timeout",
      kind: "timeout",
      name: "EndpointCompletionProviderError",
    });
  });

  it("classifies 429 responses as rate_limited", async () => {
    mockFetch(async () =>
      jsonResponse(
        { error: "limited" },
        {
          status: 429,
          headers: { "retry-after": "2" },
        },
      ),
    );

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "rate_limited",
      kind: "rate_limited",
      name: "EndpointCompletionProviderError",
      retryAfterMs: 2000,
    });
  });

  it("classifies 5xx responses as server_error", async () => {
    mockFetch(async () => jsonResponse({ error: "server" }, { status: 500 }));

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "server_error",
      kind: "server_error",
      name: "EndpointCompletionProviderError",
      status: 500,
    });
  });

  it("classifies 4xx responses as client_error", async () => {
    mockFetch(async () => jsonResponse({ error: "client" }, { status: 400 }));

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "client_error",
      kind: "client_error",
      name: "EndpointCompletionProviderError",
      status: 400,
    });
  });

  it("rejects malformed responses", async () => {
    mockFetch(async () => jsonResponse({ model: "missing-text" }));

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "invalid_response",
      kind: "invalid_response",
      name: "EndpointCompletionProviderError",
    });
  });

  it("rejects malformed JSON as invalid_response", async () => {
    mockFetch(
      async () =>
        new Response("{", {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
    );

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "invalid_response",
      kind: "invalid_response",
      name: "EndpointCompletionProviderError",
    });
  });

  it("converts network failures into typed safe errors", async () => {
    mockFetch(async () => {
      throw new TypeError("low-level network detail");
    });

    const provider = createEndpointCompletionProvider({
      endpoint: "/typai/complete",
    });

    await expect(provider.complete(createTestRequest(), {})).rejects.toMatchObject({
      code: "network_error",
      kind: "network_error",
      name: "EndpointCompletionProviderError",
      message: "Endpoint completion request failed.",
    });
  });

  it("exports a typed endpoint provider error", () => {
    const error = new EndpointCompletionProviderError(
      "network_error",
      "Endpoint completion request failed.",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("network_error");
    expect(error.providerError).toEqual({
      kind: "network_error",
      message: "Endpoint completion request failed.",
    });
  });

  it("does not add an SDK import or browser key option", () => {
    const sourceText = [
      readSourceTree(resolve(packageRoot, "src")),
      readFileSync(resolve(packageRoot, "package.json"), "utf8"),
    ].join("\n");

    expect(sourceText).not.toMatch(/from\s+["']openai["']/i);
    expect(sourceText).not.toMatch(/require\(["']openai["']\)/i);
    expect(sourceText).not.toMatch(/apiKey|api_key|providerKey|privateKey/i);
  });
});

function createTestRequest(): CompletionRequest {
  return createCompletionRequest({
    id: "request-1",
    mode: "prompt",
    contextBefore: "hello",
    contextAfter: "",
    currentLine: "hello",
    maxCompletionChars: 20,
    stopSequences: ["STOP"],
  });
}

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): void {
  globalThis.fetch = vi.fn(handler) as typeof fetch;
}

function rejectWhenAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    signal?.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, "..");

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
