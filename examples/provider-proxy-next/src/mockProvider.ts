import {
  CompletionProviderFailure,
  type CompletionRequest,
  createMockCompletionProvider,
} from "@typai/completion-remote";
import {
  type CompletionProxyResponseBody,
  mockCompletionResponse,
} from "@typai/provider-proxy-testkit";

export type MockProviderOptions = {
  fail?: boolean;
};

export async function completeWithMockProvider(
  request: CompletionRequest,
  options: MockProviderOptions = {},
): Promise<CompletionProxyResponseBody> {
  if (options.fail === true) {
    throw new CompletionProviderFailure({
      kind: "server_error",
      message: "Mock provider failure.",
    });
  }

  const provider = createMockCompletionProvider(mockCompletionResponse.text);
  const response = await provider.complete(request, {});

  return {
    text: response.text,
    model: mockCompletionResponse.model,
    usage: mockCompletionResponse.usage,
    finishReason: mockCompletionResponse.finishReason,
  };
}
