export const COMPLETION_CONFORMANCE_FIXTURES = {
  promptText: "The operator wants typai to continue",
  ghostText: " with a safe suggestion",
  typingDismissText: "!",
  providerErrorText: "The provider-error-trigger stays private",
  stalePromptText: "The stale-response-trigger starts here",
  stalePromptUpdateText: " updated",
  staleGhostText: " stale ignored",
  metricsPrivateText: "private-metric-context-alpha asks for a completion",
  correctionDismissText: " teh ",
} as const;

export async function waitForCompletionCondition(
  predicate: () => boolean,
  message: string,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 500;
  const intervalMs = options.intervalMs ?? 5;
  const startedAt = performance.now();

  while (performance.now() - startedAt <= timeoutMs) {
    if (predicate()) {
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(message);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
