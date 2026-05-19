import { runProviderProxyContractSuite } from "@typai/provider-proxy-testkit";
import { describe, expect, it } from "vitest";

import { handleTypaiNextCompletionRequest } from "../src/handler";

const env = {
  PROVIDER_MODE: "mock",
  ALLOWED_ORIGIN: "http://localhost:5173",
};

runProviderProxyContractSuite({
  name: "provider-proxy-next",
  async makeRequest(input) {
    const response = await handleTypaiNextCompletionRequest(
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

describe("provider-proxy-next CORS policy", () => {
  it("allows the configured local origin", async () => {
    const response = await handleTypaiNextCompletionRequest(
      createRequest("OPTIONS", { origin: "http://localhost:5173" }, ""),
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("rejects unlisted origins without echoing request content", async () => {
    const response = await handleTypaiNextCompletionRequest(
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

function createRequest(method: string, headers: Record<string, string>, body: string): Request {
  return new Request("https://example.test/api/typai/completion", {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}
