import {
  type CorrectionTransaction,
  plainTextOffsetToDomPosition,
  type TypaiPopover,
  type VisualMark,
} from "@typai/contenteditable";
import type { CorrectionDecision, Token, TypaiCore, TypaiMemoryExport } from "@typai/core";
import { createMemoryStorage, createTypaiCore } from "@typai/core";
import {
  TypaiContenteditable,
  TypaiDebugTable,
  TypaiProvider,
  TypaiSettingsPanel,
  TypaiTextarea,
  useTypaiCore,
} from "@typai/react";
import type {
  TextareaCorrectionEvent,
  TextareaMarkEvent,
  TextareaProtectedSkipEvent,
} from "@typai/textarea";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  COMPLETION_DEMO_DEBOUNCE_MS,
  COMPLETION_DEMO_MIN_PREFIX_CHARS,
  type CompletionDemoMetricsSnapshot,
  createContenteditableMockCompletionController,
  createTextareaMockCompletionController,
  type DemoContenteditableCompletionController,
  type DemoTextareaCompletionController,
  formatCompletionLatency,
} from "./completionDemoControllers";
import { type DemoMark, pruneStaleMarks, renderMarkedText } from "./markRendering";

type TypaiReactDebug = {
  getDebugData(): TypaiUiDebugData;
  getLastMemoryExport(): string | null;
  getRenderCount(): number;
  getCompletionMetrics(): {
    textarea: CompletionDemoMetricsSnapshot;
    contenteditable: CompletionDemoMetricsSnapshot;
  };
  setCompletionLatencyMs(value: number): void;
  setIgnoreAbortForProvider(value: boolean): void;
  failNextCompletionRequest(surface: "textarea" | "contenteditable"): void;
};

type TypaiUiDebugEvent = {
  time: string;
  source: string;
  action: string;
  outcome: string;
  reasonCodes?: string[];
  latencyMs?: number;
};

type TypaiUiDebugData = {
  recentEvents: TypaiUiDebugEvent[];
  correctionCount: number;
  unresolvedCount: number;
  revertCount: number;
  protectedSkipCount: number;
  latenciesMs: number[];
};

type TypaiUiSettings = {
  autocorrect: boolean;
  spellcheck: boolean;
  keepCorrectionMarksVisible: boolean;
  usePersonalDictionary: boolean;
};

declare global {
  interface Window {
    __typaiReactDebug?: TypaiReactDebug;
  }
}

type DebugEvent = TypaiUiDebugData["recentEvents"][number];

const initialSettings: TypaiUiSettings = {
  autocorrect: true,
  spellcheck: true,
  keepCorrectionMarksVisible: true,
  usePersonalDictionary: true,
};

const emptyDebugData: TypaiUiDebugData = {
  recentEvents: [],
  correctionCount: 0,
  unresolvedCount: 0,
  revertCount: 0,
  protectedSkipCount: 0,
  latenciesMs: [],
};

const emptyCompletionMetrics: CompletionDemoMetricsSnapshot = {
  status: "idle",
  requestCount: 0,
  ghostShownCount: 0,
  acceptedCount: 0,
  dismissedCount: 0,
  revertedCount: 0,
  providerErrorCount: 0,
  staleResponseDroppedCount: 0,
  p95GhostLatencyMs: null,
  lastEvent: "-",
};

export function mountReactDemo(root: HTMLElement): void {
  createRoot(root).render(<ReactDemo />);
}

function ReactDemo() {
  return (
    <TypaiProvider createCore={createReactDemoCore}>
      <ReactDemoContent />
    </TypaiProvider>
  );
}

function ReactDemoContent() {
  const { typai, status, error } = useTypaiCore();
  const [settings, setSettings] = useState<TypaiUiSettings>(initialSettings);
  const [debugData, setDebugData] = useState<TypaiUiDebugData>(emptyDebugData);
  const [memoryExport, setMemoryExport] = useState<string | null>(null);
  const [memoryMessage, setMemoryMessage] = useState("Memory ready.");
  const [renderCount, setRenderCount] = useState(1);
  const [completionEnabled, setCompletionEnabled] = useState(true);
  const [contenteditablePopover, setContenteditablePopover] = useState<TypaiPopover | null>(null);
  const [, setCompletionMetricVersion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contenteditableRef = useRef<HTMLDivElement | null>(null);
  const contenteditableMarksRef = useRef<DemoMark[]>([]);
  const completionEnabledRef = useRef(true);
  const completionProviderControlRef = useRef({
    latencyMs: 50,
    ignoreAbort: false,
    failNextTextarea: false,
    failNextContenteditable: false,
  });

  const requestCompletionMetricRender = useCallback(() => {
    setCompletionMetricVersion((current) => current + 1);
  }, []);

  const textareaCompletion = useMemo<DemoTextareaCompletionController>(
    () =>
      createTextareaMockCompletionController({
        surface: "react-textarea",
        mode: "prose",
        isEnabled: () => completionEnabledRef.current,
        getLatencyMs: () => completionProviderControlRef.current.latencyMs,
        shouldIgnoreAbort: () => completionProviderControlRef.current.ignoreAbort,
        consumeProviderError: () => {
          const shouldFail = completionProviderControlRef.current.failNextTextarea;

          completionProviderControlRef.current.failNextTextarea = false;
          return shouldFail;
        },
        onUpdate: requestCompletionMetricRender,
      }),
    [requestCompletionMetricRender],
  );

  const contenteditableCompletion = useMemo<DemoContenteditableCompletionController>(
    () =>
      createContenteditableMockCompletionController({
        surface: "react-contenteditable",
        mode: "prose",
        isEnabled: () => completionEnabledRef.current,
        getLatencyMs: () => completionProviderControlRef.current.latencyMs,
        shouldIgnoreAbort: () => completionProviderControlRef.current.ignoreAbort,
        consumeProviderError: () => {
          const shouldFail = completionProviderControlRef.current.failNextContenteditable;

          completionProviderControlRef.current.failNextContenteditable = false;
          return shouldFail;
        },
        onUpdate: requestCompletionMetricRender,
      }),
    [requestCompletionMetricRender],
  );

  useEffect(
    () => () => {
      textareaCompletion.destroy?.();
      contenteditableCompletion.destroy?.();
    },
    [contenteditableCompletion, textareaCompletion],
  );

  const textareaCompletionMetrics = completionEnabled
    ? textareaCompletion.getDemoMetrics()
    : emptyCompletionMetrics;
  const contenteditableCompletionMetrics = completionEnabled
    ? contenteditableCompletion.getDemoMetrics()
    : emptyCompletionMetrics;
  const combinedCompletionMetrics = combineCompletionMetrics(
    textareaCompletionMetrics,
    contenteditableCompletionMetrics,
  );

  const recordEvent = useCallback((event: Omit<DebugEvent, "time">) => {
    setDebugData((current) => ({
      ...current,
      recentEvents: [
        {
          ...event,
          time: new Date().toLocaleTimeString(),
        },
        ...current.recentEvents,
      ].slice(0, 8),
    }));
  }, []);

  const recordTextareaCorrection = useCallback(
    (event: TextareaCorrectionEvent) => {
      setDebugData((current) => ({
        ...current,
        correctionCount: current.correctionCount + 1,
      }));
      recordEvent({
        source: "react-textarea",
        action: `corrected ${event.transaction.original} -> ${event.transaction.replacement}`,
        outcome: "blue mark",
        reasonCodes: event.transaction.reasonCodes,
      });
    },
    [recordEvent],
  );

  const recordContenteditableCorrection = useCallback(
    (transaction: CorrectionTransaction) => {
      setDebugData((current) => ({
        ...current,
        correctionCount: current.correctionCount + 1,
      }));
      recordEvent({
        source: "react-contenteditable",
        action: `corrected ${transaction.original} -> ${transaction.replacement}`,
        outcome: "text updated",
        reasonCodes: transaction.reasonCodes,
      });
    },
    [recordEvent],
  );

  const recordTextareaMark = useCallback(
    (event: TextareaMarkEvent) => {
      if (event.mark.kind !== "red_spelling_issue") {
        return;
      }

      setDebugData((current) => ({
        ...current,
        unresolvedCount: current.unresolvedCount + 1,
      }));
      recordEvent({
        source: "react-textarea",
        action: `marked ${event.mark.original ?? "token"}`,
        outcome: "red mark",
        reasonCodes: [],
      });
    },
    [recordEvent],
  );

  const recordContenteditableMark = useCallback(
    (mark: VisualMark) => {
      if (mark.kind !== "red_spelling_issue") {
        return;
      }

      setDebugData((current) => ({
        ...current,
        unresolvedCount: current.unresolvedCount + 1,
      }));
      recordEvent({
        source: "react-contenteditable",
        action: `marked ${mark.original ?? "token"}`,
        outcome: "red mark",
        reasonCodes: mark.reasonCodes ?? [],
      });
    },
    [recordEvent],
  );

  const renderReactContenteditableMarks = useCallback((caretOffset?: number | null) => {
    const element = contenteditableRef.current;

    if (element === null) {
      return;
    }

    const text = element.textContent ?? "";
    const nextMarks = pruneStaleMarks(text, contenteditableMarksRef.current);

    contenteditableMarksRef.current = nextMarks;
    element.innerHTML = renderMarkedText(text, nextMarks);
    setContenteditableCaretOffset(element, caretOffset ?? text.length);
  }, []);

  const recordRenderableContenteditableMark = useCallback(
    (mark: VisualMark) => {
      const element = contenteditableRef.current;
      const text = element?.textContent ?? "";
      const markedText = text.slice(mark.range.start, mark.range.end);

      if (markedText.length > 0) {
        contenteditableMarksRef.current = [
          ...contenteditableMarksRef.current,
          {
            ...mark,
            text: markedText,
          },
        ];
      }

      recordContenteditableMark(mark);
      renderReactContenteditableMarks();
    },
    [recordContenteditableMark, renderReactContenteditableMarks],
  );

  const removeRenderableContenteditableMark = useCallback(
    (mark: VisualMark) => {
      contenteditableMarksRef.current = contenteditableMarksRef.current.filter(
        (candidate) => candidate.id !== mark.id,
      );
      renderReactContenteditableMarks();
    },
    [renderReactContenteditableMarks],
  );

  const recordProtectedSkip = useCallback(
    (source: string) => {
      setDebugData((current) => ({
        ...current,
        protectedSkipCount: current.protectedSkipCount + 1,
      }));
      recordEvent({
        source,
        action: "protected token skipped",
        outcome: "unchanged",
        reasonCodes: ["protected_token"],
      });
    },
    [recordEvent],
  );

  const recordDecision = useCallback(
    (source: string, decision: CorrectionDecision) => {
      if (decision.action !== "do_nothing") {
        return;
      }

      recordEvent({
        source,
        action: "checked token",
        outcome: "unchanged",
        reasonCodes: decision.reasonCodes,
      });
    },
    [recordEvent],
  );

  const resetInputs = useCallback(() => {
    contenteditableMarksRef.current = [];
    setContenteditablePopover(null);

    if (textareaRef.current !== null) {
      textareaRef.current.value = "";
      textareaRef.current.setSelectionRange(0, 0);
      textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      textareaRef.current.focus();
    }

    if (contenteditableRef.current !== null) {
      contenteditableRef.current.textContent = "";
      contenteditableRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }

    textareaCompletion.resetDemoMetrics();
    contenteditableCompletion.resetDemoMetrics();
    setDebugData(emptyDebugData);
    requestCompletionMetricRender();
  }, [contenteditableCompletion, requestCompletionMetricRender, textareaCompletion]);

  const exportMemory = useCallback(async () => {
    if (typai === null) {
      return;
    }

    const exported = await typai.exportTypaiMemory();

    setMemoryExport(JSON.stringify(exported, null, 2));
    setMemoryMessage("Memory exported.");
    recordEvent({
      source: "react-provider",
      action: "memory export",
      outcome: `${exported.personalDictionary.length} dictionary, ${exported.correctionRules.length} rules`,
      reasonCodes: [],
    });
  }, [recordEvent, typai]);

  const resetMemory = useCallback(async () => {
    if (typai === null) {
      return;
    }

    await typai.resetTypaiMemory();
    setMemoryExport(null);
    setMemoryMessage("Memory reset.");
    resetInputs();
    recordEvent({
      source: "react-provider",
      action: "memory reset",
      outcome: "cleared",
      reasonCodes: [],
    });
  }, [recordEvent, resetInputs, typai]);

  const importMemory = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (typai === null) {
        return;
      }

      const file = event.currentTarget.files?.[0];

      if (file === undefined) {
        return;
      }

      const data = JSON.parse(await file.text()) as TypaiMemoryExport;

      await typai.importTypaiMemory(data);
      event.currentTarget.value = "";
      setMemoryMessage("Memory imported.");
      recordEvent({
        source: "react-provider",
        action: "memory import",
        outcome: "applied",
        reasonCodes: [],
      });
    },
    [recordEvent, typai],
  );

  useEffect(() => {
    window.__typaiReactDebug = {
      getDebugData() {
        return debugData;
      },
      getLastMemoryExport() {
        return memoryExport;
      },
      getRenderCount() {
        return renderCount;
      },
      getCompletionMetrics() {
        return {
          textarea: textareaCompletion.getDemoMetrics(),
          contenteditable: contenteditableCompletion.getDemoMetrics(),
        };
      },
      setCompletionLatencyMs(value) {
        completionProviderControlRef.current.latencyMs = value;
      },
      setIgnoreAbortForProvider(value) {
        completionProviderControlRef.current.ignoreAbort = value;
      },
      failNextCompletionRequest(surface) {
        if (surface === "textarea") {
          completionProviderControlRef.current.failNextTextarea = true;
          return;
        }

        completionProviderControlRef.current.failNextContenteditable = true;
      },
    };

    return () => {
      delete window.__typaiReactDebug;
    };
  }, [contenteditableCompletion, debugData, memoryExport, renderCount, textareaCompletion]);

  return (
    <div className="react-demo-content">
      <div className="demo-panel-header">
        <div>
          <h2>React Completion Demo</h2>
          <p>
            React textarea and contenteditable components with explicit mocked completion
            controllers. Correction still runs when completion is disabled.
          </p>
        </div>
        <div className="react-demo-actions">
          <button
            className="reset-button"
            type="button"
            data-testid="react-rerender"
            onClick={() => setRenderCount((current) => current + 1)}
          >
            Re-render React Demo
          </button>
          <button
            className="reset-button"
            type="button"
            data-testid="react-reset"
            onClick={resetInputs}
          >
            Reset React Inputs
          </button>
        </div>
      </div>

      <div className="react-demo-status" aria-live="polite">
        <span>Provider core</span>
        <output data-testid="react-core-status">
          {status === "error" ? "error" : status === "ready" ? "ready" : "loading"}
        </output>
        <span>Render count</span>
        <output data-testid="react-render-count">{renderCount}</output>
        {error instanceof Error ? <span>{error.message}</span> : null}
      </div>

      <ul className="demo-notes" id="react-demo-instructions">
        <li>
          Type at least <code>{COMPLETION_DEMO_MIN_PREFIX_CHARS}</code> characters, pause for the
          mocked provider, then press Tab to accept ghost text.
        </li>
        <li>Press Escape or keep typing to dismiss a visible completion.</li>
        <li>Use Revert React Completion after accepting text in either React surface.</li>
        <li>
          <code>teh </code> -&gt; blue corrected mark.
        </li>
        <li>
          <code>reciept </code> -&gt; red mark and suggestion.
        </li>
        <li>
          <code>form </code> -&gt; no correction.
        </li>
        <li>
          <code>user@example.com </code> -&gt; protected no correction.
        </li>
      </ul>

      <div className="react-demo-layout">
        <section className="react-editor-column" aria-label="React typai editors">
          <TypaiTextarea
            ref={textareaRef}
            className="textarea-editor react-textarea"
            aria-label="React typai textarea"
            aria-describedby="react-demo-instructions"
            data-testid="react-textarea"
            placeholder="Write in the React textarea..."
            rows={8}
            spellCheck={false}
            settings={settings}
            completion={textareaCompletion}
            overlay={{ enabled: true, className: "typai-textarea-demo-overlay" }}
            onCorrection={recordTextareaCorrection}
            onMark={recordTextareaMark}
            onProtectedSkip={(_event: TextareaProtectedSkipEvent) =>
              recordProtectedSkip("react-textarea")
            }
            onDecision={(event) => recordDecision("react-textarea", event.decision)}
          />

          <TypaiContenteditable
            ref={contenteditableRef}
            className="editor-surface react-contenteditable"
            role="textbox"
            aria-label="React typai contenteditable"
            aria-describedby="react-demo-instructions"
            aria-multiline="true"
            data-testid="react-contenteditable"
            spellCheck={false}
            settings={settings}
            completion={contenteditableCompletion}
            onCorrection={recordContenteditableCorrection}
            onMark={recordRenderableContenteditableMark}
            onMarkRemoved={removeRenderableContenteditableMark}
            onPopover={setContenteditablePopover}
            onProtectedSkip={(_token: Token) => recordProtectedSkip("react-contenteditable")}
            onDecision={(decision) => recordDecision("react-contenteditable", decision)}
            onTextChange={(change) => renderReactContenteditableMarks(change.caretOffset)}
          />
          {contenteditablePopover !== null ? (
            <ReactContenteditablePopover
              popover={contenteditablePopover}
              onClose={() => setContenteditablePopover(null)}
            />
          ) : null}
        </section>

        <aside className="textarea-side-panel" aria-label="React controls and debug">
          <section className="settings-panel compact-panel" aria-label="React settings">
            <h2>React Settings</h2>
            <TypaiSettingsPanel
              settings={settings}
              onChange={setSettings}
              label="React typai settings"
            />
          </section>

          <section className="settings-panel compact-panel" aria-label="React completion controls">
            <h2>Completion Controls</h2>
            <label>
              <input
                type="checkbox"
                data-testid="react-completion-enabled"
                checked={completionEnabled}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;

                  completionEnabledRef.current = checked;
                  setCompletionEnabled(checked);

                  if (!checked) {
                    textareaCompletion.remote.dismiss("manual");
                    contenteditableCompletion.remote.dismiss("manual");
                  }

                  requestCompletionMetricRender();
                }}
              />
              Enable mocked completion
            </label>
            <div className="remote-setting-row">
              <span>Debounce</span>
              <output>{COMPLETION_DEMO_DEBOUNCE_MS} ms</output>
            </div>
            <div className="react-demo-actions">
              <button
                className="reset-button"
                type="button"
                data-testid="react-revert-completion"
                disabled={
                  !textareaCompletion.hasAcceptedCompletion() &&
                  !contenteditableCompletion.hasAcceptedCompletion()
                }
                onClick={() => {
                  const reverted =
                    textareaCompletion.revertLastCompletion() ||
                    contenteditableCompletion.revertLastCompletion();

                  recordEvent({
                    source: "react-completion",
                    action: "revert completion",
                    outcome: reverted ? "reverted" : "no transaction",
                    reasonCodes: [],
                  });
                  requestCompletionMetricRender();
                }}
              >
                Revert React Completion
              </button>
              <button
                className="reset-button"
                type="button"
                data-testid="react-reset-completion-metrics"
                onClick={() => {
                  textareaCompletion.resetDemoMetrics();
                  contenteditableCompletion.resetDemoMetrics();
                  requestCompletionMetricRender();
                }}
              >
                Reset completion metrics
              </button>
            </div>
            <p className="panel-note">
              Controllers are passed explicitly to the React components. No browser key path or real
              provider call is present.
            </p>
          </section>

          <section className="debug-panel compact-panel" aria-label="React completion status">
            <h2>Completion Status</h2>
            <dl>
              <div>
                <dt>Textarea</dt>
                <dd data-testid="react-textarea-completion-status">
                  {completionEnabled ? textareaCompletionMetrics.status : "disabled"}
                </dd>
              </div>
              <div>
                <dt>Contenteditable</dt>
                <dd data-testid="react-contenteditable-completion-status">
                  {completionEnabled ? contenteditableCompletionMetrics.status : "disabled"}
                </dd>
              </div>
              <div>
                <dt>Last event</dt>
                <dd data-testid="react-completion-last-event">
                  {combinedCompletionMetrics.lastEvent}
                </dd>
              </div>
            </dl>
          </section>

          <section className="debug-panel compact-panel" aria-label="React completion metrics">
            <h2>Completion Metrics</h2>
            <dl>
              <div>
                <dt>Requests</dt>
                <dd data-testid="react-completion-requests">
                  {combinedCompletionMetrics.requestCount}
                </dd>
              </div>
              <div>
                <dt>Ghost shown</dt>
                <dd data-testid="react-completion-ghost-shown">
                  {combinedCompletionMetrics.ghostShownCount}
                </dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd data-testid="react-completion-accepted">
                  {combinedCompletionMetrics.acceptedCount}
                </dd>
              </div>
              <div>
                <dt>Dismissed</dt>
                <dd data-testid="react-completion-dismissed">
                  {combinedCompletionMetrics.dismissedCount}
                </dd>
              </div>
              <div>
                <dt>Reverted</dt>
                <dd data-testid="react-completion-reverted">
                  {combinedCompletionMetrics.revertedCount}
                </dd>
              </div>
              <div>
                <dt>p95 ghost latency</dt>
                <dd data-testid="react-completion-p95">
                  {formatCompletionLatency(combinedCompletionMetrics.p95GhostLatencyMs)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="memory-panel compact-panel" aria-label="React memory controls">
            <h2>React Memory</h2>
            <div className="memory-actions">
              <button
                className="reset-button"
                type="button"
                data-testid="react-export-memory"
                disabled={typai === null}
                onClick={() => void exportMemory()}
              >
                Export Memory
              </button>
              <label className="file-action">
                Import Memory
                <input
                  type="file"
                  accept="application/json,.json"
                  data-testid="react-import-memory-input"
                  disabled={typai === null}
                  onChange={(event) => void importMemory(event)}
                />
              </label>
              <button
                className="reset-button"
                type="button"
                data-testid="react-reset-memory"
                disabled={typai === null}
                onClick={() => void resetMemory()}
              >
                Reset Memory
              </button>
              <output data-testid="react-memory-message">{memoryMessage}</output>
            </div>
            <textarea
              className="react-memory-output"
              aria-label="React memory export"
              data-testid="react-memory-output"
              readOnly
              value={memoryExport ?? ""}
            />
          </section>

          <section className="debug-panel compact-panel" aria-label="React debug">
            <h2>React Debug</h2>
            <TypaiDebugTable data={debugData} label="React typai debug summary" />
          </section>
        </aside>
      </div>
    </div>
  );
}

function createReactDemoCore(): Promise<TypaiCore> {
  return createTypaiCore({
    storage: createMemoryStorage(),
  });
}

function ReactContenteditablePopover({
  popover,
  onClose,
}: {
  popover: TypaiPopover;
  onClose(): void;
}) {
  if (popover.kind === "blue_correction") {
    const runAction = (action: () => Promise<unknown>) => {
      void action().finally(onClose);
    };

    return (
      <div className="typai-popover" data-testid="react-contenteditable-blue-popover">
        <p>
          Corrected "{popover.mark.original}" -&gt; "{popover.mark.replacement}".
        </p>
        <div className="typai-popover-actions">
          <button
            type="button"
            data-testid="react-contenteditable-revert-action"
            onClick={() => runAction(popover.actions.revert)}
          >
            Revert
          </button>
          <button
            type="button"
            data-testid="react-contenteditable-always-correct-action"
            onClick={() => runAction(popover.actions.alwaysCorrect)}
          >
            Always correct
          </button>
          <button
            type="button"
            data-testid="react-contenteditable-never-correct-action"
            onClick={() => runAction(popover.actions.neverCorrect)}
          >
            Don't correct again
          </button>
          <button
            type="button"
            data-testid="react-contenteditable-add-dictionary-action"
            onClick={() => runAction(popover.actions.addOriginalToDictionary)}
          >
            Add original to dictionary
          </button>
        </div>
      </div>
    );
  }

  const runRedAction = (action: () => Promise<unknown>) => {
    void action().finally(onClose);
  };

  return (
    <div className="typai-popover" data-testid="react-contenteditable-red-popover">
      <p>Possible spelling issue: "{popover.original}".</p>
      <div className="typai-popover-actions">
        {popover.suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            data-testid="react-contenteditable-suggestion-item"
            onClick={() => runRedAction(() => popover.actions.applySuggestion(suggestion))}
          >
            {suggestion}
          </button>
        ))}
        <button
          type="button"
          data-testid="react-contenteditable-ignore-once-action"
          onClick={() => runRedAction(popover.actions.ignoreOnce)}
        >
          Ignore once
        </button>
        <button
          type="button"
          data-testid="react-contenteditable-add-dictionary-action"
          onClick={() => runRedAction(popover.actions.addToDictionary)}
        >
          Add to dictionary
        </button>
      </div>
    </div>
  );
}

function setContenteditableCaretOffset(element: HTMLElement, offset: number): void {
  const ownerDocument = element.ownerDocument;
  const selection = ownerDocument.getSelection();
  const position = plainTextOffsetToDomPosition(element, offset);

  if (selection === null || position === null) {
    return;
  }

  const range = ownerDocument.createRange();

  range.setStart(position.node, position.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function combineCompletionMetrics(
  textarea: CompletionDemoMetricsSnapshot,
  contenteditable: CompletionDemoMetricsSnapshot,
): CompletionDemoMetricsSnapshot {
  const p95Values = [textarea.p95GhostLatencyMs, contenteditable.p95GhostLatencyMs].filter(
    (value): value is number => typeof value === "number",
  );

  return {
    status:
      textarea.status === "showing" || contenteditable.status === "showing"
        ? "showing"
        : contenteditable.status !== "idle"
          ? contenteditable.status
          : textarea.status,
    requestCount: textarea.requestCount + contenteditable.requestCount,
    ghostShownCount: textarea.ghostShownCount + contenteditable.ghostShownCount,
    acceptedCount: textarea.acceptedCount + contenteditable.acceptedCount,
    dismissedCount: textarea.dismissedCount + contenteditable.dismissedCount,
    revertedCount: textarea.revertedCount + contenteditable.revertedCount,
    providerErrorCount: textarea.providerErrorCount + contenteditable.providerErrorCount,
    staleResponseDroppedCount:
      textarea.staleResponseDroppedCount + contenteditable.staleResponseDroppedCount,
    p95GhostLatencyMs: p95Values.length === 0 ? null : Math.max(...p95Values),
    lastEvent:
      contenteditable.lastEvent !== "-"
        ? `contenteditable:${contenteditable.lastEvent}`
        : textarea.lastEvent !== "-"
          ? `textarea:${textarea.lastEvent}`
          : "-",
  };
}
