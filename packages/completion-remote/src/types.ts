export type CompletionMode = "prose" | "prompt" | "markdown" | "command" | "code";

export type CompletionProviderOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CompletionInstruction = {
  task: "continue";
  style: "same_voice";
  output: "continuation_only";
  constraints: string[];
};

export type CompletionRequest = {
  id: string;
  mode: CompletionMode;
  contextBefore: string;
  contextAfter: string;
  currentLine: string;
  cursorOffset: number;
  maxCompletionChars: number;
  stopSequences: string[];
  instruction: CompletionInstruction;
  metadata?: Record<string, unknown>;
};

export type CompletionResponse = {
  id: string;
  text: string;
  providerName: string;
  model?: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  finishReason?: string;
};

export type CompletionDelta = {
  id: string;
  textDelta: string;
  done?: boolean;
};
