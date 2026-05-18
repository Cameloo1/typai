import type { CompletionScheduleInput } from "./scheduler";
import type { CompletionInstruction, CompletionMode, CompletionRequest } from "./types";

export const DEFAULT_CONTEXT_BEFORE_CHARS = 2000;
export const DEFAULT_CONTEXT_AFTER_CHARS = 300;
export const DEFAULT_MAX_COMPLETION_CHARS = 220;

export const DEFAULT_COMPLETION_CONSTRAINTS = [
  "Continue from the cursor.",
  "Return only text that should be inserted at the cursor.",
  "Do not answer the user.",
  "Do not explain the completion.",
  "Do not quote the completion.",
  "Do not repeat text that already appears before the cursor.",
  "Match the existing voice, tone, formatting, and markdown style.",
  "Stop at a natural short boundary.",
  "Return an empty string when no useful continuation exists.",
] as const;

export type CompletionContextHook = (input: {
  textBefore: string;
  textAfter: string;
  mode: CompletionMode;
}) => {
  contextBefore: string;
  contextAfter: string;
  metadata?: Record<string, unknown>;
};

export type CompletionContextOptions = {
  beforeChars?: number;
  afterChars?: number;
  includeSelection?: boolean;
  mode?: CompletionMode;
  maxContextChars?: number;
  redact?: CompletionContextHook;
};

export type ExtractCompletionContextInput = {
  fullText: string;
  cursorOffset: number;
  selection?: { start: number; end: number };
  mode: CompletionMode;
  options?: CompletionContextOptions;
};

export type CreateCompletionRequestInput = {
  id: string;
  mode: CompletionMode;
  contextBefore: string;
  contextAfter?: string;
  currentLine?: string;
  cursorOffset?: number;
  maxCompletionChars?: number;
  stopSequences?: string[];
  instruction?: CompletionInstruction;
  metadata?: Record<string, unknown>;
};

export type EndpointCompletionPayload = {
  request: CompletionRequest;
};

export function buildContinuationInstruction(
  constraints: readonly string[] = [],
): CompletionInstruction {
  return {
    task: "continue",
    style: "same_voice",
    output: "continuation_only",
    constraints: [...DEFAULT_COMPLETION_CONSTRAINTS, ...constraints],
  };
}

export function createDefaultCompletionInstruction(): CompletionInstruction {
  return buildContinuationInstruction();
}

export function createCompletionRequest(input: CreateCompletionRequestInput): CompletionRequest {
  return {
    id: input.id,
    mode: input.mode,
    contextBefore: input.contextBefore,
    contextAfter: input.contextAfter ?? "",
    currentLine: input.currentLine ?? inferCurrentLine(input.contextBefore),
    cursorOffset: input.cursorOffset ?? input.contextBefore.length,
    maxCompletionChars: input.maxCompletionChars ?? DEFAULT_MAX_COMPLETION_CHARS,
    stopSequences: input.stopSequences ?? [],
    instruction: input.instruction ?? buildContinuationInstruction(),
    metadata: input.metadata,
  };
}

export function extractCompletionContext(
  input: ExtractCompletionContextInput,
): CompletionScheduleInput {
  const mode = input.options?.mode ?? input.mode;
  const fullText = input.fullText;
  const beforeChars = normalizeLimit(input.options?.beforeChars, DEFAULT_CONTEXT_BEFORE_CHARS);
  const afterChars = normalizeLimit(input.options?.afterChars, DEFAULT_CONTEXT_AFTER_CHARS);
  const maxContextChars = normalizeLimit(input.options?.maxContextChars, beforeChars + afterChars);
  const selection = normalizeSelection(input.selection, fullText.length);
  const includeSelection = input.options?.includeSelection ?? false;
  const cursorOffset = clampOffset(input.cursorOffset, fullText.length);
  const extractionOffset = selection ? selection.start : cursorOffset;
  const textBefore = fullText.slice(0, extractionOffset);
  const textAfter =
    selection && !includeSelection
      ? fullText.slice(selection.end)
      : fullText.slice(extractionOffset);
  let contextBefore = textBefore.slice(-beforeChars);
  let contextAfter = textAfter.slice(0, afterChars);
  let metadata: Record<string, unknown> | undefined;

  ({ contextBefore, contextAfter } = boundContext(contextBefore, contextAfter, maxContextChars));

  if (input.options?.redact) {
    const redacted = input.options.redact({
      textBefore: contextBefore,
      textAfter: contextAfter,
      mode,
    });

    metadata = redacted.metadata;
    ({ contextBefore, contextAfter } = boundContext(
      redacted.contextBefore,
      redacted.contextAfter,
      maxContextChars,
    ));
  }

  return {
    mode,
    contextBefore,
    contextAfter,
    currentLine: inferCurrentLine(contextBefore),
    cursorOffset: contextBefore.length,
    metadata,
  };
}

export function buildEndpointPayload(request: CompletionRequest): EndpointCompletionPayload {
  return { request };
}

export function inferCurrentLine(contextBefore: string): string {
  const lineStart = Math.max(contextBefore.lastIndexOf("\n"), contextBefore.lastIndexOf("\r"));

  return contextBefore.slice(lineStart + 1);
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function clampOffset(offset: number, textLength: number): number {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.min(Math.max(0, Math.floor(offset)), textLength);
}

function normalizeSelection(
  selection: { start: number; end: number } | undefined,
  textLength: number,
): { start: number; end: number } | undefined {
  if (!selection) {
    return undefined;
  }

  const start = clampOffset(Math.min(selection.start, selection.end), textLength);
  const end = clampOffset(Math.max(selection.start, selection.end), textLength);

  if (start === end) {
    return undefined;
  }

  return { start, end };
}

function boundContext(
  contextBefore: string,
  contextAfter: string,
  maxContextChars: number,
): {
  contextBefore: string;
  contextAfter: string;
} {
  if (maxContextChars <= 0) {
    return {
      contextBefore: "",
      contextAfter: "",
    };
  }

  if (contextBefore.length + contextAfter.length <= maxContextChars) {
    return { contextBefore, contextAfter };
  }

  const beforeBudget = Math.min(contextBefore.length, maxContextChars);
  const boundedBefore = contextBefore.slice(-beforeBudget);
  const afterBudget = Math.max(0, maxContextChars - boundedBefore.length);

  return {
    contextBefore: boundedBefore,
    contextAfter: contextAfter.slice(0, afterBudget),
  };
}
