import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  runProviderProxyContractSuite,
  validCompletionRequest,
} from "@typai/provider-proxy-testkit";
import { describe, expect, it } from "vitest";

import { handleTypaiExpressCompletionRequest } from "../src";

const execFileAsync = promisify(execFile);

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

describe("provider-proxy-express OpenAI Responses mode", () => {
  it("fails safely when openai mode is enabled without a server key", async () => {
    const response = await handleTypaiExpressCompletionRequest(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        bodyText: JSON.stringify({ request: validCompletionRequest }),
      },
      {
        PROVIDER_MODE: "openai",
        ALLOWED_ORIGIN: "http://localhost:5173",
      },
    );

    expect(response.status).toBe(500);
    expect(response.body).toContain("internal_error");
    expect(response.body).not.toContain(validCompletionRequest.contextBefore);
  });

  it("calls the server-side Responses adapter with mocked fetch only", async () => {
    const fetchCalls: RequestInit[] = [];
    const response = await handleTypaiExpressCompletionRequest(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        bodyText: JSON.stringify({ request: validCompletionRequest }),
      },
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

    const body = JSON.parse(response.body);
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

describe("manual real-provider smoke guard", () => {
  it("refuses to run unless explicit real-provider flags are set", async () => {
    const scriptPath = fileURLToPath(
      new URL("../../../scripts/manual-real-provider-smoke.mjs", import.meta.url),
    );
    const childEnv = { ...process.env };
    delete childEnv.TYPAI_ALLOW_REAL_PROVIDER_TEST;
    delete childEnv.OPENAI_API_KEY;
    childEnv.PROVIDER_MODE = "mock";

    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      env: childEnv,
    });

    expect(stdout).toContain("Manual real-provider smoke skipped");
    expect(stderr).toBe("");
  });
});
