import {
  runProviderProxyContractSuite,
  validCompletionRequest,
} from "@typai/provider-proxy-testkit";
import { describe, expect, it } from "vitest";

import { handleTypaiWorkerRequest } from "../src";

const env = {
  PROVIDER_MODE: "mock",
  ALLOWED_ORIGIN: "http://localhost:5173",
};

runProviderProxyContractSuite({
  name: "provider-proxy-cloudflare-worker",
  async makeRequest(input) {
    const response = await handleTypaiWorkerRequest(
      createRequest(input.method, input.headers, input.body),
      env,
      {
        simulateProviderFailure: input.scenario === "provider_failure",
      },
    );

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    };
  },
});

describe("provider-proxy-cloudflare-worker CORS policy", () => {
  it("allows the configured local origin", async () => {
    const response = await handleTypaiWorkerRequest(
      createRequest("OPTIONS", { origin: "http://localhost:5173" }, ""),
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("rejects unlisted origins without echoing request content", async () => {
    const response = await handleTypaiWorkerRequest(
      createRequest(
        "POST",
        {
          origin: "https://unlisted.example",
          "content-type": "application/json",
        },
        JSON.stringify({ request: { contextBefore: "private text" } }),
      ),
      env,
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private text");
  });
});

describe("provider-proxy-cloudflare-worker OpenAI Responses mode", () => {
  it("fails safely when openai mode is enabled without a server key", async () => {
    const response = await handleTypaiWorkerRequest(
      createRequest(
        "POST",
        { "content-type": "application/json" },
        JSON.stringify({ request: validCompletionRequest }),
      ),
      {
        PROVIDER_MODE: "openai",
        ALLOWED_ORIGIN: "http://localhost:5173",
      },
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("internal_error");
    expect(body).not.toContain(validCompletionRequest.contextBefore);
  });

  it("calls the server-side Responses adapter with mocked fetch only", async () => {
    const fetchCalls: RequestInit[] = [];
    const response = await handleTypaiWorkerRequest(
      createRequest(
        "POST",
        { "content-type": "application/json" },
        JSON.stringify({ request: validCompletionRequest }),
      ),
      {
        PROVIDER_MODE: "openai",
        OPENAI_API_KEY: "sk-test-server-key",
        OPENAI_MODEL: "gpt-test-model",
        ALLOWED_ORIGIN: "http://localhost:5173",
      },
      {
        async fetchImpl(_input, init) {
          fetchCalls.push(init ?? {});

          return new Response(
            JSON.stringify({
              output_text: " through a mocked Responses adapter.",
              model: "gpt-test-model",
              usage: {
                input_tokens: 12,
                output_tokens: 7,
              },
              status: "completed",
            }),
            { status: 200 },
          );
        },
      },
    );
    const body = await response.json();
    const headers = new Headers(fetchCalls[0]?.headers);
    const requestBody = JSON.parse(String(fetchCalls[0]?.body));

    expect(response.status).toBe(200);
    expect(body.text).toBe(" through a mocked Responses adapter.");
    expect(body.model).toBe("gpt-test-model");
    expect(headers.get("authorization")).toBe("Bearer sk-test-server-key");
    expect(requestBody.model).toBe("gpt-test-model");
    expect(JSON.stringify(requestBody)).toContain("continuation_only");
    expect(JSON.stringify(body)).not.toContain("sk-test-server-key");
    expect(fetchCalls).toHaveLength(1);
  });
});

function createRequest(method: string, headers: Record<string, string>, body: string): Request {
  return new Request("https://worker.example.test/api/typai/completion", {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}
