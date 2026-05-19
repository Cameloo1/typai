import type { CompletionProviderErrorKind, CompletionRequestBudget } from "./provider";
import type { CompletionMode } from "./types";

export const DEFAULT_COMPLETION_METRICS_MAX_EVENTS = 200;

export const COMPLETION_METRIC_EVENT_TYPES = [
  "request_scheduled",
  "request_canceled_before_send",
  "request_aborted_in_flight",
  "request_budget_exceeded",
  "provider_error",
  "provider_timeout",
  "invalid_response",
  "rate_limit_cooldown_started",
  "provider_latency",
  "stream_started",
  "stream_delta",
  "stream_completed",
  "stream_aborted",
  "stream_stale_delta_dropped",
  "ghost_shown",
  "ghost_dismissed_by_typing",
  "ghost_dismissed_by_escape",
  "ghost_dismissed_by_selection_change",
  "ghost_dismissed_by_blur",
  "ghost_dismissed_by_composition",
  "ghost_accepted",
  "completion_reverted",
  "stale_response_dropped",
] as const;

export type CompletionMetricEventType = (typeof COMPLETION_METRIC_EVENT_TYPES)[number];

export type CompletionMetricEvent = {
  type: CompletionMetricEventType;
  timestampMs: number;
  requestId?: string;
  mode?: CompletionMode;
  surface?: string;
  contextBeforeLength?: number;
  contextAfterLength?: number;
  completionLength?: number;
  providerName?: string;
  latencyMs?: number;
  status?: string;
  reason?: string;
  providerErrorKind?: CompletionProviderErrorKind;
  retryAfterMs?: number;
  cooldownUntilMs?: number;
  budgetLimit?: keyof CompletionRequestBudget | "rate_limit_cooldown";
  timeFromLastUserInputToRequestStartMs?: number;
  timeFromRequestStartToResponseMs?: number;
  timeFromLastUserInputToGhostVisibleMs?: number;
  timeFromGhostVisibleToAcceptOrDismissMs?: number;
};

export type CompletionMetricsSnapshot = {
  events: CompletionMetricEvent[];
  counts: Record<CompletionMetricEventType, number>;
  maxEvents: number;
};

export type CompletionMetricsListener = (event: CompletionMetricEvent) => void;

export type CompletionMetricsSink = {
  record(event: CompletionMetricEvent): void;
};

export type CompletionMetricsStore = CompletionMetricsSink & {
  readonly events: CompletionMetricEvent[];
  readonly maxEvents: number;
  subscribe(listener: CompletionMetricsListener): () => void;
  getSnapshot(): CompletionMetricsSnapshot;
  reset(): void;
};

export type MemoryMetricsSinkOptions = {
  maxEvents?: number;
};

export function createMemoryMetricsSink(
  options: MemoryMetricsSinkOptions = {},
): CompletionMetricsStore {
  const maxEvents = normalizeMaxEvents(options.maxEvents);
  const listeners = new Set<CompletionMetricsListener>();
  let events: CompletionMetricEvent[] = [];

  return {
    get events() {
      return events;
    },
    get maxEvents() {
      return maxEvents;
    },
    record(event) {
      const storedEvent = { ...event };

      events.push(storedEvent);

      if (events.length > maxEvents) {
        events = events.slice(events.length - maxEvents);
      }

      for (const listener of listeners) {
        listener({ ...storedEvent });
      }
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return {
        events: events.map((event) => ({ ...event })),
        counts: countMetricEvents(events),
        maxEvents,
      };
    },
    reset() {
      events = [];
    },
  };
}

function normalizeMaxEvents(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_COMPLETION_METRICS_MAX_EVENTS;
  }

  return Math.max(1, Math.floor(value));
}

function countMetricEvents(
  events: readonly CompletionMetricEvent[],
): Record<CompletionMetricEventType, number> {
  const counts = Object.fromEntries(
    COMPLETION_METRIC_EVENT_TYPES.map((type) => [type, 0]),
  ) as Record<CompletionMetricEventType, number>;

  for (const event of events) {
    counts[event.type] += 1;
  }

  return counts;
}
