import type { CompletionMode, CompletionRequest } from "@typai/completion-remote";

export const PROVIDER_PROXY_ALLOWED_MODES = [
  "prose",
  "prompt",
  "markdown",
  "command",
  "code",
] as const satisfies readonly CompletionMode[];

export type ProviderProxyLimits = {
  maxContextBeforeChars: number;
  maxContextAfterChars: number;
  maxCurrentLineChars: number;
  maxCompletionChars: number;
  maxStopSequences: number;
  maxStopSequenceChars: number;
  maxInstructionConstraints: number;
  maxInstructionConstraintChars: number;
  maxMetadataJsonBytes: number;
  maxRequestBytes: number;
};

export const DEFAULT_PROVIDER_PROXY_LIMITS: ProviderProxyLimits = {
  maxContextBeforeChars: 4000,
  maxContextAfterChars: 1000,
  maxCurrentLineChars: 1000,
  maxCompletionChars: 300,
  maxStopSequences: 8,
  maxStopSequenceChars: 100,
  maxInstructionConstraints: 8,
  maxInstructionConstraintChars: 200,
  maxMetadataJsonBytes: 4096,
  maxRequestBytes: 64 * 1024,
};

export type ProviderProxyPayload = {
  request: CompletionRequest;
};

export type CompletionProxyResponseBody = {
  text: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  finishReason?: string;
};

export function mergeProviderProxyLimits(
  limits: Partial<ProviderProxyLimits> = {},
): ProviderProxyLimits {
  return {
    ...DEFAULT_PROVIDER_PROXY_LIMITS,
    ...limits,
  };
}

export function isProviderProxyPayload(value: unknown): value is ProviderProxyPayload {
  return isRecord(value) && isRecord(value.request);
}

export function isProviderProxyCompletionResponse(
  value: unknown,
): value is CompletionProxyResponseBody {
  if (!isRecord(value) || typeof value.text !== "string") {
    return false;
  }

  if (!isOptionalString(value.model) || !isOptionalString(value.finishReason)) {
    return false;
  }

  if (value.usage === undefined) {
    return true;
  }

  return (
    isRecord(value.usage) &&
    isOptionalFiniteNumber(value.usage.inputTokens) &&
    isOptionalFiniteNumber(value.usage.outputTokens)
  );
}

export function isAllowedCompletionMode(value: unknown): value is CompletionMode {
  return (
    typeof value === "string" && (PROVIDER_PROXY_ALLOWED_MODES as readonly string[]).includes(value)
  );
}

export function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

export function jsonByteLength(value: unknown): number {
  return utf8ByteLength(JSON.stringify(value));
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPositiveBoundedInteger(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= max
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}
