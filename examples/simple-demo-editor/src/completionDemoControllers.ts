import type {
  CodeMirrorCompletionController,
  CodeMirrorCompletionEditor,
  CodeMirrorCompletionSnapshot,
  CodeMirrorCompletionTransaction,
  CodeMirrorGhostTextClearReason,
} from "@typai/codemirror";
import {
  type CompletionDismissReason,
  type CompletionMetricEvent,
  type CompletionMode,
  createContenteditableCompletionController,
  createMockCompletionProvider,
  createRemoteCompletion,
  extractCompletionContext,
  type RemoteCompletionController,
} from "@typai/completion-remote";
import type {
  ContenteditableCompletionController,
  DetachContenteditable,
} from "@typai/contenteditable";
import type {
  DetachTextarea,
  TextareaCompletionController,
  TextareaCompletionDismissEvent,
  TextareaCompletionEvent,
  TextareaCompletionSnapshot,
  TextareaGhostTextClearReason,
} from "@typai/textarea";

export const COMPLETION_DEMO_DEBOUNCE_MS = 300;
export const COMPLETION_DEMO_MIN_PREFIX_CHARS = 8;
export const COMPLETION_DEMO_MAX_EVENTS = 200;

export type CompletionDemoMetricsSnapshot = {
  status: string;
  requestCount: number;
  ghostShownCount: number;
  acceptedCount: number;
  dismissedCount: number;
  revertedCount: number;
  p95GhostLatencyMs: number | null;
  lastEvent: string;
};

export type CompletionDemoControllerOptions = {
  surface: string;
  mode?: CompletionMode;
  getCompletionText?: () => string;
  getLatencyMs?: () => number;
  isEnabled?: () => boolean;
  onUpdate?: () => void;
};

export type DemoContenteditableCompletionController = ContenteditableCompletionController & {
  remote: RemoteCompletionController;
  connectEditor(editor: DetachContenteditable): () => void;
  hasAcceptedCompletion(): boolean;
  revertLastCompletion(): boolean;
  getDemoMetrics(): CompletionDemoMetricsSnapshot;
  resetDemoMetrics(): void;
};

export type DemoTextareaCompletionController = TextareaCompletionController & {
  remote: RemoteCompletionController;
  connectEditor(editor: DetachTextarea): () => void;
  setEditor(editor: DetachTextarea | null): void;
  hasAcceptedCompletion(): boolean;
  revertLastCompletion(): boolean;
  getDemoMetrics(): CompletionDemoMetricsSnapshot;
  resetDemoMetrics(): void;
};

export type DemoCodeMirrorCompletionController = CodeMirrorCompletionController & {
  remote: RemoteCompletionController;
  getDemoMetrics(): CompletionDemoMetricsSnapshot;
  resetDemoMetrics(): void;
};

type MetricTracker = {
  getDemoMetrics(): CompletionDemoMetricsSnapshot;
  resetDemoMetrics(): void;
  destroy(): void;
};

export function createContenteditableMockCompletionController(
  options: CompletionDemoControllerOptions,
): DemoContenteditableCompletionController {
  const base = createContenteditableCompletionController({
    provider: createDemoMockProvider(options),
    debounceMs: COMPLETION_DEMO_DEBOUNCE_MS,
    timeoutMs: 2500,
    minPrefixChars: COMPLETION_DEMO_MIN_PREFIX_CHARS,
    maxCompletionChars: 220,
    maxMetricEvents: COMPLETION_DEMO_MAX_EVENTS,
    mode: options.mode ?? "prose",
  });
  const tracker = createMetricTracker(base.remote, options.onUpdate);
  const unsubscribeState = base.remote.subscribe(() => options.onUpdate?.());
  let editor: DetachContenteditable | null = null;
  let lastCompletionTransactionId: string | null = null;

  return {
    ...base,
    connectEditor(nextEditor) {
      editor = nextEditor;
      const disconnectBase = base.connectEditor(nextEditor);

      return () => {
        disconnectBase();

        if (editor === nextEditor) {
          editor = null;
        }
      };
    },
    onGhostTextAccept(snapshot, transaction) {
      if (transaction !== undefined) {
        lastCompletionTransactionId = transaction.id;
      }

      base.onGhostTextAccept(snapshot, transaction);
      options.onUpdate?.();
    },
    onEditorInput(snapshot) {
      if (options.isEnabled?.() === false) {
        base.remote.dismiss("manual");
        return;
      }

      base.onEditorInput(snapshot);
    },
    onCompletionReverted(transaction) {
      if (lastCompletionTransactionId === transaction.id) {
        lastCompletionTransactionId = null;
      }

      base.onCompletionReverted(transaction);
      options.onUpdate?.();
    },
    hasAcceptedCompletion() {
      return lastCompletionTransactionId !== null;
    },
    revertLastCompletion() {
      if (editor === null || lastCompletionTransactionId === null) {
        return false;
      }

      const result = editor.revertCompletion(lastCompletionTransactionId);

      if (result.applied) {
        lastCompletionTransactionId = null;
      }

      options.onUpdate?.();
      return result.applied;
    },
    getDemoMetrics: tracker.getDemoMetrics,
    resetDemoMetrics: tracker.resetDemoMetrics,
    destroy() {
      unsubscribeState();
      tracker.destroy();
      editor = null;
      lastCompletionTransactionId = null;
      base.destroy();
    },
  } as DemoContenteditableCompletionController;
}

export function createTextareaMockCompletionController(
  options: CompletionDemoControllerOptions,
): DemoTextareaCompletionController {
  const remote = createDemoRemote(options);
  const tracker = createMetricTracker(remote, options.onUpdate);

  let editor: DetachTextarea | null = null;
  let lastSnapshot: TextareaCompletionSnapshot | null = null;
  let lastCompletionTransactionId: string | null = null;

  const unsubscribeState = remote.subscribe((event) => {
    if (event.type !== "ghost_shown" || event.state.status !== "showing") {
      options.onUpdate?.();
      return;
    }

    const snapshot = lastSnapshot;

    if (snapshot === null || editor === null) {
      remote.dismiss("stale");
      options.onUpdate?.();
      return;
    }

    const rendered = editor.renderTextareaGhostText(event.state.text, snapshot, {
      requestId: event.requestId,
      providerName: event.providerName,
      model: event.model,
      latencyMs: event.latencyMs,
    });

    if (!rendered) {
      remote.dismiss("stale");
    }

    options.onUpdate?.();
  });

  const controller: DemoTextareaCompletionController = {
    remote,
    connectEditor(nextEditor) {
      editor = nextEditor;

      return () => {
        if (editor === nextEditor) {
          editor = null;
        }
      };
    },
    setEditor(nextEditor) {
      editor = nextEditor;
    },
    onEditorInput(snapshot) {
      lastSnapshot = snapshot;

      if (options.isEnabled?.() === false) {
        remote.dismiss("manual");
        return;
      }

      if (snapshot.isComposingIME || snapshot.selection.start !== snapshot.selection.end) {
        remote.dismiss(snapshot.isComposingIME ? "composition" : "selection_change");
        return;
      }

      remote.schedule({
        ...extractCompletionContext({
          fullText: snapshot.text,
          cursorOffset: snapshot.selection.end,
          selection: snapshot.selection,
          mode: snapshot.mode ?? options.mode ?? "prose",
        }),
        surface: options.surface,
      });
    },
    onEditorSelectionChange(snapshot) {
      if (
        lastSnapshot !== null &&
        lastSnapshot.version === snapshot.version &&
        lastSnapshot.selection.start === snapshot.selection.start &&
        lastSnapshot.selection.end === snapshot.selection.end
      ) {
        return;
      }

      lastSnapshot = snapshot;
      remote.dismiss("selection_change");
    },
    onEditorBlur() {
      remote.dismiss("blur");
    },
    onEditorCompositionStart() {
      remote.dismiss("composition");
    },
    onCorrectionTransaction() {
      remote.dismiss("correction_transaction");
    },
    onCompletionAccepted(event: TextareaCompletionEvent) {
      lastSnapshot = toTextareaCompletionSnapshot(event);
      lastCompletionTransactionId = event.transaction.id;
      remote.accept();
      options.onUpdate?.();
    },
    onCompletionDismissed(event: TextareaCompletionDismissEvent) {
      remote.dismiss(mapTextareaDismissReason(event.reason));
    },
    onCompletionReverted(event: TextareaCompletionEvent) {
      if (lastCompletionTransactionId === event.transaction.id) {
        lastCompletionTransactionId = null;
      }

      remote.revert(event.transaction.requestId);
      options.onUpdate?.();
    },
    hasAcceptedCompletion() {
      return lastCompletionTransactionId !== null;
    },
    revertLastCompletion() {
      if (editor === null || lastCompletionTransactionId === null) {
        return false;
      }

      const transaction = editor
        .getTextareaCompletionTransactions()
        .find((candidate) => candidate.id === lastCompletionTransactionId);

      if (transaction === undefined) {
        lastCompletionTransactionId = null;
        options.onUpdate?.();
        return false;
      }

      const result = editor.revertTextareaCompletion(transaction.id);

      if (result.applied) {
        lastCompletionTransactionId = null;
      }

      options.onUpdate?.();
      return result.applied;
    },
    getDemoMetrics: tracker.getDemoMetrics,
    resetDemoMetrics: tracker.resetDemoMetrics,
    destroy() {
      unsubscribeState();
      tracker.destroy();
      editor = null;
      lastSnapshot = null;
      lastCompletionTransactionId = null;
      remote.destroy();
    },
  };

  return controller;
}

export function createCodeMirrorMockCompletionController(
  options: CompletionDemoControllerOptions,
): DemoCodeMirrorCompletionController {
  const remote = createDemoRemote(options);
  const tracker = createMetricTracker(remote, options.onUpdate);

  let editor: CodeMirrorCompletionEditor | null = null;
  let lastSnapshot: CodeMirrorCompletionSnapshot | null = null;

  const unsubscribeState = remote.subscribe((event) => {
    if (event.type !== "ghost_shown" || event.state.status !== "showing") {
      options.onUpdate?.();
      return;
    }

    const snapshot = lastSnapshot;

    if (snapshot === null || editor === null) {
      remote.dismiss("stale");
      options.onUpdate?.();
      return;
    }

    const rendered = editor.renderGhostTextAtCaret(event.state.text, snapshot, {
      requestId: event.requestId,
      providerName: event.providerName,
      model: event.model,
      latencyMs: event.latencyMs,
    });

    if (!rendered) {
      remote.dismiss("stale");
    }

    options.onUpdate?.();
  });

  return {
    remote,
    connectEditor(nextEditor) {
      editor = nextEditor;

      return () => {
        if (editor === nextEditor) {
          editor = null;
        }
      };
    },
    onEditorInput(snapshot) {
      lastSnapshot = snapshot;

      if (options.isEnabled?.() === false) {
        remote.dismiss("manual");
        return;
      }

      if (
        snapshot.protected ||
        snapshot.isComposingIME ||
        snapshot.selection.start !== snapshot.selection.end
      ) {
        remote.dismiss(
          snapshot.protected
            ? "manual"
            : snapshot.isComposingIME
              ? "composition"
              : "selection_change",
        );
        return;
      }

      remote.schedule({
        ...extractCompletionContext({
          fullText: snapshot.text,
          cursorOffset: snapshot.selection.end,
          selection: snapshot.selection,
          mode: snapshot.mode ?? options.mode ?? "prose",
        }),
        surface: options.surface,
      });
    },
    onEditorSelectionChange(snapshot) {
      if (
        lastSnapshot !== null &&
        lastSnapshot.version === snapshot.version &&
        lastSnapshot.selection.start === snapshot.selection.start &&
        lastSnapshot.selection.end === snapshot.selection.end
      ) {
        return;
      }

      lastSnapshot = snapshot;
      remote.dismiss("selection_change");
    },
    onEditorBlur() {
      remote.dismiss("blur");
    },
    onEditorCompositionStart() {
      remote.dismiss("composition");
    },
    onCorrectionTransaction() {
      remote.dismiss("correction_transaction");
    },
    onCompletionAccepted(transaction: CodeMirrorCompletionTransaction) {
      remote.accept();
      options.onUpdate?.();
      lastSnapshot = {
        text: "",
        version: transaction.documentVersion + 1,
        selection: {
          start: transaction.rangeAfter.to,
          end: transaction.rangeAfter.to,
        },
        isComposingIME: false,
        mode: options.mode,
      };
    },
    onCompletionReverted(transaction: CodeMirrorCompletionTransaction) {
      remote.revert(transaction.requestId);
      options.onUpdate?.();
    },
    onGhostTextDismiss(
      reason: CodeMirrorGhostTextClearReason,
      snapshot: CodeMirrorCompletionSnapshot,
    ) {
      lastSnapshot = snapshot;
      remote.dismiss(mapCodeMirrorDismissReason(reason));
    },
    getDemoMetrics: tracker.getDemoMetrics,
    resetDemoMetrics: tracker.resetDemoMetrics,
    destroy() {
      unsubscribeState();
      tracker.destroy();
      editor = null;
      lastSnapshot = null;
      remote.destroy();
    },
  };
}

export function formatCompletionLatency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(0)} ms`;
}

export function completionDemoTextForSurface(surface: string): string {
  switch (surface) {
    case "textarea":
      return " with mocked textarea ghost text.";
    case "react-textarea":
      return " with mocked React textarea completion.";
    case "react-contenteditable":
      return " with mocked React contenteditable completion.";
    case "codemirror":
      return " with mocked CodeMirror completion.";
    default:
      return " with a focused mocked continuation.";
  }
}

function createDemoRemote(options: CompletionDemoControllerOptions): RemoteCompletionController {
  return createRemoteCompletion({
    provider: createDemoMockProvider(options),
    debounceMs: COMPLETION_DEMO_DEBOUNCE_MS,
    timeoutMs: 2500,
    minPrefixChars: COMPLETION_DEMO_MIN_PREFIX_CHARS,
    maxCompletionChars: 220,
    maxMetricEvents: COMPLETION_DEMO_MAX_EVENTS,
  });
}

function createDemoMockProvider(options: CompletionDemoControllerOptions) {
  return createMockCompletionProvider(async (request, providerOptions) => {
    await waitForMockLatency(options.getLatencyMs?.() ?? 180, providerOptions.signal);

    const completionText =
      options.getCompletionText?.() ?? completionDemoTextForSurface(options.surface);

    return completionText.replaceAll("{requestId}", request.id);
  });
}

function createMetricTracker(
  remote: RemoteCompletionController,
  onUpdate: (() => void) | undefined,
): MetricTracker {
  let lastMetricEvent: CompletionMetricEvent | null = null;

  const unsubscribeMetrics = remote.subscribeMetrics((event) => {
    lastMetricEvent = event;
    onUpdate?.();
  });

  return {
    getDemoMetrics() {
      const snapshot = remote.getMetricsSnapshot();
      const counts = snapshot.counts;
      const ghostLatencies = snapshot.events
        .map((event) => event.timeFromLastUserInputToGhostVisibleMs)
        .filter((value): value is number => typeof value === "number");

      return {
        status: remote.getState().status,
        requestCount: counts.request_scheduled ?? 0,
        ghostShownCount: counts.ghost_shown ?? 0,
        acceptedCount: counts.ghost_accepted ?? 0,
        dismissedCount:
          (counts.ghost_dismissed_by_typing ?? 0) +
          (counts.ghost_dismissed_by_escape ?? 0) +
          (counts.ghost_dismissed_by_selection_change ?? 0) +
          (counts.ghost_dismissed_by_blur ?? 0) +
          (counts.ghost_dismissed_by_composition ?? 0),
        revertedCount: counts.completion_reverted ?? 0,
        p95GhostLatencyMs: getP95(ghostLatencies),
        lastEvent: lastMetricEvent?.type ?? "-",
      };
    },
    resetDemoMetrics() {
      remote.resetMetrics();
      lastMetricEvent = null;
      onUpdate?.();
    },
    destroy() {
      unsubscribeMetrics();
    },
  };
}

function toTextareaCompletionSnapshot(event: TextareaCompletionEvent): TextareaCompletionSnapshot {
  return {
    text: event.snapshot.value,
    version: event.snapshot.version,
    selection: {
      start: event.snapshot.selectionStart,
      end: event.snapshot.selectionEnd,
    },
    isComposingIME: event.snapshot.isComposingIME,
  };
}

function mapTextareaDismissReason(reason: TextareaGhostTextClearReason): CompletionDismissReason {
  switch (reason) {
    case "typing":
      return "typing";
    case "escape":
      return "escape";
    case "selection_change":
      return "selection_change";
    case "blur":
      return "blur";
    case "composition_start":
      return "composition";
    case "paste":
      return "paste";
    case "correction_transaction":
      return "correction_transaction";
    case "stale_snapshot":
      return "stale";
    case "manual":
    case "empty":
    case "overlay_unavailable":
    case "detach":
      return "manual";
  }
}

function mapCodeMirrorDismissReason(
  reason: CodeMirrorGhostTextClearReason,
): CompletionDismissReason {
  switch (reason) {
    case "typing":
      return "typing";
    case "escape":
      return "escape";
    case "selection_change":
      return "selection_change";
    case "blur":
      return "blur";
    case "composition":
      return "composition";
    case "paste":
      return "paste";
    case "correction_transaction":
      return "correction_transaction";
    case "stale":
      return "stale";
    case "manual":
    case "protected_context":
      return "manual";
  }
}

function waitForMockLatency(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timerId = window.setTimeout(resolve, Math.max(0, Math.min(1500, ms)));

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timerId);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function getP95(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);

  return sorted[index] ?? null;
}
