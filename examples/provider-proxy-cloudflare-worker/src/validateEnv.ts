import type { ProviderProxyLimits } from "@typai/provider-proxy-testkit";

export type ProviderProxyWorkerEnv = {
  PROVIDER_MODE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
  ALLOWED_ORIGIN?: string;
  MAX_CONTEXT_BEFORE_CHARS?: string;
  MAX_CONTEXT_AFTER_CHARS?: string;
  MAX_COMPLETION_CHARS?: string;
};

export type OpenAIResponsesEnvConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type ValidatedProviderProxyWorkerEnv = {
  providerMode: "mock" | "openai";
  allowedOrigin: string;
  limits: Partial<ProviderProxyLimits>;
  openai?: OpenAIResponsesEnvConfig;
};

export function validateEnv(env: ProviderProxyWorkerEnv = {}): ValidatedProviderProxyWorkerEnv {
  const providerMode = (env.PROVIDER_MODE ?? "mock").trim().toLowerCase();

  if (providerMode !== "mock" && providerMode !== "openai") {
    throw new Error("Provider proxy example supports PROVIDER_MODE=mock or PROVIDER_MODE=openai.");
  }

  const baseConfig = {
    allowedOrigin: env.ALLOWED_ORIGIN?.trim() || "http://localhost:5173",
    limits: {
      maxContextBeforeChars: readPositiveInteger(env.MAX_CONTEXT_BEFORE_CHARS, 4000),
      maxContextAfterChars: readPositiveInteger(env.MAX_CONTEXT_AFTER_CHARS, 1000),
      maxCompletionChars: readPositiveInteger(env.MAX_COMPLETION_CHARS, 300),
    },
  };

  if (providerMode === "mock") {
    return {
      ...baseConfig,
      providerMode: "mock",
    };
  }

  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when PROVIDER_MODE=openai.");
  }

  return {
    ...baseConfig,
    providerMode: "openai",
    openai: {
      apiKey,
      model: env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      timeoutMs: readPositiveInteger(env.OPENAI_TIMEOUT_MS, 10_000),
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
