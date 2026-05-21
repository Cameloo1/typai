import {
  CompletionProviderFailure,
  type CompletionRequest,
  createMockCompletionProvider,
} from "@typai/completion-remote";
import { describe, expect, it } from "vitest";

import {
  malformedJsonBody,
  mockCompletionResponse,
  providerFailureSentinel,
  rawContextSentinel,
  runProviderProxyContractSuite,
  secretLikeApiKey,
  validateCompletionProxyRequest,
  validateCompletionRequestBody,
  validCompletionPayload,
  validCompletionRequest,
} from "../src";
import {
  createSafeErrorResponse,
  isProviderProxyErrorResponse,
  mapProviderErrorToSafeError,
  mapUnknownErrorToSafeError,
} from "../src/safeErrors";

runProviderProxyContractSuite({
  name: "@typai/provider-proxy-testkit in-memory mock",
  async makeRequest(input) {
    if (input.scenario === "provider_failure") {
      const safe = createSafeErrorResponse("provider_server_error");

      return {
        status: safe.status,
        body: JSON.stringify(safe.body),
      };
    }

    const validation = validateCompletionProxyRequest({
      method: input.method,
      contentType: input.headers["content-type"],
      bodyText: input.body,
    });

    if (!validation.ok) {
      return {
        status: validation.status,
        body: JSON.stringify(validation.response),
      };
    }

    const provider = createMockCompletionProvider(mockCompletionResponse.text);
    const providerResponse = await provider.complete(validation.request, {});

    return {
      status: 200,
      body: JSON.stringify({
        text: providerResponse.text,
        model: mockCompletionResponse.model,
        usage: mockCompletionResponse.usage,
        finishReason: mockCompletionResponse.finishReason,
      }),
    };
  },
});

describe("provider proxy request validation", () => {
  it("accepts a parsed valid completion payload", () => {
    const result = validateCompletionRequestBody(validCompletionPayload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.id).toBe(validCompletionRequest.id);
    }
  });

  it("rejects non-JSON content types", () => {
    const result = validateCompletionProxyRequest({
      method: "POST",
      contentType: "text/plain",
      bodyText: JSON.stringify(validCompletionPayload),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_content_type" },
    });
  });

  it("rejects oversized request bodies before JSON parsing", () => {
    const result = validateCompletionProxyRequest(
      {
        method: "POST",
        contentType: "application/json",
        bodyText: JSON.stringify(validCompletionPayload),
      },
      { limits: { maxRequestBytes: 10 } },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
  });

  it("rejects metadata above the configured byte budget", () => {
    const result = validateCompletionRequestBody(
      {
        request: {
          ...validCompletionRequest,
          metadata: {
            large: "x".repeat(100),
          },
        },
      },
      { limits: { maxMetadataJsonBytes: 20 } },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
  });

  it("rejects unknown fields consistently", () => {
    const result = validateCompletionRequestBody({
      request: {
        ...validCompletionRequest,
        providerApiKey: secretLikeApiKey,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
  });

  it("rejects malformed JSON with a safe error response", () => {
    const result = validateCompletionProxyRequest({
      method: "POST",
      contentType: "application/json",
      bodyText: malformedJsonBody,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_json" },
    });
    if (!result.ok) {
      expect(isProviderProxyErrorResponse(result.response)).toBe(true);
    }
  });
});

describe("safe provider proxy errors", () => {
  it("maps provider failures to safe public error codes", () => {
    const safe = mapProviderErrorToSafeError(
      new CompletionProviderFailure({
        kind: "rate_limited",
        message: "rate limit with hidden provider detail",
      }),
    );

    expect(safe).toMatchObject({
      code: "provider_rate_limited",
      message: "The completion provider is rate limited.",
      status: 429,
    });
  });

  it("does not expose stack traces for unknown errors", () => {
    const safe = mapUnknownErrorToSafeError();

    expect(safe.code).toBe("internal_error");
    expect(safe.message).not.toContain("Error:");
    expect(safe.message).not.toContain(" at ");
  });

  it("does not echo raw context or API-key-like strings in safe errors", () => {
    const safe = createSafeErrorResponse(
      "invalid_request",
      `Bad request ${rawContextSentinel} ${secretLikeApiKey}`,
    );
    const serialized = JSON.stringify(safe.body);

    expect(serialized).not.toContain(secretLikeApiKey);
    expect(serialized).not.toContain(rawContextSentinel);
  });

  it("does not need a provider key for mock-mode contract responses", async () => {
    const provider = createMockCompletionProvider((request: CompletionRequest) => ({
      id: request.id,
      text: mockCompletionResponse.text,
      providerName: "mock",
      latencyMs: 0,
      finishReason: "mock",
    }));

    const response = await provider.complete(validCompletionRequest, {});

    expect(response.text).toBe(mockCompletionResponse.text);
    expect(JSON.stringify(response)).not.toContain("sk-");
    expect(JSON.stringify(response)).not.toContain(providerFailureSentinel);
  });
});
