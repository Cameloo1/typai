import type { CompletionProvider } from "./provider";
import { sanitizeCompletionText } from "./sanitize";
import type { CompletionProviderOptions, CompletionRequest, CompletionResponse } from "./types";

export type EndpointCompletionProviderOptions = {
  endpoint: string;
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  method?: "POST";
  timeoutMs?: number;
};

export type EndpointCompletionProviderErrorCode =
  | "aborted"
  | "headers_error"
  | "http_error"
  | "malformed_response"
  | "network_error"
  | "timeout";

export class EndpointCompletionProviderError extends Error {
  readonly code: EndpointCompletionProviderErrorCode;
  readonly status?: number;

  constructor(
    code: EndpointCompletionProviderErrorCode,
    message: string,
    options: { status?: number } = {},
  ) {
    super(message);
    this.name = "EndpointCompletionProviderError";
    this.code = code;
    this.status = options.status;
  }
}

export function createEndpointCompletionProvider(
  options: EndpointCompletionProviderOptions,
): CompletionProvider {
  return {
    name: "endpoint",
    async complete(request, providerOptions = {}) {
      return completeFromEndpoint(options, request, providerOptions);
    },
  };
}

async function completeFromEndpoint(
  options: EndpointCompletionProviderOptions,
  request: CompletionRequest,
  providerOptions: CompletionProviderOptions,
): Promise<CompletionResponse> {
  const startedAt = performance.now();
  const timeoutMs = providerOptions.timeoutMs ?? options.timeoutMs;
  const controller = new AbortController();
  const providerSignal = providerOptions.signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutExpired = false;

  if (providerSignal?.aborted) {
    throw new EndpointCompletionProviderError(
      "aborted",
      "Endpoint completion request was aborted.",
    );
  }

  const abortFromProviderSignal = () => {
    controller.abort(providerSignal?.reason);
  };

  providerSignal?.addEventListener("abort", abortFromProviderSignal, {
    once: true,
  });

  if (typeof timeoutMs === "number" && timeoutMs >= 0) {
    timeoutId = setTimeout(() => {
      timeoutExpired = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(options.endpoint, {
      body: JSON.stringify({ request }),
      headers: await buildHeaders(options),
      method: options.method ?? "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new EndpointCompletionProviderError(
        "http_error",
        "Endpoint completion request returned an unsuccessful status.",
        { status: response.status },
      );
    }

    const payload = await readJson(response);
    const endpointResponse = parseEndpointCompletionResponse(payload);
    const text = sanitizeCompletionText(endpointResponse.text, {
      contextBefore: request.contextBefore,
      maxCompletionChars: request.maxCompletionChars,
      stopSequences: request.stopSequences,
    });

    return {
      id: request.id,
      text,
      providerName: "endpoint",
      model: endpointResponse.model,
      latencyMs: performance.now() - startedAt,
      usage: endpointResponse.usage,
      finishReason: endpointResponse.finishReason,
    };
  } catch (error) {
    if (error instanceof EndpointCompletionProviderError) {
      throw error;
    }

    if (timeoutExpired) {
      throw new EndpointCompletionProviderError(
        "timeout",
        "Endpoint completion request timed out.",
      );
    }

    if (isAbortLikeError(error) || controller.signal.aborted) {
      throw new EndpointCompletionProviderError(
        "aborted",
        "Endpoint completion request was aborted.",
      );
    }

    throw new EndpointCompletionProviderError(
      "network_error",
      "Endpoint completion request failed.",
    );
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    providerSignal?.removeEventListener("abort", abortFromProviderSignal);
  }
}

async function buildHeaders(
  options: EndpointCompletionProviderOptions,
): Promise<Record<string, string>> {
  let customHeaders: Record<string, string> = {};

  try {
    customHeaders =
      typeof options.headers === "function" ? await options.headers() : (options.headers ?? {});
  } catch {
    throw new EndpointCompletionProviderError(
      "headers_error",
      "Endpoint completion headers could not be resolved.",
    );
  }

  assertStringRecord(customHeaders, "headers");

  return {
    "content-type": "application/json",
    ...customHeaders,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new EndpointCompletionProviderError(
      "malformed_response",
      "Endpoint completion response was not valid JSON.",
    );
  }
}

type EndpointCompletionResponsePayload = {
  text: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  finishReason?: string;
};

function parseEndpointCompletionResponse(payload: unknown): EndpointCompletionResponsePayload {
  if (!isRecord(payload) || typeof payload.text !== "string") {
    throwMalformedResponse();
  }

  const usage = payload.usage;
  if (usage !== undefined) {
    if (!isRecord(usage)) {
      throwMalformedResponse();
    }

    if (!isOptionalNumber(usage.inputTokens) || !isOptionalNumber(usage.outputTokens)) {
      throwMalformedResponse();
    }
  }

  if (!isOptionalString(payload.model) || !isOptionalString(payload.finishReason)) {
    throwMalformedResponse();
  }

  const typedUsage =
    usage === undefined
      ? undefined
      : {
          inputTokens: usage.inputTokens as number | undefined,
          outputTokens: usage.outputTokens as number | undefined,
        };

  return {
    text: payload.text,
    model: payload.model,
    usage: typedUsage,
    finishReason: payload.finishReason,
  };
}

function assertStringRecord(value: Record<string, string>, label: string): void {
  for (const [key, item] of Object.entries(value)) {
    if (typeof key !== "string" || typeof item !== "string") {
      throw new EndpointCompletionProviderError(
        "headers_error",
        `Endpoint completion ${label} must be string values.`,
      );
    }
  }
}

function throwMalformedResponse(): never {
  throw new EndpointCompletionProviderError(
    "malformed_response",
    "Endpoint completion response had an invalid shape.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isAbortLikeError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
