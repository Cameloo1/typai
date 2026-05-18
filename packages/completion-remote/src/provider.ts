import type {
  CompletionDelta,
  CompletionProviderOptions,
  CompletionRequest,
  CompletionResponse,
} from "./types";

export type CompletionProviderError =
  | { kind: "network_error"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "abort"; message: string }
  | { kind: "rate_limited"; message: string; retryAfterMs?: number }
  | { kind: "invalid_response"; message: string }
  | { kind: "server_error"; status: number; message: string }
  | { kind: "client_error"; status: number; message: string };

export type CompletionProviderErrorKind = CompletionProviderError["kind"];

export type CompletionRequestBudget = {
  maxRequestsPerMinute?: number;
  maxConcurrentRequests?: number;
  cooldownAfterRateLimitMs?: number;
};

export class CompletionProviderFailure extends Error {
  readonly providerError: CompletionProviderError;
  readonly kind: CompletionProviderErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(providerError: CompletionProviderError) {
    super(providerError.message);
    this.name = "CompletionProviderFailure";
    this.providerError = providerError;
    this.kind = providerError.kind;

    if ("status" in providerError) {
      this.status = providerError.status;
    }

    if ("retryAfterMs" in providerError) {
      this.retryAfterMs = providerError.retryAfterMs;
    }
  }
}

export type CompletionProvider = {
  name: string;
  complete(
    request: CompletionRequest,
    options: CompletionProviderOptions,
  ): Promise<CompletionResponse>;
  streamComplete?(
    request: CompletionRequest,
    options: CompletionProviderOptions,
  ): AsyncIterable<CompletionDelta>;
};

export type MockCompletionResolver =
  | string
  | ((
      request: CompletionRequest,
      options: CompletionProviderOptions,
    ) => string | CompletionResponse | Promise<string | CompletionResponse>);

export function createNoopCompletionProvider(): CompletionProvider {
  return {
    name: "noop",
    async complete(request) {
      return {
        id: request.id,
        text: "",
        providerName: "noop",
        latencyMs: 0,
        finishReason: "noop",
      };
    },
  };
}

export function normalizeCompletionProviderError(error: unknown): CompletionProviderError {
  if (error instanceof CompletionProviderFailure) {
    return error.providerError;
  }

  if (isAbortLikeError(error)) {
    return {
      kind: "abort",
      message: "Completion provider request was aborted.",
    };
  }

  return {
    kind: "network_error",
    message: "Completion provider request failed.",
  };
}

export function getSafeCompletionProviderErrorMessage(error: CompletionProviderError): string {
  switch (error.kind) {
    case "network_error":
      return "Completion provider request failed.";
    case "timeout":
      return "Completion provider request timed out.";
    case "abort":
      return "Completion provider request was aborted.";
    case "rate_limited":
      return "Completion provider request was rate limited.";
    case "invalid_response":
      return "Completion provider returned an invalid response.";
    case "server_error":
      return "Completion provider returned a server error.";
    case "client_error":
      return "Completion provider returned a client error.";
  }
}

function isAbortLikeError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function createMockCompletionProvider(resolver: MockCompletionResolver): CompletionProvider {
  return {
    name: "mock",
    async complete(request, options) {
      const startedAt = performance.now();
      const result = typeof resolver === "function" ? await resolver(request, options) : resolver;

      if (typeof result !== "string") {
        return result;
      }

      return {
        id: request.id,
        text: result,
        providerName: "mock",
        latencyMs: performance.now() - startedAt,
        finishReason: "mock",
      };
    },
  };
}
