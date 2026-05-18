import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CompletionDismissReason,
  CompletionMetricEvent,
  CompletionMetricEventType,
  CompletionProvider,
  CompletionRequest,
  CompletionResponse,
  CompletionScheduleInput,
} from "../src";
import { createMemoryMetricsSink, createRemoteCompletion } from "../src";

describe("remote completion metrics", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits privacy-safe metrics when scheduling", () => {
    const observed: CompletionMetricEvent[] = [];
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request)),
      debounceMs: 300,
    });
    controller.subscribeMetrics((event) => observed.push(event));

    controller.schedule(
      createScheduleInput({
        contextBefore: "RAW_CONTEXT_BEFORE",
        contextAfter: "RAW_CONTEXT_AFTER",
        currentLine: "RAW_CURRENT_LINE",
        metadata: { secret: "RAW_METADATA_VALUE" },
        surface: "contenteditable",
      }),
    );

    expect(observed).toEqual([
      expect.objectContaining({
        type: "request_scheduled",
        requestId: "completion-1",
        mode: "prompt",
        surface: "contenteditable",
        contextBeforeLength: "RAW_CONTEXT_BEFORE".length,
        contextAfterLength: "RAW_CONTEXT_AFTER".length,
        status: "scheduled",
      }),
    ]);
    expect(controller.getMetricsSnapshot().counts.request_scheduled).toBe(1);
    expect(JSON.stringify(observed)).not.toContain("RAW_CONTEXT_BEFORE");
    expect(JSON.stringify(observed)).not.toContain("RAW_CONTEXT_AFTER");
    expect(JSON.stringify(observed)).not.toContain("RAW_CURRENT_LINE");
    expect(JSON.stringify(observed)).not.toContain("RAW_METADATA_VALUE");
  });

  it("emits provider latency and ghost shown timing metrics", async () => {
    vi.useFakeTimers();
    const controller = createRemoteCompletion({
      provider: createProvider(
        (request) =>
          new Promise((resolve) => {
            setTimeout(() => resolve(createResponse(request, " completion", 25)), 25);
          }),
      ),
      debounceMs: 10,
    });

    controller.schedule(createScheduleInput({ surface: "contenteditable" }));
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(25);
    await flushPromises();

    const providerLatency = getMetric(controller, "provider_latency");
    const ghostShown = getMetric(controller, "ghost_shown");

    expect(providerLatency).toMatchObject({
      requestId: "completion-1",
      providerName: "mock",
      latencyMs: 25,
      timeFromLastUserInputToRequestStartMs: 10,
      timeFromRequestStartToResponseMs: 25,
    });
    expect(ghostShown).toMatchObject({
      requestId: "completion-1",
      completionLength: " completion".length,
      providerName: "mock",
      timeFromLastUserInputToGhostVisibleMs: 35,
    });
  });

  it("emits accept, dismiss, and revert metrics", async () => {
    vi.useFakeTimers();
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request, " accepted")),
      debounceMs: 0,
    });

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(20);

    const accepted = controller.accept();
    controller.revert(accepted?.id ?? "missing");

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(5);
    controller.dismiss("escape");

    expect(getMetric(controller, "ghost_accepted")).toMatchObject({
      requestId: "completion-1",
      completionLength: " accepted".length,
      timeFromGhostVisibleToAcceptOrDismissMs: 20,
    });
    expect(getMetric(controller, "completion_reverted")).toMatchObject({
      requestId: "completion-1",
    });
    expect(getMetric(controller, "ghost_dismissed_by_escape")).toMatchObject({
      requestId: "completion-2",
      reason: "escape",
      timeFromGhostVisibleToAcceptOrDismissMs: 5,
    });
  });

  it.each([
    ["typing", "ghost_dismissed_by_typing"],
    ["escape", "ghost_dismissed_by_escape"],
    ["selection_change", "ghost_dismissed_by_selection_change"],
    ["blur", "ghost_dismissed_by_blur"],
    ["composition", "ghost_dismissed_by_composition"],
  ] satisfies Array<
    [CompletionDismissReason, CompletionMetricEventType]
  >)("emits granular dismiss metrics for %s", async (reason, metricType) => {
    vi.useFakeTimers();
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request)),
      debounceMs: 0,
    });

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    controller.dismiss(reason);

    expect(getMetric(controller, metricType)).toMatchObject({
      requestId: "completion-1",
      reason,
    });
  });

  it("emits stale response metrics when a provider ignores abort", async () => {
    vi.useFakeTimers();
    const responses = new Map<string, (response: CompletionResponse) => void>();
    const controller = createRemoteCompletion({
      provider: createProvider(
        (request) =>
          new Promise((resolve) => {
            responses.set(request.id, resolve);
          }),
      ),
      debounceMs: 0,
    });

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    await vi.advanceTimersByTimeAsync(0);
    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    responses.get("completion-1")?.(createResponse({ id: "completion-1" }, " stale"));
    await flushPromises();

    expect(getMetric(controller, "stale_response_dropped")).toMatchObject({
      requestId: "completion-1",
      providerName: "mock",
      completionLength: " stale".length,
      status: "stale",
      reason: "stale",
    });
  });

  it("does not log raw context or raw metadata through internal or external metrics", async () => {
    vi.useFakeTimers();
    const externalMetrics = createMemoryMetricsSink();
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request, " safe")),
      debounceMs: 0,
      metrics: externalMetrics,
    });

    controller.schedule(
      createScheduleInput({
        contextBefore: "RAW_CONTEXT_BEFORE value",
        contextAfter: "RAW_CONTEXT_AFTER value",
        currentLine: "RAW_CURRENT_LINE value",
        metadata: { secret: "RAW_METADATA_VALUE" },
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    const internalSerialized = JSON.stringify(controller.getMetricsSnapshot().events);
    const externalSerialized = JSON.stringify(externalMetrics.events);

    for (const rawValue of [
      "RAW_CONTEXT_BEFORE",
      "RAW_CONTEXT_AFTER",
      "RAW_CURRENT_LINE",
      "RAW_METADATA_VALUE",
    ]) {
      expect(internalSerialized).not.toContain(rawValue);
      expect(externalSerialized).not.toContain(rawValue);
    }
  });

  it("enforces rolling log size and can reset metrics", () => {
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request)),
      debounceMs: 100,
      maxMetricEvents: 3,
    });

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    controller.schedule(createScheduleInput({ contextBefore: "third context value" }));

    const snapshot = controller.getMetricsSnapshot();

    expect(snapshot.maxEvents).toBe(3);
    expect(snapshot.events).toHaveLength(3);
    expect(snapshot.events.map((event) => event.requestId)).toEqual([
      "completion-2",
      "completion-2",
      "completion-3",
    ]);

    controller.resetMetrics();

    expect(controller.getMetricsSnapshot().events).toEqual([]);
    expect(controller.getMetricsSnapshot().counts.request_scheduled).toBe(0);
  });
});

function getMetric(
  controller: ReturnType<typeof createRemoteCompletion>,
  type: CompletionMetricEventType,
): CompletionMetricEvent {
  const event = controller.getMetricsSnapshot().events.find((candidate) => candidate.type === type);

  expect(event).toBeDefined();

  return event as CompletionMetricEvent;
}

function createProvider(complete: CompletionProvider["complete"]): CompletionProvider {
  return {
    name: "mock",
    complete,
  };
}

function createScheduleInput(
  overrides: Partial<CompletionScheduleInput> = {},
): CompletionScheduleInput {
  return {
    mode: "prompt",
    contextBefore: "hello completion context",
    contextAfter: "",
    currentLine: "hello completion context",
    cursorOffset: "hello completion context".length,
    ...overrides,
  };
}

function createResponse(
  request: Pick<CompletionRequest, "id">,
  text = " completion",
  latencyMs = 1,
): CompletionResponse {
  return {
    id: request.id,
    text,
    providerName: "mock",
    latencyMs,
    finishReason: "mock",
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
