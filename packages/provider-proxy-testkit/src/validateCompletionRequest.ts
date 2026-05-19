import type { CompletionRequest } from "@typai/completion-remote";
import {
  createSafeErrorResponse,
  type ProviderProxyErrorResponse,
  type ProviderProxySafeError,
  type ProviderProxySafeErrorCode,
} from "./safeErrors";
import {
  hasOnlyKeys,
  isAllowedCompletionMode,
  isFiniteNonNegativeNumber,
  isPositiveBoundedInteger,
  isRecord,
  jsonByteLength,
  mergeProviderProxyLimits,
  type ProviderProxyLimits,
  type ProviderProxyPayload,
  utf8ByteLength,
} from "./schemas";

export type ProviderProxyRequestValidationInput = {
  method: string;
  contentType?: string | null;
  bodyText: string;
};

export type ProviderProxyValidationOptions = {
  limits?: Partial<ProviderProxyLimits>;
};

export type ProviderProxyValidationResult =
  | {
      ok: true;
      payload: ProviderProxyPayload;
      request: CompletionRequest;
    }
  | {
      ok: false;
      error: ProviderProxySafeError;
      response: ProviderProxyErrorResponse;
      status: number;
    };

const topLevelPayloadKeys = ["request"] as const;
const requestKeys = [
  "id",
  "mode",
  "contextBefore",
  "contextAfter",
  "currentLine",
  "cursorOffset",
  "maxCompletionChars",
  "stopSequences",
  "instruction",
  "metadata",
] as const;
const instructionKeys = ["task", "style", "output", "constraints"] as const;

export function validateCompletionProxyRequest(
  input: ProviderProxyRequestValidationInput,
  options: ProviderProxyValidationOptions = {},
): ProviderProxyValidationResult {
  const limits = mergeProviderProxyLimits(options.limits);

  if (input.method.toUpperCase() !== "POST") {
    return reject("invalid_method");
  }

  if (!isJsonContentType(input.contentType)) {
    return reject("invalid_content_type");
  }

  if (utf8ByteLength(input.bodyText) > limits.maxRequestBytes) {
    return reject("invalid_request");
  }

  let body: unknown;

  try {
    body = JSON.parse(input.bodyText);
  } catch {
    return reject("invalid_json");
  }

  return validateCompletionRequestBody(body, options);
}

export function validateCompletionRequestBody(
  body: unknown,
  options: ProviderProxyValidationOptions = {},
): ProviderProxyValidationResult {
  const limits = mergeProviderProxyLimits(options.limits);

  if (!isRecord(body) || !hasOnlyKeys(body, topLevelPayloadKeys) || !isRecord(body.request)) {
    return reject("invalid_request");
  }

  const request = body.request;
  const requestValidation = validateCompletionRequestShape(request, limits);

  if (requestValidation !== null) {
    return reject(requestValidation);
  }

  return {
    ok: true,
    payload: {
      request: request as CompletionRequest,
    },
    request: request as CompletionRequest,
  };
}

function validateCompletionRequestShape(
  request: Record<string, unknown>,
  limits: ProviderProxyLimits,
): ProviderProxySafeErrorCode | null {
  if (!hasOnlyKeys(request, requestKeys)) {
    return "invalid_request";
  }

  if (typeof request.id !== "string" || request.id.trim().length === 0) {
    return "invalid_request";
  }

  if (!isAllowedCompletionMode(request.mode)) {
    return "invalid_request";
  }

  if (!isBoundedString(request.contextBefore, limits.maxContextBeforeChars)) {
    return typeof request.contextBefore === "string" ? "context_too_large" : "invalid_request";
  }

  if (!isBoundedString(request.contextAfter, limits.maxContextAfterChars)) {
    return typeof request.contextAfter === "string" ? "context_too_large" : "invalid_request";
  }

  if (!isBoundedString(request.currentLine, limits.maxCurrentLineChars)) {
    return typeof request.currentLine === "string" ? "context_too_large" : "invalid_request";
  }

  if (!isFiniteNonNegativeNumber(request.cursorOffset)) {
    return "invalid_request";
  }

  if (!isPositiveBoundedInteger(request.maxCompletionChars, limits.maxCompletionChars)) {
    return typeof request.maxCompletionChars === "number"
      ? "completion_too_large"
      : "invalid_request";
  }

  if (!isValidStopSequences(request.stopSequences, limits)) {
    return "invalid_request";
  }

  if (!isValidInstruction(request.instruction, limits)) {
    return "invalid_request";
  }

  if (request.metadata !== undefined && !isValidMetadata(request.metadata, limits)) {
    return "invalid_request";
  }

  return null;
}

function isJsonContentType(contentType: string | null | undefined): boolean {
  if (contentType === undefined || contentType === null) {
    return false;
  }

  return contentType
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .includes("application/json");
}

function isBoundedString(value: unknown, maxChars: number): value is string {
  return typeof value === "string" && value.length <= maxChars;
}

function isValidStopSequences(value: unknown, limits: ProviderProxyLimits): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= limits.maxStopSequences &&
    value.every((item) => typeof item === "string" && item.length <= limits.maxStopSequenceChars)
  );
}

function isValidInstruction(value: unknown, limits: ProviderProxyLimits): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, instructionKeys)) {
    return false;
  }

  return (
    value.task === "continue" &&
    value.style === "same_voice" &&
    value.output === "continuation_only" &&
    Array.isArray(value.constraints) &&
    value.constraints.length <= limits.maxInstructionConstraints &&
    value.constraints.every(
      (constraint) =>
        typeof constraint === "string" &&
        constraint.length > 0 &&
        constraint.length <= limits.maxInstructionConstraintChars,
    )
  );
}

function isValidMetadata(value: unknown, limits: ProviderProxyLimits): boolean {
  return isRecord(value) && jsonByteLength(value) <= limits.maxMetadataJsonBytes;
}

function reject(
  code: ProviderProxySafeErrorCode,
): Extract<ProviderProxyValidationResult, { ok: false }> {
  const safe = createSafeErrorResponse(code);

  return {
    ok: false,
    error: safe.error,
    response: safe.body,
    status: safe.status,
  };
}
