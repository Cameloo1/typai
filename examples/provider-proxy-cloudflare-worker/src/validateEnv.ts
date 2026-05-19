import type { ProviderProxyLimits } from "@typai/provider-proxy-testkit";

export type ProviderProxyWorkerEnv = {
  PROVIDER_MODE?: string;
  ALLOWED_ORIGIN?: string;
  MAX_CONTEXT_BEFORE_CHARS?: string;
  MAX_CONTEXT_AFTER_CHARS?: string;
  MAX_COMPLETION_CHARS?: string;
};

export type ValidatedProviderProxyWorkerEnv = {
  providerMode: "mock";
  allowedOrigin: string;
  limits: Partial<ProviderProxyLimits>;
};

export function validateEnv(env: ProviderProxyWorkerEnv = {}): ValidatedProviderProxyWorkerEnv {
  const providerMode = (env.PROVIDER_MODE ?? "mock").trim().toLowerCase();

  if (providerMode !== "mock") {
    throw new Error("This V4.2 example only supports PROVIDER_MODE=mock.");
  }

  return {
    providerMode: "mock",
    allowedOrigin: env.ALLOWED_ORIGIN?.trim() || "http://localhost:5173",
    limits: {
      maxContextBeforeChars: readPositiveInteger(env.MAX_CONTEXT_BEFORE_CHARS, 4000),
      maxContextAfterChars: readPositiveInteger(env.MAX_CONTEXT_AFTER_CHARS, 1000),
      maxCompletionChars: readPositiveInteger(env.MAX_COMPLETION_CHARS, 300),
    },
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Provider proxy numeric environment limits must be positive integers.");
  }

  return parsed;
}
