import {
  createSafeErrorResponse,
  mapProviderErrorToSafeError,
  type ProviderProxyErrorResponse,
  validateCompletionProxyRequest,
} from "@typai/provider-proxy-testkit";

import { completeWithMockProvider } from "./mockProvider";
import {
  type ProviderProxyExampleEnv,
  readProviderProxyEnv,
  type ValidatedProviderProxyEnv,
  validateEnv,
} from "./validateEnv";

export type TypaiExpressProxyRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  bodyText: string;
};

export type TypaiExpressProxyResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type TypaiExpressRouteOptions = {
  simulateProviderFailure?: boolean;
};

export async function handleTypaiExpressCompletionRequest(
  request: TypaiExpressProxyRequest,
  env: ProviderProxyExampleEnv = readProviderProxyEnv(),
  options: TypaiExpressRouteOptions = {},
): Promise<TypaiExpressProxyResponse> {
  let config: ValidatedProviderProxyEnv;

  try {
    config = validateEnv(env);
  } catch {
    const safe = createSafeErrorResponse("internal_error");
    return errorResponse(safe.status, safe.body, {});
  }

  const origin = getHeader(request.headers, "origin");
  const corsHeaders = buildCorsHeaders(origin, config.allowedOrigin);

  if (!isOriginAllowed(origin, config.allowedOrigin)) {
    const safe = createSafeErrorResponse("invalid_request");
    return errorResponse(403, safe.body, corsHeaders);
  }

  if ((request.method ?? "").toUpperCase() === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  const validation = validateCompletionProxyRequest(
    {
      method: request.method ?? "",
      contentType: getHeader(request.headers, "content-type"),
      bodyText: request.bodyText,
    },
    { limits: config.limits },
  );

  if (!validation.ok) {
    return errorResponse(validation.status, validation.response, corsHeaders);
  }

  try {
    const completion = await completeWithMockProvider(validation.request, {
      fail: options.simulateProviderFailure,
    });

    return jsonResponse(200, completion, corsHeaders);
  } catch (error) {
    const safeError = mapProviderErrorToSafeError(error);

    return errorResponse(
      safeError.status,
      {
        error: {
          code: safeError.code,
          message: safeError.message,
        },
      },
      corsHeaders,
    );
  }
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string>,
): TypaiExpressProxyResponse {
  return {
    status,
    headers: {
      ...headers,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

function errorResponse(
  status: number,
  body: ProviderProxyErrorResponse,
  headers: Record<string, string>,
): TypaiExpressProxyResponse {
  return jsonResponse(status, body, headers);
}

function getHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | undefined {
  const normalizedName = name.toLowerCase();
  const value = Object.entries(headers ?? {}).find(
    ([headerName]) => headerName.toLowerCase() === normalizedName,
  )?.[1];

  return Array.isArray(value) ? value[0] : value;
}

function isOriginAllowed(origin: string | undefined, allowedOrigin: string): boolean {
  return origin === undefined || origin === allowedOrigin;
}

function buildCorsHeaders(
  origin: string | undefined,
  allowedOrigin: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    vary: "Origin",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };

  if (origin === allowedOrigin) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}
