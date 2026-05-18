import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CompletionEvent,
  CompletionProvider,
  CompletionProviderOptions,
  CompletionRequest,
  CompletionResponse,
  CompletionScheduleInput,
} from "../src";
import { createMemoryMetricsSink, createRemoteCompletion } from "../src";

describe("remote completion scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for debounce before calling the provider", async () => {
    vi.useFakeTimers();
    const complete = vi.fn(async (request: CompletionRequest) => createResponse(request));
    const controller = createRemoteCompletion({
      provider: createProvider(complete),
      debounceMs: 300,
    });

    controller.schedule(createScheduleInput());

    expect(complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(299);
    expect(complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({
      status: "showing",
      requestId: "completion-1",
      text: " completion",
    });
  });

  it("resets debounce when schedule is called again", async () => {
    vi.useFakeTimers();
    const complete = vi.fn(async (request: CompletionRequest) => createResponse(request));
    const controller = createRemoteCompletion({
      provider: createProvider(complete),
      debounceMs: 300,
    });

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    await vi.advanceTimersByTimeAsync(299);
    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    await vi.advanceTimersByTimeAsync(299);

    expect(complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      id: "completion-2",
      contextBefore: "second context value",
    });
  });

  it("aborts an in-flight request when a new schedule arrives", async () => {
    vi.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    const events: CompletionEvent[] = [];
    const complete = vi.fn((_request: CompletionRequest, options: CompletionProviderOptions) => {
      firstSignal = options.signal;
      return rejectWhenAborted(options.signal);
    });
    const controller = createRemoteCompletion({
      provider: createProvider(complete),
      debounceMs: 0,
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(complete).toHaveBeenCalledTimes(1);

    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    await flushPromises();

    expect(firstSignal?.aborted).toBe(true);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "request_aborted_in_flight",
          requestId: "completion-1",
        }),
      ]),
    );
    expect(controller.getState()).toEqual({
      status: "scheduled",
      requestId: "completion-2",
    });
  });

  it("drops stale provider responses", async () => {
    vi.useFakeTimers();
    const responses = new Map<string, (response: CompletionResponse) => void>();
    const events: CompletionEvent[] = [];
    const complete = vi.fn(
      (request: CompletionRequest) =>
        new Promise<CompletionResponse>((resolve) => {
          responses.set(request.id, resolve);
        }),
    );
    const controller = createRemoteCompletion({
      provider: createProvider(complete),
      debounceMs: 0,
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState()).toEqual({
      status: "requesting",
      requestId: "completion-1",
    });

    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    responses.get("completion-1")?.({
      id: "completion-1",
      text: " stale",
      providerName: "mock",
      latencyMs: 1,
    });
    await flushPromises();

    expect(events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ghost_shown",
          requestId: "completion-1",
        }),
      ]),
    );
    expect(controller.getState()).toEqual({
      status: "scheduled",
      requestId: "completion-2",
    });

    await vi.advanceTimersByTimeAsync(0);
    responses.get("completion-2")?.({
      id: "completion-2",
      text: " current",
      providerName: "mock",
      latencyMs: 2,
    });
    await flushPromises();

    expect(controller.getState()).toEqual({
      status: "showing",
      requestId: "completion-2",
      text: " current",
    });
  });

  it("emits provider_error when the provider fails", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const complete = vi.fn(async () => {
      throw new Error("provider failed");
    });
    const controller = createRemoteCompletion({
      provider: createProvider(complete),
      debounceMs: 0,
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    expect(controller.getState()).toEqual({
      status: "error",
      requestId: "completion-1",
      error: "provider failed",
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "provider_error",
          requestId: "completion-1",
          reason: "provider failed",
        }),
      ]),
    );
  });

  it("dismisses showing completions with escape", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request)),
      debounceMs: 0,
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    controller.dismiss("escape");

    expect(controller.getState()).toEqual({
      status: "dismissed",
      requestId: "completion-1",
      reason: "escape",
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ghost_dismissed",
          requestId: "completion-1",
          reason: "escape",
        }),
      ]),
    );
  });

  it("accepts showing completions and returns the response", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request, " accepted")),
      debounceMs: 0,
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    const response = controller.accept();

    expect(response).toMatchObject({
      id: "completion-1",
      text: " accepted",
      providerName: "mock",
    });
    expect(controller.getState()).toEqual({
      status: "accepted",
      requestId: "completion-1",
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ghost_accepted",
          requestId: "completion-1",
        }),
      ]),
    );
  });

  it("returns null when accepting outside showing state", () => {
    const controller = createRemoteCompletion();

    expect(controller.accept()).toBeNull();
  });

  it("destroys timers and aborts in-flight requests", async () => {
    vi.useFakeTimers();
    const scheduledComplete = vi.fn(async (request: CompletionRequest) => createResponse(request));
    const scheduledController = createRemoteCompletion({
      provider: createProvider(scheduledComplete),
      debounceMs: 300,
    });

    scheduledController.schedule(createScheduleInput());
    scheduledController.destroy();
    await vi.advanceTimersByTimeAsync(300);

    expect(scheduledComplete).not.toHaveBeenCalled();

    let signal: AbortSignal | undefined;
    const inFlightComplete = vi.fn(
      (_request: CompletionRequest, options: CompletionProviderOptions) => {
        signal = options.signal;
        return rejectWhenAborted(options.signal);
      },
    );
    const inFlightController = createRemoteCompletion({
      provider: createProvider(inFlightComplete),
      debounceMs: 0,
    });

    inFlightController.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    inFlightController.destroy();
    await flushPromises();

    expect(signal?.aborted).toBe(true);
    expect(inFlightController.getState()).toEqual({ status: "idle" });
  });

  it("does not include raw context in default event payloads", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const metrics = createMemoryMetricsSink();
    const controller = createRemoteCompletion({
      provider: createProvider(async (request) => createResponse(request, " safe ghost")),
      debounceMs: 0,
      metrics,
    });
    controller.subscribe((event) => events.push(event));

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

    const serializedEvents = JSON.stringify(events);
    const serializedMetrics = JSON.stringify(metrics.events);
    expect(serializedEvents).not.toContain("RAW_CONTEXT_BEFORE");
    expect(serializedEvents).not.toContain("RAW_CONTEXT_AFTER");
    expect(serializedEvents).not.toContain("RAW_CURRENT_LINE");
    expect(serializedEvents).not.toContain("RAW_METADATA_VALUE");
    expect(serializedMetrics).not.toContain("RAW_CONTEXT_BEFORE");
    expect(serializedMetrics).not.toContain("RAW_CONTEXT_AFTER");
    expect(serializedMetrics).not.toContain("RAW_CURRENT_LINE");
    expect(serializedMetrics).not.toContain("RAW_METADATA_VALUE");
  });
});

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

function createResponse(request: CompletionRequest, text = " completion"): CompletionResponse {
  return {
    id: request.id,
    text,
    providerName: "mock",
    latencyMs: 1,
    finishReason: "mock",
  };
}

function rejectWhenAborted(signal: AbortSignal | undefined): Promise<CompletionResponse> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    signal?.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
