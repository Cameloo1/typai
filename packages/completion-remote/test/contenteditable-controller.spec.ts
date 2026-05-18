import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletionEvent } from "../src";
import { createContenteditableCompletionController, createMockCompletionProvider } from "../src";

describe("contenteditable remote completion controller", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules from editor snapshots and renders when the scheduler shows ghost text", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const rendered: Array<{ text: string; snapshotText: string; requestId?: string }> = [];
    const controller = createContenteditableCompletionController({
      provider: createMockCompletionProvider(" completion"),
      debounceMs: 0,
      minPrefixChars: 1,
    });
    controller.remote.subscribe((event) => events.push(event));
    controller.connectEditor({
      renderGhostTextAtCaret(text, snapshot, metadata) {
        rendered.push({
          text,
          snapshotText: snapshot?.text ?? "",
          requestId: metadata?.requestId,
        });
      },
    });

    controller.onEditorInput(createSnapshot("hello prompt"));
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();

    expect(rendered).toEqual([
      { text: " completion", snapshotText: "hello prompt", requestId: "completion-1" },
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "request_scheduled" }),
        expect.objectContaining({ type: "ghost_shown" }),
      ]),
    );
    expect(controller.remote.getMetricsSnapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "request_scheduled",
          surface: "contenteditable",
        }),
      ]),
    );
  });

  it("emits dismiss, accept, and revert events from contenteditable structural hooks", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const controller = createContenteditableCompletionController({
      provider: createMockCompletionProvider(" completion"),
      debounceMs: 0,
      minPrefixChars: 1,
    });
    const snapshot = createSnapshot("hello prompt");

    controller.remote.subscribe((event) => events.push(event));
    controller.onEditorInput(snapshot);
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    controller.onGhostTextDismiss("escape", snapshot);

    controller.onEditorInput(snapshot);
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    controller.onGhostTextAccept(snapshot);
    controller.onCompletionReverted(createTransaction("completion-2"));

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ghost_dismissed", reason: "escape" }),
        expect.objectContaining({ type: "ghost_accepted" }),
        expect.objectContaining({
          type: "completion_reverted",
          requestId: "completion-2",
        }),
      ]),
    );
  });

  it("dismisses scheduled or visible completion work on editor invalidators", async () => {
    vi.useFakeTimers();
    const events: CompletionEvent[] = [];
    const controller = createContenteditableCompletionController({
      provider: createMockCompletionProvider(" completion"),
      debounceMs: 300,
      minPrefixChars: 1,
    });
    controller.remote.subscribe((event) => events.push(event));

    controller.onEditorInput(createSnapshot("hello prompt"));
    controller.onEditorCompositionStart();
    controller.onEditorInput(createSnapshot("hello prompt"));
    controller.onEditorSelectionChange(createSnapshot("hello prompt", { start: 0, end: 0 }));
    controller.onEditorInput(createSnapshot("hello prompt"));
    controller.onEditorBlur();

    expect(events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "request_canceled_before_send" })]),
    );
    expect(controller.remote.getState()).toEqual({ status: "idle" });
  });

  it("keeps completion-remote structurally independent from contenteditable", () => {
    const source = readFileSync("src/contenteditable.ts", "utf8");

    expect(source).not.toContain("@typai/contenteditable");
  });
});

function createSnapshot(text: string, selection = { start: text.length, end: text.length }) {
  return {
    text,
    version: 1,
    selection,
    isComposingIME: false,
    mode: "prompt" as const,
  };
}

function createTransaction(requestId: string) {
  return {
    id: "transaction-1",
    requestId,
    editorVersion: 2,
    rangeBefore: { start: 12, end: 12, text: "" },
    rangeAfter: { start: 12, end: 23, text: " completion" },
    insertedText: " completion",
    createdAt: 1,
    providerName: "mock",
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
