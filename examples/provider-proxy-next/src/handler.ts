import {
  createSafeErrorResponse,
  mapProviderErrorToSafeError,
  validateCompletionProxyRequest,
} from "@typai/provider-proxy-testkit";

import { completeWithMockProvider } from "./mockProvider";
import {
  type ProviderProxyExampleEnv,
  type ValidatedProviderProxyEnv,
  validateEnv,
} from "./validateEnv";

export type TypaiNextHandlerOptions = {
  simulateProviderFailure?: boolean;
};

export async function handleTypaiNextCompletionRequest(
  request: Request,
  env: ProviderProxyExampleEnv = {},
  options: TypaiNextHandlerOptions = {},
): Promise<Response> {
  let config: ValidatedProviderProxyEnv;

  try {
    config = validateEnv(env);
  } catch {
    const safe = createSafeErrorResponse("internal_error");
    return jsonResponse(safe.status, safe.body, {});
  }

  const origin = request.headers.get("origin") ?? undefined;
  const corsHeaders = buildCorsHeaders(origin, config.allowedOrigin);

  if (!isOriginAllowed(origin, config.allowedOrigin)) {
    const safe = createSafeErrorResponse("invalid_request");
    return jsonResponse(403, safe.body, corsHeaders);
  }

  if (request.method.toUpperCase() === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const bodyText = await readRequestBody(request);
  const validation = validateCompletionProxyRequest(
    {
      method: request.method,
      contentType: request.headers.get("content-type"),
      bodyText,
    },
    { limits: config.limits },
  );

  if (!validation.ok) {
    return jsonResponse(validation.status, validation.response, corsHeaders);
  }

  try {
    const completion = await completeWithMockProvider(validation.request, {
      fail: options.simulateProviderFailure,
    });

    return jsonResponse(200, completion, corsHeaders);
  } catch (error) {
    const safeError = mapProviderErrorToSafeError(error);

    return jsonResponse(
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

async function readRequestBody(request: Request): Promise<string> {
  if (request.method.toUpperCase() === "GET" || request.method.toUpperCase() === "HEAD") {
    return "";
  }

  return request.text();
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "content-type": "application/json; charset=utf-8",
    },
  });
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
