import { isRecord } from "./schemas";

export type ProviderProxySafeErrorCode =
  | "invalid_method"
  | "invalid_content_type"
  | "invalid_json"
  | "invalid_request"
  | "context_too_large"
  | "completion_too_large"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_server_error"
  | "provider_client_error"
  | "provider_invalid_response"
  | "internal_error";

export type ProviderProxySafeError = {
  code: ProviderProxySafeErrorCode;
  message: string;
  status: number;
};

export type ProviderProxyErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export const defaultSafeErrorMessages: Record<ProviderProxySafeErrorCode, string> = {
  invalid_method: "Only POST requests are allowed.",
  invalid_content_type: "Request content-type must be application/json.",
  invalid_json: "Request body must be valid JSON.",
  invalid_request: "The completion request is invalid.",
  context_too_large: "The completion context is too large.",
  completion_too_large: "The requested completion is too large.",
  provider_timeout: "The completion provider timed out.",
  provider_rate_limited: "The completion provider is rate limited.",
  provider_server_error: "The completion provider returned a server error.",
  provider_client_error: "The completion provider rejected the request.",
  provider_invalid_response: "The completion provider returned an invalid response.",
  internal_error: "The completion proxy failed.",
};

export function createSafeErrorResponse(
  code: ProviderProxySafeErrorCode,
  message = defaultSafeErrorMessages[code],
): { status: number; error: ProviderProxySafeError; body: ProviderProxyErrorResponse } {
  const fallbackMessage = defaultSafeErrorMessages[code];
  const error = {
    code,
    message: sanitizeSafeErrorMessage(message, fallbackMessage),
    status: getSafeErrorStatus(code),
  };

  return {
    status: error.status,
    error,
    body: {
      error: {
        code: error.code,
        message: error.message,
      },
    },
  };
}

export function getSafeErrorStatus(code: ProviderProxySafeErrorCode): number {
  switch (code) {
    case "invalid_method":
      return 405;
    case "invalid_content_type":
      return 415;
    case "provider_rate_limited":
      return 429;
    case "provider_timeout":
      return 504;
    case "provider_server_error":
    case "provider_client_error":
    case "provider_invalid_response":
      return 502;
    case "internal_error":
      return 500;
    case "invalid_json":
    case "invalid_request":
    case "context_too_large":
    case "completion_too_large":
      return 400;
  }
}

export function mapProviderErrorToSafeError(error: unknown): ProviderProxySafeError {
  const kind = isRecord(error) && typeof error.kind === "string" ? error.kind : undefined;
  const code = providerKindToSafeCode(kind);

  return createSafeErrorResponse(code).error;
}

export function mapUnknownErrorToSafeError(): ProviderProxySafeError {
  return createSafeErrorResponse("internal_error").error;
}

export function isProviderProxyErrorResponse(value: unknown): value is ProviderProxyErrorResponse {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function providerKindToSafeCode(kind: string | undefined): ProviderProxySafeErrorCode {
  switch (kind) {
    case "timeout":
      return "provider_timeout";
    case "rate_limited":
      return "provider_rate_limited";
    case "server_error":
    case "network_error":
    case "abort":
      return "provider_server_error";
    case "client_error":
      return "provider_client_error";
    case "invalid_response":
      return "provider_invalid_response";
    default:
      return "internal_error";
  }
}

function sanitizeSafeErrorMessage(message: string, fallbackMessage: string): string {
  if (message !== fallbackMessage) {
    return fallbackMessage;
  }

  if (containsSecretLikeValue(message) || containsStackTraceLikeValue(message)) {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function containsSecretLikeValue(value: string): boolean {
  return /\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/.test(value) || /\b[A-Z0-9_]*API[_-]?KEY\b/i.test(value);
}

function containsStackTraceLikeValue(value: string): boolean {
  return /\n\s*at\s+\S+/.test(value) || /Error:\s+.+\n\s*at\s+/.test(value);
}
