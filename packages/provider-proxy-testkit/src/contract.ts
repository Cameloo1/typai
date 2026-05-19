import type { CompletionRequest } from "@typai/completion-remote";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  invalidModeRequest,
  malformedJsonBody,
  mockCompletionResponse,
  oversizedContextAfterRequest,
  oversizedContextBeforeRequest,
  rawContextSentinel,
  secretLikeApiKey,
  validCompletionRequest,
} from "./fixtures";
import {
  isProviderProxyErrorResponse,
  type ProviderProxyErrorResponse,
  type ProviderProxySafeErrorCode,
} from "./safeErrors";
import { type CompletionProxyResponseBody, isProviderProxyCompletionResponse } from "./schemas";

export type ProviderProxyContractScenario = "default" | "provider_failure";

export type ProviderProxyContractRequest = {
  method: string;
  headers: Record<string, string>;
  body: string;
  scenario?: ProviderProxyContractScenario;
};

export type ProviderProxyContractResponse = {
  status: number;
  headers?: Record<string, string>;
  body: string;
};

export type ProviderProxyContractOptions = {
  name: string;
  makeRequest(input: ProviderProxyContractRequest): Promise<ProviderProxyContractResponse>;
  startServer?(): Promise<void> | void;
  stopServer?(): Promise<void> | void;
};

export function runProviderProxyContractSuite(options: ProviderProxyContractOptions): void {
  describe(`${options.name} provider proxy contract`, () => {
    beforeAll(async () => {
      await options.startServer?.();
    });

    afterAll(async () => {
      await options.stopServer?.();
    });

    it("accepts a valid POST JSON request", async () => {
      const response = await options.makeRequest(jsonRequest(validCompletionRequest));
      const body = parseJson(response);

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(isProviderProxyCompletionResponse(body)).toBe(true);
      expect((body as CompletionProxyResponseBody).text).toEqual(expect.any(String));
    });

    it("defaults to mock/no-key mode", async () => {
      const response = await options.makeRequest(jsonRequest(validCompletionRequest));
      const body = parseJson(response);

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(JSON.stringify(body)).not.toContain("api_key");
      expect(JSON.stringify(body)).not.toContain("sk-");
    });

    it("rejects GET", async () => {
      const response = await options.makeRequest({
        ...jsonRequest(validCompletionRequest),
        method: "GET",
      });

      expectError(response, "invalid_method");
    });

    it("rejects malformed JSON", async () => {
      const response = await options.makeRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: malformedJsonBody,
      });

      expectError(response, "invalid_json");
    });

    it("rejects a missing request object", async () => {
      const response = await options.makeRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      expectError(response, "invalid_request");
    });

    it("rejects an invalid mode", async () => {
      const response = await options.makeRequest(jsonRequest(invalidModeRequest));

      expectError(response, "invalid_request");
    });

    it("rejects oversized contextBefore", async () => {
      const response = await options.makeRequest(jsonRequest(oversizedContextBeforeRequest));

      expectError(response, "context_too_large");
    });

    it("rejects oversized contextAfter", async () => {
      const response = await options.makeRequest(jsonRequest(oversizedContextAfterRequest));

      expectError(response, "context_too_large");
    });

    it("rejects too-large maxCompletionChars", async () => {
      const response = await options.makeRequest(
        jsonRequest({
          ...validCompletionRequest,
          maxCompletionChars: 301,
        }),
      );

      expectError(response, "completion_too_large");
    });

    it("returns a safe response schema", async () => {
      const response = await options.makeRequest(jsonRequest(validCompletionRequest));
      const body = parseJson(response);

      expect(isProviderProxyCompletionResponse(body)).toBe(true);
    });

    it("returns a safe error schema", async () => {
      const response = await options.makeRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: null }),
      });

      const body = expectError(response, "invalid_request");

      expect(body.error.message).toEqual(expect.any(String));
      expect(body.error.message.length).toBeGreaterThan(0);
    });

    it("does not echo API keys or raw context in error responses", async () => {
      const response = await options.makeRequest(
        jsonRequest({
          ...validCompletionRequest,
          contextBefore: rawContextSentinel,
          maxCompletionChars: 9999,
          metadata: {
            apiKey: secretLikeApiKey,
          },
        }),
      );
      const serialized = response.body;

      expectError(response, "completion_too_large");
      expect(serialized).not.toContain(secretLikeApiKey);
      expect(serialized).not.toContain(rawContextSentinel);
      expect(serialized).not.toContain("API_KEY");
    });

    it("handles mocked provider failure safely", async () => {
      const response = await options.makeRequest({
        ...jsonRequest(validCompletionRequest),
        scenario: "provider_failure",
      });
      const body = expectError(response, "provider_server_error");

      expect(body.error.message).not.toContain("Error:");
      expect(body.error.message).not.toContain(" at ");
    });
  });
}

function jsonRequest(request: CompletionRequest): ProviderProxyContractRequest {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ request }),
  };
}

function expectError(
  response: ProviderProxyContractResponse,
  code: ProviderProxySafeErrorCode,
): ProviderProxyErrorResponse {
  const body = parseJson(response);

  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(isProviderProxyErrorResponse(body)).toBe(true);
  expect((body as ProviderProxyErrorResponse).error.code).toBe(code);

  return body as ProviderProxyErrorResponse;
}

function parseJson(response: ProviderProxyContractResponse): unknown {
  try {
    return JSON.parse(response.body);
  } catch (error) {
    throw new Error(`Contract response was not JSON: ${response.body}`, { cause: error });
  }
}

export const providerProxyContractExpectedMockResponse = mockCompletionResponse;
