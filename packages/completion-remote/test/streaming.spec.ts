import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CompletionDelta,
  CompletionEvent,
  CompletionProvider,
  CompletionRequest,
  CompletionResponse,
  CompletionScheduleInput,
} from "../src";
import { createRemoteCompletion } from "../src";

describe("remote completion streaming", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps non-streaming as the default path", async () => {
    vi.useFakeTimers();
    const complete = vi.fn(async (request: CompletionRequest) =>
      createResponse(request, " fallback"),
    );
    const streamComplete = vi.fn(async function* (_request: CompletionRequest) {
      yield { id: "unused", textDelta: " streamed" };
    });
    const controller = createRemoteCompletion({
      provider: createProvider({ complete, streamComplete }),
      debounceMs: 0,
    });

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(streamComplete).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({
      status: "showing",
      requestId: "completion-1",
      text: " fallback",
    });
  });

  it("accumulates mock stream deltas into repainting ghost text", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const complete = vi.fn(async (request: CompletionRequest) =>
      createResponse(request, " fallback"),
    );
    const controller = createRemoteCompletion({
      provider: createProvider({
        complete,
        async *streamComplete(request) {
          yield { id: request.id, textDelta: " stream" };
          yield { id: request.id, textDelta: "ing" };
          yield { id: request.id, textDelta: " text" };
        },
      }),
      debounceMs: 0,
      streaming: {
        enabled: true,
        minCharsBeforeRender: 1,
      },
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    expect(complete).not.toHaveBeenCalled();
    expect(
      events
        .filter((event) => event.type === "ghost_shown")
        .map((event) => (event.state.status === "showing" ? event.state.text : "")),
    ).toEqual([" stream", " streaming", " streaming text"]);
    expect(controller.getState()).toEqual({
      status: "showing",
      requestId: "completion-1",
      text: " streaming text",
    });
    expect(controller.getMetricsSnapshot().counts.stream_started).toBe(1);
    expect(controller.getMetricsSnapshot().counts.stream_delta).toBe(3);
    expect(controller.getMetricsSnapshot().counts.stream_completed).toBe(1);
    expect(controller.getMetricsSnapshot().counts.ghost_shown).toBe(1);
  });

  it("waits for minCharsBeforeRender before rendering streaming ghost text", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const controller = createRemoteCompletion({
      provider: createProvider({
        async *streamComplete(request) {
          yield { id: request.id, textDelta: " ab" };
          yield { id: request.id, textDelta: "cd" };
        },
      }),
      debounceMs: 0,
      streaming: {
        enabled: true,
        minCharsBeforeRender: 5,
      },
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    expect(events.filter((event) => event.type === "ghost_shown")).toHaveLength(1);
    expect(controller.getState()).toEqual({
      status: "showing",
      requestId: "completion-1",
      text: " abcd",
    });
  });

  it("Escape aborts an active stream without accepting text", async () => {
    vi.useFakeTimers();
    const streams = new Map<string, ControlledStream>();
    let signal: AbortSignal | undefined;
    const controller = createRemoteCompletion({
      provider: createProvider({
        streamComplete(request, options) {
          signal = options.signal;
          const stream = createControlledStream();
          streams.set(request.id, stream);
          return stream.iterable;
        },
      }),
      debounceMs: 0,
      streaming: {
        enabled: true,
      },
    });

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    streams.get("completion-1")?.push({ id: "completion-1", textDelta: " partial" });
    await flushPromises();

    controller.dismiss("escape");

    expect(signal?.aborted).toBe(true);
    expect(controller.getState()).toEqual({
      status: "dismissed",
      requestId: "completion-1",
      reason: "escape",
    });
    expect(controller.accept()).toBeNull();
    expect(controller.getMetricsSnapshot().counts.stream_aborted).toBe(1);
    expect(controller.getMetricsSnapshot().counts.ghost_dismissed_by_escape).toBe(1);
  });

  it("typing aborts an active stream and drops later stale deltas", async () => {
    vi.useFakeTimers();
    const streams = new Map<string, ControlledStream>();
    let firstSignal: AbortSignal | undefined;
    const controller = createRemoteCompletion({
      provider: createProvider({
        streamComplete(request, options) {
          if (request.id === "completion-1") {
            firstSignal = options.signal;
          }

          const stream = createControlledStream();
          streams.set(request.id, stream);
          return stream.iterable;
        },
      }),
      debounceMs: 0,
      streaming: {
        enabled: true,
      },
    });

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    await vi.advanceTimersByTimeAsync(0);
    streams.get("completion-1")?.push({ id: "completion-1", textDelta: " old" });
    await flushPromises();

    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    streams.get("completion-1")?.push({ id: "completion-1", textDelta: " stale" });
    await flushPromises();

    expect(firstSignal?.aborted).toBe(true);
    expect(controller.getState()).toEqual({
      status: "scheduled",
      requestId: "completion-2",
    });
    expect(controller.getMetricsSnapshot().counts.stream_aborted).toBe(1);
    expect(controller.getMetricsSnapshot().counts.stream_stale_delta_dropped).toBe(1);
    expect(controller.getMetricsSnapshot().counts.ghost_dismissed_by_typing).toBe(1);
  });

  it("drops stale stream deltas after a newer request is scheduled", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const streams = new Map<string, ControlledStream>();
    const controller = createRemoteCompletion({
      provider: createProvider({
        streamComplete(request) {
          const stream = createControlledStream();
          streams.set(request.id, stream);
          return stream.iterable;
        },
      }),
      debounceMs: 0,
      streaming: {
        enabled: true,
      },
    });
    controller.subscribe((event) => events.push(event));

    controller.schedule(createScheduleInput({ contextBefore: "first context value" }));
    await vi.advanceTimersByTimeAsync(0);
    controller.schedule(createScheduleInput({ contextBefore: "second context value" }));
    streams.get("completion-1")?.push({ id: "completion-1", textDelta: " stale" });
    await flushPromises();

    expect(events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ghost_shown",
          requestId: "completion-1",
        }),
      ]),
    );
    expect(controller.getMetricsSnapshot().counts.stream_stale_delta_dropped).toBe(1);

    await vi.advanceTimersByTimeAsync(0);
    streams.get("completion-2")?.push({ id: "completion-2", textDelta: " current" });
    await flushPromises();

    expect(controller.getState()).toEqual({
      status: "showing",
      requestId: "completion-2",
      text: " current",
    });
  });

  it("accepts the currently accumulated streaming text and aborts remaining deltas", async () => {
    vi.useFakeTimers();
    const streams = new Map<string, ControlledStream>();
    let signal: AbortSignal | undefined;
    const controller = createRemoteCompletion({
      provider: createProvider({
        streamComplete(request, options) {
          signal = options.signal;
          const stream = createControlledStream();
          streams.set(request.id, stream);
          return stream.iterable;
        },
      }),
      debounceMs: 0,
      streaming: {
        enabled: true,
      },
    });

    controller.schedule(createScheduleInput());
    await vi.advanceTimersByTimeAsync(0);
    streams.get("completion-1")?.push({ id: "completion-1", textDelta: " partial" });
    await flushPromises();

    const accepted = controller.accept();
    streams.get("completion-1")?.push({ id: "completion-1", textDelta: " stale" });
    await flushPromises();

    expect(accepted).toMatchObject({
      id: "completion-1",
      text: " partial",
      providerName: "mock",
    });
    expect(signal?.aborted).toBe(true);
    expect(controller.getState()).toEqual({
      status: "accepted",
      requestId: "completion-1",
    });
    expect(controller.getMetricsSnapshot().counts.ghost_accepted).toBe(1);
    expect(controller.getMetricsSnapshot().counts.stream_aborted).toBe(1);
    expect(controller.getMetricsSnapshot().counts.stream_stale_delta_dropped).toBe(1);
  });
});

type CreateProviderOptions = {
  complete?: CompletionProvider["complete"];
  streamComplete?: CompletionProvider["streamComplete"];
};

type ControlledStream = {
  iterable: AsyncIterable<CompletionDelta>;
  push(delta: CompletionDelta): void;
  close(): void;
};

function createProvider(options: CreateProviderOptions): CompletionProvider {
  const provider: CompletionProvider = {
    name: "mock",
    complete: options.complete ?? (async (request) => createResponse(request)),
  };

  if (options.streamComplete !== undefined) {
    provider.streamComplete = options.streamComplete;
  }

  return provider;
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

function createControlledStream(): ControlledStream {
  const queue: Array<IteratorResult<CompletionDelta>> = [];
  let pending: ((result: IteratorResult<CompletionDelta>) => void) | null = null;

  return {
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next() {
            const next = queue.shift();

            if (next !== undefined) {
              return Promise.resolve(next);
            }

            return new Promise<IteratorResult<CompletionDelta>>((resolve) => {
              pending = resolve;
            });
          },
        };
      },
    },
    push(delta) {
      enqueue({ value: delta, done: false });
    },
    close() {
      enqueue({ value: undefined, done: true });
    },
  };

  function enqueue(result: IteratorResult<CompletionDelta>): void {
    if (pending !== null) {
      const resolve = pending;
      pending = null;
      resolve(result);
      return;
    }

    queue.push(result);
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
