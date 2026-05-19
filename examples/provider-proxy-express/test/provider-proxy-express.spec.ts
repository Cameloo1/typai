import { runProviderProxyContractSuite } from "@typai/provider-proxy-testkit";
import { describe, expect, it } from "vitest";

import { handleTypaiExpressCompletionRequest } from "../src";

const env = {
  PROVIDER_MODE: "mock",
  ALLOWED_ORIGIN: "http://localhost:5173",
};

runProviderProxyContractSuite({
  name: "provider-proxy-express",
  async makeRequest(input) {
    const response = await handleTypaiExpressCompletionRequest(
      {
        method: input.method,
        headers: input.headers,
        bodyText: input.body,
      },
      env,
      {
        simulateProviderFailure: input.scenario === "provider_failure",
      },
    );

    return response;
  },
});

describe("provider-proxy-express CORS policy", () => {
  it("allows the configured local origin", async () => {
    const response = await handleTypaiExpressCompletionRequest(
      {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
        bodyText: "",
      },
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejects unlisted origins without echoing request content", async () => {
    const response = await handleTypaiExpressCompletionRequest(
      {
        method: "POST",
        headers: {
          origin: "https://unlisted.example",
          "content-type": "application/json",
        },
        bodyText: JSON.stringify({ request: { contextBefore: "private text" } }),
      },
      env,
    );

    expect(response.status).toBe(403);
    expect(response.body).not.toContain("private text");
  });
});
