import {
  type CompletionMetricEvent,
  type ContenteditableRemoteCompletionController,
  createContenteditableCompletionController,
  createMockCompletionProvider,
} from "@typai/completion-remote";
import {
  attachContenteditable,
  type CompletionTransaction,
  type DetachContenteditable,
} from "@typai/contenteditable";
import { createMemoryStorage, createTypaiCore, type TypaiCore } from "@typai/core";

const REMOTE_COMPLETION_DEBOUNCE_MS = 300;
const REMOTE_COMPLETION_MIN_PREFIX_CHARS = 12;
const REMOTE_COMPLETION_MAX_EVENTS = 200;

type RemoteCompletionDemoDebug = {
  getState(): string;
  getMetrics(): {
    requestCount: number;
    ghostShownCount: number;
    acceptCount: number;
    dismissCount: number;
    dismissByTypingCount: number;
    dismissByEscapeCount: number;
    dismissBySelectionChangeCount: number;
    dismissByBlurCount: number;
    dismissByCompositionCount: number;
    revertCount: number;
    staleResponseDroppedCount: number;
    providerErrorCount: number;
    staleResponseDroppedRequestIds: string[];
    ghostLatencySamples: number[];
  };
  resetMetrics(): void;
  setIgnoreAbortForProvider(value: boolean): void;
  failNextRequest(): void;
};

declare global {
  interface Window {
    __typaiRemoteCompletionDebug?: RemoteCompletionDemoDebug;
  }
}

export async function mountRemoteCompletionDemo(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <div class="remote-completion-content">
      <section class="remote-completion-editor-column" aria-label="V4 remote completion editor">
        <div class="demo-panel-header">
          <div>
            <h2>V4 Remote Completion</h2>
            <p>Contenteditable ghost text driven by a deterministic mock provider. No network, server, or API key is used.</p>
          </div>
          <div class="remote-completion-actions">
            <button class="reset-button" type="button" data-remote-reset data-testid="remote-reset">Reset</button>
            <button class="reset-button" type="button" data-remote-revert data-testid="remote-revert" disabled>Revert Completion</button>
          </div>
        </div>

        <div
          class="editor-surface remote-completion-editor"
          contenteditable="true"
          role="textbox"
          aria-label="V4 remote completion contenteditable demo"
          aria-describedby="remote-completion-instructions"
          aria-multiline="true"
          spellcheck="false"
          data-remote-editor
          data-testid="remote-completion-editor"
        ></div>

        <ul class="demo-notes remote-completion-notes" id="remote-completion-instructions">
          <li>Type at least <code>12</code> characters, then pause.</li>
          <li>Wait for subtle gray ghost text at the caret.</li>
          <li>Press Tab to accept the visible completion.</li>
          <li>Press Escape to dismiss the visible completion.</li>
          <li>Keep typing to dismiss the visible completion.</li>
          <li>Use Revert Completion after accepting mock text.</li>
        </ul>
      </section>

      <aside class="remote-completion-side-panel" aria-label="Remote completion controls and metrics">
        <section class="settings-panel compact-panel" aria-label="Remote completion controls">
          <h2>Controls</h2>
          <label>
            <input type="checkbox" data-remote-enabled data-testid="remote-enabled" checked />
            Enable completion
          </label>
          <div class="remote-setting-row">
            <span>Debounce</span>
            <output data-remote-debounce data-testid="remote-debounce">${REMOTE_COMPLETION_DEBOUNCE_MS} ms</output>
          </div>
          <label>
            Preset
            <select data-remote-preset data-testid="remote-preset">
              <option value="release">Release note</option>
              <option value="prompt">Prompt editor</option>
              <option value="markdown">Markdown note</option>
              <option value="empty">Empty response</option>
            </select>
          </label>
          <label>
            Mock completion
            <input
              type="text"
              data-remote-completion-text
              data-testid="remote-completion-text"
              value=" with a focused mocked continuation."
            />
          </label>
          <label>
            Mock latency
            <input
              type="number"
              min="0"
              max="1500"
              step="50"
              data-remote-latency
              data-testid="remote-latency"
              value="250"
            />
          </label>
        </section>

        <section class="debug-panel compact-panel" aria-label="Remote completion metrics">
          <h2>Metrics</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd data-remote-status data-testid="remote-status">Loading core...</dd>
            </div>
            <div>
              <dt>Requests</dt>
              <dd data-remote-request-count data-testid="remote-request-count">0</dd>
            </div>
            <div>
              <dt>Ghost shown</dt>
              <dd data-remote-ghost-count data-testid="remote-ghost-count">0</dd>
            </div>
            <div>
              <dt>Accepted</dt>
              <dd data-remote-accept-count data-testid="remote-accept-count">0</dd>
            </div>
            <div>
              <dt>Dismissed</dt>
              <dd data-remote-dismiss-count data-testid="remote-dismiss-count">0</dd>
            </div>
            <div>
              <dt>Reverted</dt>
              <dd data-remote-revert-count data-testid="remote-revert-count">0</dd>
            </div>
            <div>
              <dt>p95 ghost latency</dt>
              <dd data-remote-p95-ghost-latency data-testid="remote-p95-ghost-latency">-</dd>
            </div>
            <div>
              <dt>Last event</dt>
              <dd data-remote-last-event data-testid="remote-last-event">-</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  `;

  const editor = root.querySelector<HTMLElement>("[data-remote-editor]");
  const enabledToggle = root.querySelector<HTMLInputElement>("[data-remote-enabled]");
  const presetSelect = root.querySelector<HTMLSelectElement>("[data-remote-preset]");
  const completionTextInput = root.querySelector<HTMLInputElement>("[data-remote-completion-text]");
  const latencyInput = root.querySelector<HTMLInputElement>("[data-remote-latency]");
  const resetButton = root.querySelector<HTMLButtonElement>("[data-remote-reset]");
  const revertButton = root.querySelector<HTMLButtonElement>("[data-remote-revert]");
  const statusElement = root.querySelector<HTMLElement>("[data-remote-status]");
  const requestCountElement = root.querySelector<HTMLElement>("[data-remote-request-count]");
  const ghostCountElement = root.querySelector<HTMLElement>("[data-remote-ghost-count]");
  const acceptCountElement = root.querySelector<HTMLElement>("[data-remote-accept-count]");
  const dismissCountElement = root.querySelector<HTMLElement>("[data-remote-dismiss-count]");
  const revertCountElement = root.querySelector<HTMLElement>("[data-remote-revert-count]");
  const p95GhostLatencyElement = root.querySelector<HTMLElement>("[data-remote-p95-ghost-latency]");
  const lastEventElement = root.querySelector<HTMLElement>("[data-remote-last-event]");

  if (
    editor === null ||
    enabledToggle === null ||
    presetSelect === null ||
    completionTextInput === null ||
    latencyInput === null ||
    resetButton === null ||
    revertButton === null
  ) {
    return;
  }

  let core: TypaiCore = await createTypaiCore({
    storage: createMemoryStorage(),
  });
  let adapter: DetachContenteditable | null = null;
  let completionController: ContenteditableRemoteCompletionController | null = null;
  let disconnectEditor: (() => void) | null = null;
  let unsubscribeEvents: (() => void) | null = null;
  let unsubscribeMetrics: (() => void) | null = null;
  let lastAcceptedTransaction: CompletionTransaction | null = null;
  let lastMetricEvent: CompletionMetricEvent | null = null;
  let ignoreAbortForProvider = false;
  let failNextRequest = false;

  const renderMetrics = () => {
    const snapshot = completionController?.remote.getMetricsSnapshot() ?? null;
    const counts = snapshot?.counts;
    const dismissCount =
      (counts?.ghost_dismissed_by_typing ?? 0) +
      (counts?.ghost_dismissed_by_escape ?? 0) +
      (counts?.ghost_dismissed_by_selection_change ?? 0) +
      (counts?.ghost_dismissed_by_blur ?? 0) +
      (counts?.ghost_dismissed_by_composition ?? 0);
    const ghostLatencies =
      snapshot?.events
        .map((event) => event.timeFromLastUserInputToGhostVisibleMs)
        .filter((value): value is number => typeof value === "number") ?? [];

    setText(statusElement, formatRemoteStatus(completionController, enabledToggle.checked));
    setText(requestCountElement, String(counts?.request_scheduled ?? 0));
    setText(ghostCountElement, String(counts?.ghost_shown ?? 0));
    setText(acceptCountElement, String(counts?.ghost_accepted ?? 0));
    setText(dismissCountElement, String(dismissCount));
    setText(revertCountElement, String(counts?.completion_reverted ?? 0));
    setText(p95GhostLatencyElement, formatLatency(getP95(ghostLatencies)));
    setText(lastEventElement, lastMetricEvent?.type ?? "-");
    revertButton.disabled = lastAcceptedTransaction === null;
  };

  const attachDemo = () => {
    disconnectEditor?.();
    unsubscribeEvents?.();
    unsubscribeMetrics?.();
    adapter?.();

    disconnectEditor = null;
    unsubscribeEvents = null;
    unsubscribeMetrics = null;
    adapter = null;
    completionController = null;
    lastAcceptedTransaction = null;
    lastMetricEvent = null;

    const nextCompletionController = enabledToggle.checked
      ? createContenteditableCompletionController({
          provider: createMockCompletionProvider(async (request, options) => {
            const completionText = completionTextInput.value.replaceAll("{requestId}", request.id);

            await waitForMockLatency(
              getMockLatencyMs(latencyInput),
              ignoreAbortForProvider ? undefined : options.signal,
            );

            if (failNextRequest) {
              failNextRequest = false;
              throw new Error("Mock remote completion provider error.");
            }

            return completionText;
          }),
          debounceMs: REMOTE_COMPLETION_DEBOUNCE_MS,
          timeoutMs: 2500,
          minPrefixChars: REMOTE_COMPLETION_MIN_PREFIX_CHARS,
          maxCompletionChars: 220,
          maxMetricEvents: REMOTE_COMPLETION_MAX_EVENTS,
          mode: "prompt",
        })
      : null;

    completionController = nextCompletionController;

    if (nextCompletionController !== null) {
      unsubscribeEvents = nextCompletionController.remote.subscribe(() => {
        renderMetrics();
      });
      unsubscribeMetrics = nextCompletionController.remote.subscribeMetrics((event) => {
        lastMetricEvent = event;
        renderMetrics();
      });
    }

    adapter = attachContenteditable({
      element: editor,
      typai: core,
      settings: {
        autocorrect: true,
        spellcheck: false,
        keepCorrectionMarksVisible: false,
        usePersonalDictionary: false,
      },
      completion: nextCompletionController ?? undefined,
      completionMode: "prompt",
      onCompletionAccepted(transaction) {
        lastAcceptedTransaction = transaction;
        renderMetrics();
      },
      onCompletionReverted(transaction) {
        if (lastAcceptedTransaction?.id === transaction.id) {
          lastAcceptedTransaction = null;
        }

        renderMetrics();
      },
    });

    if (nextCompletionController !== null) {
      disconnectEditor = nextCompletionController.connectEditor(adapter);
    }

    renderMetrics();
  };

  const resetEditor = async () => {
    editor.textContent = "";
    lastAcceptedTransaction = null;
    core = await createTypaiCore({
      storage: createMemoryStorage(),
    });
    attachDemo();
    placeCaretAtEnd(editor);
    editor.focus();
  };

  presetSelect.addEventListener("change", () => {
    completionTextInput.value = presetText(presetSelect.value);
    attachDemo();
  });
  completionTextInput.addEventListener("change", attachDemo);
  latencyInput.addEventListener("change", attachDemo);
  enabledToggle.addEventListener("change", attachDemo);
  resetButton.addEventListener("click", () => {
    void resetEditor();
  });
  revertButton.addEventListener("click", () => {
    if (adapter === null || lastAcceptedTransaction === null) {
      return;
    }

    const result = adapter.revertCompletion(lastAcceptedTransaction.id);

    if (!result.applied) {
      setText(lastEventElement, `revert_${result.reason}`);
    }

    renderMetrics();
  });

  attachDemo();
  renderMetrics();

  window.__typaiRemoteCompletionDebug = {
    getState() {
      return formatRemoteStatus(completionController, enabledToggle.checked);
    },
    getMetrics() {
      const snapshot = completionController?.remote.getMetricsSnapshot();
      const counts = snapshot?.counts;
      const dismissByTypingCount = counts?.ghost_dismissed_by_typing ?? 0;
      const dismissByEscapeCount = counts?.ghost_dismissed_by_escape ?? 0;
      const dismissBySelectionChangeCount = counts?.ghost_dismissed_by_selection_change ?? 0;
      const dismissByBlurCount = counts?.ghost_dismissed_by_blur ?? 0;
      const dismissByCompositionCount = counts?.ghost_dismissed_by_composition ?? 0;
      const ghostLatencySamples =
        snapshot?.events
          .map((event) => event.timeFromLastUserInputToGhostVisibleMs)
          .filter((value): value is number => typeof value === "number") ?? [];
      const staleResponseDroppedRequestIds =
        snapshot?.events
          .filter((event) => event.type === "stale_response_dropped")
          .map((event) => event.requestId) ?? [];

      return {
        requestCount: counts?.request_scheduled ?? 0,
        ghostShownCount: counts?.ghost_shown ?? 0,
        acceptCount: counts?.ghost_accepted ?? 0,
        dismissCount:
          dismissByTypingCount +
          dismissByEscapeCount +
          dismissBySelectionChangeCount +
          dismissByBlurCount +
          dismissByCompositionCount,
        dismissByTypingCount,
        dismissByEscapeCount,
        dismissBySelectionChangeCount,
        dismissByBlurCount,
        dismissByCompositionCount,
        revertCount: counts?.completion_reverted ?? 0,
        staleResponseDroppedCount: counts?.stale_response_dropped ?? 0,
        providerErrorCount: counts?.provider_error ?? 0,
        staleResponseDroppedRequestIds,
        ghostLatencySamples,
      };
    },
    resetMetrics() {
      completionController?.remote.resetMetrics();
      lastMetricEvent = null;
      renderMetrics();
    },
    setIgnoreAbortForProvider(value) {
      ignoreAbortForProvider = value;
    },
    failNextRequest() {
      failNextRequest = true;
    },
  };
}

function presetText(value: string): string {
  if (value === "prompt") {
    return " with a concise next instruction for the mock prompt.";
  }

  if (value === "markdown") {
    return " and add one short supporting bullet.";
  }

  if (value === "empty") {
    return "";
  }

  return " with a focused mocked continuation.";
}

function getMockLatencyMs(input: HTMLInputElement): number {
  const parsed = Number.parseInt(input.value, 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(1500, Math.max(0, parsed));
}

function waitForMockLatency(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timerId = window.setTimeout(resolve, ms);

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

function formatRemoteStatus(
  controller: ContenteditableRemoteCompletionController | null,
  enabled: boolean,
): string {
  if (!enabled) {
    return "disabled";
  }

  return controller?.remote.getState().status ?? "idle";
}

function formatLatency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(0)} ms`;
}

function getP95(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * 0.95) - 1;

  return sorted[Math.max(0, index)] ?? null;
}

function placeCaretAtEnd(element: HTMLElement): void {
  element.focus();

  const selection = element.ownerDocument.getSelection();

  if (selection === null) {
    return;
  }

  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setText(element: HTMLElement | null, value: string): void {
  if (element) {
    element.textContent = value;
  }
}
