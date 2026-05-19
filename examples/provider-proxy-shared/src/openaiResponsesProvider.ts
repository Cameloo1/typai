import { CompletionProviderFailure, type CompletionRequest } from "@typai/completion-remote";
import type { CompletionProxyResponseBody } from "@typai/provider-proxy-testkit";

export type OpenAIResponsesProviderConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type OpenAIResponsesFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type OpenAIResponsesCallOptions = {
  fetchImpl?: OpenAIResponsesFetch;
};

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

export async function callOpenAIResponses(
  request: CompletionRequest,
  config: OpenAIResponsesProviderConfig,
  options: OpenAIResponsesCallOptions = {},
): Promise<CompletionProxyResponseBody> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);

  if (typeof fetchImpl !== "function") {
    throw new CompletionProviderFailure({
      kind: "network_error",
      message: "Responses API fetch is unavailable on this server runtime.",
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildResponsesBody(request, config.model)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throwProviderStatus(response.status);
    }

    const body = await readJsonResponse(response);
    const extractedText = extractResponsesText(body);

    if (extractedText === undefined) {
      throw new CompletionProviderFailure({
        kind: "invalid_response",
        message: "OpenAI Responses API response did not include output text.",
      });
    }

    const stoppedText = applyStopSequences(extractedText, request.stopSequences);
    const boundedText = stoppedText.slice(0, request.maxCompletionChars);

    return {
      text: boundedText,
      model: extractModel(body) ?? config.model,
      usage: extractUsage(body),
      finishReason:
        boundedText.length < stoppedText.length ? "length" : (extractFinishReason(body) ?? "stop"),
    };
  } catch (error) {
    if (error instanceof CompletionProviderFailure) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new CompletionProviderFailure({
        kind: "timeout",
        message: "OpenAI Responses API request timed out.",
      });
    }

    throw new CompletionProviderFailure({
      kind: "network_error",
      message: "OpenAI Responses API request failed.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildResponsesBody(request: CompletionRequest, model: string): Record<string, unknown> {
  return {
    model,
    input: [
      {
        role: "developer",
        content: buildContinuationInstruction(request),
      },
      {
        role: "user",
        content: buildBoundedContinuationInput(request),
      },
    ],
    max_output_tokens: Math.max(1, Math.ceil(request.maxCompletionChars / 4)),
    store: false,
  };
}

function buildContinuationInstruction(request: CompletionRequest): string {
  return [
    "Continue the user's text from the cursor.",
    `Task: ${request.instruction.task}.`,
    `Style: ${request.instruction.style}.`,
    `Output: ${request.instruction.output}.`,
    "Return only text that should be inserted at the cursor.",
    "Do not explain, quote, preface, or rewrite existing text.",
    ...request.instruction.constraints,
  ].join("\n");
}

function buildBoundedContinuationInput(request: CompletionRequest): string {
  return [
    `Mode: ${request.mode}`,
    "Context before cursor:",
    request.contextBefore,
    "Current line:",
    request.currentLine,
    "Context after cursor:",
    request.contextAfter,
  ].join("\n");
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new CompletionProviderFailure({
      kind: "invalid_response",
      message: "OpenAI Responses API returned invalid JSON.",
    });
  }
}

function throwProviderStatus(status: number): never {
  if (status === 429) {
    throw new CompletionProviderFailure({
      kind: "rate_limited",
      message: "OpenAI Responses API rate limit reached.",
    });
  }

  if (status >= 500) {
    throw new CompletionProviderFailure({
      kind: "server_error",
      status,
      message: "OpenAI Responses API returned a server error.",
    });
  }

  throw new CompletionProviderFailure({
    kind: "client_error",
    status,
    message: "OpenAI Responses API rejected the request.",
  });
}

function extractResponsesText(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  const output = Array.isArray(body.output) ? body.output : [];
  const textParts: string[] = [];

  for (const outputItem of output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (isRecord(contentItem) && typeof contentItem.text === "string") {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.length > 0 ? textParts.join("") : undefined;
}

function extractModel(body: unknown): string | undefined {
  return isRecord(body) && typeof body.model === "string" ? body.model : undefined;
}

function extractFinishReason(body: unknown): string | undefined {
  if (isRecord(body) && typeof body.status === "string") {
    return body.status;
  }

  return undefined;
}

function extractUsage(body: unknown): CompletionProxyResponseBody["usage"] {
  if (!isRecord(body) || !isRecord(body.usage)) {
    return undefined;
  }

  return {
    inputTokens: readFiniteNumber(body.usage.input_tokens),
    outputTokens: readFiniteNumber(body.usage.output_tokens),
  };
}

function applyStopSequences(text: string, stopSequences: string[]): string {
  let endIndex = text.length;

  for (const stopSequence of stopSequences) {
    if (stopSequence.length === 0) {
      continue;
    }

    const index = text.indexOf(stopSequence);

    if (index >= 0) {
      endIndex = Math.min(endIndex, index);
    }
  }

  return text.slice(0, endIndex);
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
