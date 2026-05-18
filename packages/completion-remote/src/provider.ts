import type {
  CompletionDelta,
  CompletionProviderOptions,
  CompletionRequest,
  CompletionResponse,
} from "./types";

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
