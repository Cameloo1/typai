import { createCompletionRequest } from "./context";
import {
  type CompletionMetricEvent,
  type CompletionMetricEventType,
  type CompletionMetricsSink,
  type CompletionMetricsSnapshot,
  createMemoryMetricsSink,
} from "./metrics";
import {
  type CompletionProvider,
  type CompletionProviderError,
  type CompletionRequestBudget,
  createNoopCompletionProvider,
  getSafeCompletionProviderErrorMessage,
  normalizeCompletionProviderError,
} from "./provider";
import { sanitizeCompletionText } from "./sanitize";
import type { CompletionState } from "./state";
import type {
  CompletionDelta,
  CompletionMode,
  CompletionRequest,
  CompletionResponse,
} from "./types";

export const DEFAULT_REMOTE_COMPLETION_OPTIONS = {
  debounceMs: 300,
  timeoutMs: 2500,
  minPrefixChars: 12,
  maxCompletionChars: 220,
  maxConcurrentRequests: 1,
  cooldownAfterRateLimitMs: 30_000,
  streamingMinCharsBeforeRender: 1,
} as const;

export type CompletionDismissReason =
  | "typing"
  | "escape"
  | "selection_change"
  | "blur"
  | "composition"
  | "paste"
  | "correction_transaction"
  | "stale"
  | "provider_error"
  | "manual";

export type CompletionScheduleInput = {
  mode: CompletionMode;
  contextBefore: string;
  contextAfter: string;
  currentLine: string;
  cursorOffset: number;
  surface?: string;
  metadata?: Record<string, unknown>;
};

export type CompletionEventType =
  | "request_scheduled"
  | "request_canceled_before_send"
  | "request_aborted_in_flight"
  | "provider_error"
  | "provider_latency"
  | "stream_started"
  | "stream_delta"
  | "stream_completed"
  | "stream_aborted"
  | "stream_stale_delta_dropped"
  | "ghost_shown"
  | "ghost_dismissed"
  | "ghost_accepted"
  | "completion_reverted";

export type CompletionEvent = {
  type: CompletionEventType;
  timestampMs: number;
  state: CompletionState;
  requestId?: string;
  providerName?: string;
  model?: string;
  latencyMs?: number;
  reason?: string;
  providerErrorKind?: CompletionProviderError["kind"];
  retryAfterMs?: number;
  metadata?: Record<string, unknown>;
};

export type RemoteCompletionOptions = {
  provider?: CompletionProvider;
  debounceMs?: number;
  timeoutMs?: number;
  minPrefixChars?: number;
  maxCompletionChars?: number;
  stopSequences?: string[];
  streaming?: false | RemoteCompletionStreamingOptions;
  metrics?: CompletionMetricsSink;
  maxMetricEvents?: number;
  requestBudget?: CompletionRequestBudget;
};

export type RemoteCompletionStreamingOptions = {
  enabled: boolean;
  minCharsBeforeRender?: number;
};

export type RemoteCompletionController = {
  provider: CompletionProvider;
  debounceMs: number;
  timeoutMs: number;
  minPrefixChars: number;
  maxCompletionChars: number;
  schedule(input: CompletionScheduleInput): void;
  dismiss(reason: CompletionDismissReason): void;
  accept(): CompletionResponse | null;
  cancel(): void;
  getState(): CompletionState;
  subscribe(listener: (event: CompletionEvent) => void): () => void;
  subscribeMetrics(listener: (event: CompletionMetricEvent) => void): () => void;
  getMetricsSnapshot(): CompletionMetricsSnapshot;
  resetMetrics(): void;
  revert(requestId: string): void;
  destroy(): void;
  dispose(): void;
};

type ScheduledRequest = {
  requestId: string;
  timerId: ReturnType<typeof setTimeout>;
};

type InFlightRequest = {
  requestId: string;
  controller: AbortController;
  streaming: boolean;
};

type StreamAbortReason = CompletionDismissReason | "accept";

type RequestMetricsContext = {
  requestId: string;
  mode: CompletionMode;
  surface?: string;
  contextBeforeLength: number;
  contextAfterLength: number;
  scheduledAtMs: number;
  requestStartedAtMs?: number;
  responseReceivedAtMs?: number;
  ghostShownAtMs?: number;
  completionLength?: number;
  providerName?: string;
};

export function createRemoteCompletion(
  options: RemoteCompletionOptions = {},
): RemoteCompletionController {
  const provider = options.provider ?? createNoopCompletionProvider();
  const metricsLog = createMemoryMetricsSink({
    maxEvents: options.maxMetricEvents,
  });
  const externalMetrics = options.metrics;
  const debounceMs = options.debounceMs ?? DEFAULT_REMOTE_COMPLETION_OPTIONS.debounceMs;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REMOTE_COMPLETION_OPTIONS.timeoutMs;
  const minPrefixChars = options.minPrefixChars ?? DEFAULT_REMOTE_COMPLETION_OPTIONS.minPrefixChars;
  const maxCompletionChars =
    options.maxCompletionChars ?? DEFAULT_REMOTE_COMPLETION_OPTIONS.maxCompletionChars;
  const stopSequences = options.stopSequences ?? [];
  const streaming = normalizeStreamingOptions(options.streaming);
  const requestBudget = normalizeRequestBudget(options.requestBudget);
  const listeners = new Set<(event: CompletionEvent) => void>();

  let state: CompletionState = { status: "idle" };
  let requestCounter = 0;
  let activeRequestId: string | null = null;
  let scheduledRequest: ScheduledRequest | null = null;
  let inFlightRequest: InFlightRequest | null = null;
  let showingResponse: CompletionResponse | null = null;
  let cooldownUntilMs = 0;
  const requestStartedAtMsWindow: number[] = [];
  const requestMetrics = new Map<string, RequestMetricsContext>();
  let destroyed = false;

  const controller: RemoteCompletionController = {
    provider,
    debounceMs,
    timeoutMs,
    minPrefixChars,
    maxCompletionChars,
    schedule(input) {
      if (destroyed) {
        return;
      }

      const now = performance.now();

      cancelScheduledRequest("request_canceled_before_send");
      dismissShowingAsStale();
      abortInFlightRequest("request_aborted_in_flight", "typing");

      if (isInRateLimitCooldown(now)) {
        activeRequestId = null;
        state = { status: "idle" };
        recordMetric("request_budget_exceeded", undefined, {
          reason: "rate_limit_cooldown",
          budgetLimit: "rate_limit_cooldown",
          cooldownUntilMs,
        });
        return;
      }

      if (input.contextBefore.length < minPrefixChars) {
        activeRequestId = null;
        state = { status: "idle" };
        return;
      }

      const budgetLimit = getExceededRequestBudget(now);
      if (budgetLimit !== null) {
        activeRequestId = null;
        state = { status: "idle" };
        recordMetric("request_budget_exceeded", undefined, {
          reason: budgetLimit,
          budgetLimit,
        });
        return;
      }

      const requestId = createRequestId();
      const scheduledAtMs = now;
      requestMetrics.set(requestId, {
        requestId,
        mode: input.mode,
        surface: normalizeSurface(input.surface),
        contextBeforeLength: input.contextBefore.length,
        contextAfterLength: input.contextAfter.length,
        scheduledAtMs,
      });
      activeRequestId = requestId;
      state = { status: "scheduled", requestId };
      emit({
        type: "request_scheduled",
        requestId,
      });
      recordMetric("request_scheduled", requestId, {}, scheduledAtMs);

      scheduledRequest = {
        requestId,
        timerId: setTimeout(() => {
          if (destroyed || activeRequestId !== requestId) {
            return;
          }

          scheduledRequest = null;
          void requestCompletion(requestId, input);
        }, debounceMs),
      };
    },
    dismiss(reason) {
      if (state.status !== "showing") {
        cancel(reason);
        return;
      }

      const { requestId } = state;
      abortInFlightRequestFor(requestId, "request_aborted_in_flight", reason);
      showingResponse = null;
      activeRequestId = null;
      state = { status: "dismissed", requestId, reason };
      emit({
        type: "ghost_dismissed",
        requestId,
        reason,
      });
      recordGhostDismissed(requestId, reason);
    },
    accept() {
      if (state.status !== "showing" || showingResponse === null) {
        return null;
      }

      const response = showingResponse;
      const { requestId } = state;
      abortInFlightRequestFor(requestId, "request_aborted_in_flight", "accept");
      showingResponse = null;
      activeRequestId = null;
      state = { status: "accepted", requestId };
      emit({
        type: "ghost_accepted",
        requestId,
        providerName: response.providerName,
      });
      recordMetric("ghost_accepted", requestId, {
        completionLength: response.text.length,
        providerName: response.providerName,
        timeFromGhostVisibleToAcceptOrDismissMs: measureGhostVisibleToAction(requestId),
      });

      return response;
    },
    cancel,
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    subscribeMetrics(listener) {
      return metricsLog.subscribe(listener);
    },
    getMetricsSnapshot() {
      return metricsLog.getSnapshot();
    },
    resetMetrics() {
      metricsLog.reset();
    },
    revert(requestId) {
      emit({
        type: "completion_reverted",
        requestId,
      });
      recordMetric("completion_reverted", requestId);
    },
    destroy() {
      destroyed = true;
      cancel();
      listeners.clear();
    },
    dispose() {
      controller.destroy();
    },
  };

  return controller;

  function createRequestId(): string {
    requestCounter += 1;
    return `completion-${requestCounter}`;
  }

  async function requestCompletion(
    requestId: string,
    input: CompletionScheduleInput,
  ): Promise<void> {
    const abortController = new AbortController();
    const request = createCompletionRequest({
      id: requestId,
      mode: input.mode,
      contextBefore: input.contextBefore,
      contextAfter: input.contextAfter,
      currentLine: input.currentLine,
      cursorOffset: input.cursorOffset,
      maxCompletionChars,
      stopSequences,
      metadata: input.metadata,
    });

    const useStreaming = streaming.enabled && provider.streamComplete !== undefined;

    inFlightRequest = {
      requestId,
      controller: abortController,
      streaming: useStreaming,
    };
    const requestStartedAtMs = performance.now();
    updateRequestMetrics(requestId, {
      requestStartedAtMs,
    });
    recordRequestStartedAt(requestStartedAtMs);
    state = { status: "requesting", requestId };

    try {
      if (useStreaming && provider.streamComplete !== undefined) {
        await requestStreamingCompletion(requestId, request, abortController);
        return;
      }

      const response = await provider.complete(request, {
        signal: abortController.signal,
        timeoutMs,
      });
      const responseReceivedAtMs = performance.now();

      if (!isCurrentInFlightRequest(requestId)) {
        recordMetric(
          "stale_response_dropped",
          requestId,
          {
            completionLength: response.text.length,
            providerName: response.providerName,
            status: "stale",
            reason: "stale",
          },
          responseReceivedAtMs,
        );
        return;
      }

      inFlightRequest = null;
      updateRequestMetrics(requestId, {
        responseReceivedAtMs,
        providerName: response.providerName,
      });
      emit({
        type: "provider_latency",
        requestId,
        providerName: response.providerName,
        latencyMs: response.latencyMs,
      });
      recordMetric(
        "provider_latency",
        requestId,
        {
          providerName: response.providerName,
          latencyMs: response.latencyMs,
          timeFromLastUserInputToRequestStartMs: measureInputToRequestStart(requestId),
          timeFromRequestStartToResponseMs: measureRequestStartToResponse(requestId),
        },
        responseReceivedAtMs,
      );

      const text = sanitizeCompletionText(response.text, {
        contextBefore: request.contextBefore,
        maxCompletionChars,
        stopSequences,
      });

      if (text.length === 0) {
        activeRequestId = null;
        showingResponse = null;
        state = { status: "idle" };
        return;
      }

      const sanitizedResponse: CompletionResponse = {
        ...response,
        text,
      };

      activeRequestId = requestId;
      showingResponse = sanitizedResponse;
      const ghostShownAtMs = performance.now();
      updateRequestMetrics(requestId, {
        completionLength: text.length,
        ghostShownAtMs,
        providerName: response.providerName,
      });
      state = {
        status: "showing",
        requestId,
        text,
      };
      emit({
        type: "ghost_shown",
        requestId,
        providerName: response.providerName,
        model: response.model,
        latencyMs: response.latencyMs,
      });
      recordMetric(
        "ghost_shown",
        requestId,
        {
          completionLength: text.length,
          providerName: response.providerName,
          latencyMs: response.latencyMs,
          timeFromLastUserInputToGhostVisibleMs: measureInputToGhostVisible(requestId),
        },
        ghostShownAtMs,
      );
    } catch (error) {
      if (!isCurrentInFlightRequest(requestId)) {
        return;
      }

      inFlightRequest = null;

      if (abortController.signal.aborted) {
        markRequestStale(requestId);
        return;
      }

      const providerError = normalizeCompletionProviderError(error);
      const message = getSafeCompletionProviderErrorMessage(providerError);
      const timestampMs = performance.now();
      activeRequestId = null;
      showingResponse = null;
      state = {
        status: "error",
        requestId,
        error: message,
        providerErrorKind: providerError.kind,
      };
      emit({
        type: "provider_error",
        requestId,
        reason: providerError.kind,
        providerErrorKind: providerError.kind,
        retryAfterMs: getRetryAfterMs(providerError),
      });
      recordMetric(
        "provider_error",
        requestId,
        {
          reason: providerError.kind,
          providerErrorKind: providerError.kind,
          retryAfterMs: getRetryAfterMs(providerError),
        },
        timestampMs,
      );
      recordProviderErrorSpecificMetrics(requestId, providerError, timestampMs);
    }
  }

  async function requestStreamingCompletion(
    requestId: string,
    request: CompletionRequest,
    abortController: AbortController,
  ): Promise<void> {
    const streamStartedAtMs = performance.now();
    const providerName = provider.name;
    let accumulatedText = "";
    let renderedText = "";
    let ghostMetricRecorded = false;

    updateRequestMetrics(requestId, {
      providerName,
    });
    emit({
      type: "stream_started",
      requestId,
      providerName,
    });
    recordMetric(
      "stream_started",
      requestId,
      {
        providerName,
      },
      streamStartedAtMs,
    );

    for await (const delta of provider.streamComplete?.(request, {
      signal: abortController.signal,
      timeoutMs,
    }) ?? []) {
      const deltaReceivedAtMs = performance.now();

      if (delta.id !== requestId || !isCurrentInFlightRequest(requestId)) {
        recordStaleStreamDelta(requestId, delta, deltaReceivedAtMs);
        continue;
      }

      accumulatedText += delta.textDelta;

      const text = sanitizeCompletionText(accumulatedText, {
        contextBefore: request.contextBefore,
        maxCompletionChars,
        stopSequences,
      });

      updateRequestMetrics(requestId, {
        completionLength: text.length,
        providerName,
      });
      emit({
        type: "stream_delta",
        requestId,
        providerName,
      });
      recordMetric(
        "stream_delta",
        requestId,
        {
          completionLength: text.length,
          providerName,
        },
        deltaReceivedAtMs,
      );

      if (text.length >= streaming.minCharsBeforeRender && text !== renderedText) {
        renderedText = text;
        renderStreamingGhost({
          requestId,
          text,
          providerName,
          timestampMs: deltaReceivedAtMs,
          ghostMetricRecorded,
        });
        ghostMetricRecorded = true;
      }

      if (delta.done === true) {
        break;
      }
    }

    if (!isCurrentInFlightRequest(requestId)) {
      return;
    }

    const completedAtMs = performance.now();
    const latencyMs = measureRequestLatency(requestId, completedAtMs);
    inFlightRequest = null;
    updateRequestMetrics(requestId, {
      responseReceivedAtMs: completedAtMs,
      completionLength: renderedText.length,
      providerName,
    });
    emit({
      type: "stream_completed",
      requestId,
      providerName,
      latencyMs,
    });
    recordMetric(
      "stream_completed",
      requestId,
      {
        completionLength: renderedText.length,
        providerName,
        latencyMs,
      },
      completedAtMs,
    );
    emit({
      type: "provider_latency",
      requestId,
      providerName,
      latencyMs,
    });
    recordMetric(
      "provider_latency",
      requestId,
      {
        providerName,
        latencyMs,
        timeFromLastUserInputToRequestStartMs: measureInputToRequestStart(requestId),
        timeFromRequestStartToResponseMs: measureRequestStartToResponse(requestId),
      },
      completedAtMs,
    );

    if (renderedText.length === 0) {
      activeRequestId = null;
      showingResponse = null;
      state = { status: "idle" };
    }
  }

  function renderStreamingGhost(options: {
    requestId: string;
    text: string;
    providerName: string;
    timestampMs: number;
    ghostMetricRecorded: boolean;
  }): void {
    const latencyMs = measureRequestLatency(options.requestId, options.timestampMs);
    const response: CompletionResponse = {
      id: options.requestId,
      text: options.text,
      providerName: options.providerName,
      latencyMs,
      finishReason: "streaming",
    };

    activeRequestId = options.requestId;
    showingResponse = response;
    const metricsUpdates: Partial<RequestMetricsContext> = {
      completionLength: options.text.length,
      providerName: options.providerName,
    };

    if (!options.ghostMetricRecorded) {
      metricsUpdates.ghostShownAtMs = options.timestampMs;
    }

    updateRequestMetrics(options.requestId, metricsUpdates);
    state = {
      status: "showing",
      requestId: options.requestId,
      text: options.text,
    };
    emit({
      type: "ghost_shown",
      requestId: options.requestId,
      providerName: options.providerName,
      latencyMs,
    });

    if (options.ghostMetricRecorded) {
      return;
    }

    recordMetric(
      "ghost_shown",
      options.requestId,
      {
        completionLength: options.text.length,
        providerName: options.providerName,
        latencyMs,
        timeFromLastUserInputToGhostVisibleMs: measureInputToGhostVisible(options.requestId),
      },
      options.timestampMs,
    );
  }

  function recordStaleStreamDelta(
    requestId: string,
    delta: CompletionDelta,
    timestampMs: number,
  ): void {
    emit({
      type: "stream_stale_delta_dropped",
      requestId,
      providerName: provider.name,
      reason: "stale",
    });
    recordMetric(
      "stream_stale_delta_dropped",
      requestId,
      {
        completionLength: delta.textDelta.length,
        providerName: provider.name,
        status: "stale",
        reason: "stale",
      },
      timestampMs,
    );
  }

  function isInRateLimitCooldown(now: number): boolean {
    return cooldownUntilMs > now;
  }

  function getExceededRequestBudget(now: number): keyof CompletionRequestBudget | null {
    trimRequestStartedAtWindow(now);

    if (
      requestBudget.maxRequestsPerMinute !== undefined &&
      requestStartedAtMsWindow.length >= requestBudget.maxRequestsPerMinute
    ) {
      return "maxRequestsPerMinute";
    }

    return null;
  }

  function recordRequestStartedAt(timestampMs: number): void {
    trimRequestStartedAtWindow(timestampMs);
    requestStartedAtMsWindow.push(timestampMs);
  }

  function trimRequestStartedAtWindow(now: number): void {
    const oneMinuteAgo = now - 60_000;

    while (
      requestStartedAtMsWindow.length > 0 &&
      (requestStartedAtMsWindow[0] ?? 0) <= oneMinuteAgo
    ) {
      requestStartedAtMsWindow.shift();
    }
  }

  function recordProviderErrorSpecificMetrics(
    requestId: string,
    providerError: CompletionProviderError,
    timestampMs: number,
  ): void {
    if (providerError.kind === "timeout") {
      recordMetric(
        "provider_timeout",
        requestId,
        {
          reason: providerError.kind,
          providerErrorKind: providerError.kind,
        },
        timestampMs,
      );
      return;
    }

    if (providerError.kind === "invalid_response") {
      recordMetric(
        "invalid_response",
        requestId,
        {
          reason: providerError.kind,
          providerErrorKind: providerError.kind,
        },
        timestampMs,
      );
      return;
    }

    if (providerError.kind !== "rate_limited") {
      return;
    }

    const cooldownMs = providerError.retryAfterMs ?? requestBudget.cooldownAfterRateLimitMs;

    if (cooldownMs <= 0) {
      return;
    }

    cooldownUntilMs = Math.max(cooldownUntilMs, timestampMs + cooldownMs);
    recordMetric(
      "rate_limit_cooldown_started",
      requestId,
      {
        reason: providerError.kind,
        providerErrorKind: providerError.kind,
        retryAfterMs: cooldownMs,
        cooldownUntilMs,
      },
      timestampMs,
    );
  }

  function cancel(reason: StreamAbortReason = "manual"): void {
    cancelScheduledRequest("request_canceled_before_send");
    abortInFlightRequest("request_aborted_in_flight", reason);
    activeRequestId = null;
    showingResponse = null;
    state = { status: "idle" };
  }

  function cancelScheduledRequest(eventType: "request_canceled_before_send"): void {
    if (scheduledRequest === null) {
      return;
    }

    const { requestId, timerId } = scheduledRequest;
    clearTimeout(timerId);
    scheduledRequest = null;
    emit({
      type: eventType,
      requestId,
    });
    recordMetric(eventType, requestId);
  }

  function abortInFlightRequest(
    eventType: "request_aborted_in_flight",
    reason: StreamAbortReason,
  ): void {
    if (inFlightRequest === null) {
      return;
    }

    const { requestId } = inFlightRequest;
    abortInFlightRequestFor(requestId, eventType, reason);
  }

  function abortInFlightRequestFor(
    requestId: string,
    eventType: "request_aborted_in_flight",
    reason: StreamAbortReason,
  ): void {
    if (inFlightRequest === null || inFlightRequest.requestId !== requestId) {
      return;
    }

    const { controller: abortController, streaming: isStreamingRequest } = inFlightRequest;
    inFlightRequest = null;
    abortController.abort();
    markRequestStale(requestId);
    emit({
      type: eventType,
      requestId,
    });
    recordMetric(eventType, requestId);

    if (!isStreamingRequest) {
      return;
    }

    emit({
      type: "stream_aborted",
      requestId,
      providerName: provider.name,
      reason,
    });
    recordMetric("stream_aborted", requestId, {
      providerName: provider.name,
      reason,
    });
  }

  function dismissShowingAsStale(): void {
    if (state.status !== "showing") {
      return;
    }

    const { requestId } = state;
    showingResponse = null;
    state = { status: "stale", requestId };
    emit({
      type: "ghost_dismissed",
      requestId,
      reason: "typing",
    });
    recordGhostDismissed(requestId, "typing");
  }

  function markRequestStale(requestId: string): void {
    if (
      (state.status === "requesting" || state.status === "showing") &&
      state.requestId === requestId
    ) {
      state = { status: "stale", requestId };
    }
  }

  function isCurrentInFlightRequest(requestId: string): boolean {
    return (
      !destroyed &&
      activeRequestId === requestId &&
      inFlightRequest !== null &&
      inFlightRequest.requestId === requestId
    );
  }

  function emit(event: Omit<CompletionEvent, "timestampMs" | "state">): void {
    const completionEvent = {
      ...event,
      timestampMs: performance.now(),
      state,
    };

    for (const listener of listeners) {
      listener(completionEvent);
    }
  }

  function recordGhostDismissed(requestId: string, reason: CompletionDismissReason): void {
    const metricType = getGhostDismissedMetricType(reason);

    if (metricType === null) {
      return;
    }

    recordMetric(metricType, requestId, {
      reason,
      timeFromGhostVisibleToAcceptOrDismissMs: measureGhostVisibleToAction(requestId),
    });
  }

  function recordMetric(
    type: CompletionMetricEventType,
    requestId?: string,
    overrides: Partial<Omit<CompletionMetricEvent, "type" | "timestampMs">> = {},
    timestampMs = performance.now(),
  ): void {
    const context = requestId ? requestMetrics.get(requestId) : undefined;
    const event: CompletionMetricEvent = {
      type,
      timestampMs,
      requestId,
      mode: context?.mode,
      surface: context?.surface,
      contextBeforeLength: context?.contextBeforeLength,
      contextAfterLength: context?.contextAfterLength,
      completionLength: context?.completionLength,
      providerName: context?.providerName,
      status: state.status,
      ...overrides,
    };

    metricsLog.record(event);
    externalMetrics?.record(event);
  }

  function updateRequestMetrics(requestId: string, updates: Partial<RequestMetricsContext>): void {
    const current = requestMetrics.get(requestId);

    if (current === undefined) {
      return;
    }

    requestMetrics.set(requestId, {
      ...current,
      ...updates,
    });
  }

  function measureInputToRequestStart(requestId: string): number | undefined {
    const context = requestMetrics.get(requestId);

    if (context?.requestStartedAtMs === undefined) {
      return undefined;
    }

    return context.requestStartedAtMs - context.scheduledAtMs;
  }

  function measureRequestStartToResponse(requestId: string): number | undefined {
    const context = requestMetrics.get(requestId);

    if (context?.requestStartedAtMs === undefined || context.responseReceivedAtMs === undefined) {
      return undefined;
    }

    return context.responseReceivedAtMs - context.requestStartedAtMs;
  }

  function measureRequestLatency(requestId: string, timestampMs = performance.now()): number {
    const context = requestMetrics.get(requestId);

    if (context?.requestStartedAtMs === undefined) {
      return 0;
    }

    return timestampMs - context.requestStartedAtMs;
  }

  function measureInputToGhostVisible(requestId: string): number | undefined {
    const context = requestMetrics.get(requestId);

    if (context?.ghostShownAtMs === undefined) {
      return undefined;
    }

    return context.ghostShownAtMs - context.scheduledAtMs;
  }

  function measureGhostVisibleToAction(requestId: string): number | undefined {
    const context = requestMetrics.get(requestId);

    if (context?.ghostShownAtMs === undefined) {
      return undefined;
    }

    return performance.now() - context.ghostShownAtMs;
  }
}

function getGhostDismissedMetricType(
  reason: CompletionDismissReason,
): CompletionMetricEventType | null {
  switch (reason) {
    case "typing":
      return "ghost_dismissed_by_typing";
    case "escape":
      return "ghost_dismissed_by_escape";
    case "selection_change":
      return "ghost_dismissed_by_selection_change";
    case "blur":
      return "ghost_dismissed_by_blur";
    case "composition":
      return "ghost_dismissed_by_composition";
    default:
      return null;
  }
}

function normalizeSurface(surface: string | undefined): string | undefined {
  if (surface === undefined) {
    return undefined;
  }

  const normalized = surface.trim().toLowerCase();

  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

type NormalizedCompletionRequestBudget = {
  maxRequestsPerMinute?: number;
  maxConcurrentRequests: number;
  cooldownAfterRateLimitMs: number;
};

type NormalizedRemoteCompletionStreamingOptions = {
  enabled: boolean;
  minCharsBeforeRender: number;
};

function normalizeStreamingOptions(
  streaming: RemoteCompletionOptions["streaming"],
): NormalizedRemoteCompletionStreamingOptions {
  if (streaming === false || streaming?.enabled !== true) {
    return {
      enabled: false,
      minCharsBeforeRender: DEFAULT_REMOTE_COMPLETION_OPTIONS.streamingMinCharsBeforeRender,
    };
  }

  return {
    enabled: true,
    minCharsBeforeRender: normalizePositiveInteger(
      streaming.minCharsBeforeRender,
      DEFAULT_REMOTE_COMPLETION_OPTIONS.streamingMinCharsBeforeRender,
    ),
  };
}

function normalizeRequestBudget(
  budget: CompletionRequestBudget | undefined,
): NormalizedCompletionRequestBudget {
  return {
    maxRequestsPerMinute: normalizeOptionalNonNegativeInteger(budget?.maxRequestsPerMinute),
    maxConcurrentRequests: normalizePositiveInteger(
      budget?.maxConcurrentRequests,
      DEFAULT_REMOTE_COMPLETION_OPTIONS.maxConcurrentRequests,
    ),
    cooldownAfterRateLimitMs: normalizeNonNegativeInteger(
      budget?.cooldownAfterRateLimitMs,
      DEFAULT_REMOTE_COMPLETION_OPTIONS.cooldownAfterRateLimitMs,
    ),
  };
}

function normalizeOptionalNonNegativeInteger(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function getRetryAfterMs(providerError: CompletionProviderError): number | undefined {
  return providerError.kind === "rate_limited" ? providerError.retryAfterMs : undefined;
}
