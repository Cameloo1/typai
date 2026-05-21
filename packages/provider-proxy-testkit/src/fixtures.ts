import type { CompletionRequest } from "@typai/completion-remote";

import type { CompletionProxyResponseBody, ProviderProxyPayload } from "./schemas";

export const rawContextSentinel = "RAW_CONTEXT_SENTINEL_do_not_echo";
export const secretLikeApiKey = "TEST_API_KEY_DO_NOT_ECHO";
export const providerFailureSentinel = "provider_failure";

export const validCompletionRequest: CompletionRequest = {
  id: "request-1",
  mode: "prompt",
  contextBefore: "Write a concise release note",
  contextAfter: "",
  currentLine: "Write a concise release note",
  cursorOffset: 28,
  maxCompletionChars: 120,
  stopSequences: [],
  instruction: {
    task: "continue",
    style: "same_voice",
    output: "continuation_only",
    constraints: ["Return only text that should be inserted at the cursor."],
  },
  metadata: {
    source: "provider-proxy-testkit",
  },
};

export const validCompletionPayload: ProviderProxyPayload = {
  request: validCompletionRequest,
};

export const oversizedContextBeforeRequest: CompletionRequest = {
  ...validCompletionRequest,
  id: "request-oversized-context-before",
  contextBefore: "x".repeat(4001),
  cursorOffset: 4001,
};

export const oversizedContextAfterRequest: CompletionRequest = {
  ...validCompletionRequest,
  id: "request-oversized-context-after",
  contextAfter: "x".repeat(1001),
};

export const oversizedContextRequest = oversizedContextBeforeRequest;

export const invalidModeRequest = {
  ...validCompletionRequest,
  id: "request-invalid-mode",
  mode: "unsupported-mode",
} as unknown as CompletionRequest;

export const malformedJsonBody = '{"request":';

export const mockCompletionResponse: CompletionProxyResponseBody = {
  text: " for the public beta readiness contract.",
  model: "mock-provider",
  usage: {
    inputTokens: 24,
    outputTokens: 8,
  },
  finishReason: "mock",
};

export function completionPayload(request: CompletionRequest): ProviderProxyPayload {
  return {
    request,
  };
}
