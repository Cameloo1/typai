import { createCompletionRequest } from "./context";
import {
  type CompletionMetricEvent,
  type CompletionMetricEventType,
  type CompletionMetricsSink,
  type CompletionMetricsSnapshot,
  createMemoryMetricsSink,
} from "./metrics";
import { type CompletionProvider, createNoopCompletionProvider } from "./provider";
import { sanitizeCompletionText } from "./sanitize";
import type { CompletionState } from "./state";
import type { CompletionMode, CompletionResponse } from "./types";

export const DEFAULT_REMOTE_COMPLETION_OPTIONS = {
  debounceMs: 300,
  timeoutMs: 2500,
  minPrefixChars: 12,
  maxCompletionChars: 220,
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
  metadata?: Record<string, unknown>;
};

export type RemoteCompletionOptions = {
  provider?: CompletionProvider;
  debounceMs?: number;
  timeoutMs?: number;
  minPrefixChars?: number;
  maxCompletionChars?: number;
  stopSequences?: string[];
  metrics?: CompletionMetricsSink;
  maxMetricEvents?: number;
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
};

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
  const listeners = new Set<(event: CompletionEvent) => void>();

  let state: CompletionState = { status: "idle" };
  let requestCounter = 0;
  let activeRequestId: string | null = null;
  let scheduledRequest: ScheduledRequest | null = null;
  let inFlightRequest: InFlightRequest | null = null;
  let showingResponse: CompletionResponse | null = null;
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

      cancelScheduledRequest("request_canceled_before_send");
      abortInFlightRequest("request_aborted_in_flight");
      dismissShowingAsStale();

      if (input.contextBefore.length < minPrefixChars) {
        activeRequestId = null;
        state = { status: "idle" };
        return;
      }

      const requestId = createRequestId();
      const scheduledAtMs = performance.now();
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
        cancel();
        return;
      }

      const { requestId } = state;
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

    inFlightRequest = {
      requestId,
      controller: abortController,
    };
    const requestStartedAtMs = performance.now();
    updateRequestMetrics(requestId, {
      requestStartedAtMs,
    });
    state = { status: "requesting", requestId };

    try {
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

      const message = error instanceof Error ? error.message : String(error);
      activeRequestId = null;
      showingResponse = null;
      state = { status: "error", requestId, error: message };
      emit({
        type: "provider_error",
        requestId,
        reason: message,
      });
      recordMetric("provider_error", requestId, {
        reason: "provider_error",
      });
    }
  }

  function cancel(): void {
    cancelScheduledRequest("request_canceled_before_send");
    abortInFlightRequest("request_aborted_in_flight");
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

  function abortInFlightRequest(eventType: "request_aborted_in_flight"): void {
    if (inFlightRequest === null) {
      return;
    }

    const { requestId, controller: abortController } = inFlightRequest;
    inFlightRequest = null;
    abortController.abort();
    markRequestStale(requestId);
    emit({
      type: eventType,
      requestId,
    });
    recordMetric(eventType, requestId);
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
