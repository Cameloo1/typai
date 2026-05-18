import type { CorrectionTransaction, VisualMark } from "@typai/contenteditable";
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
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type TypaiReactDebug = {
  getDebugData(): TypaiUiDebugData;
  getLastMemoryExport(): string | null;
  getRenderCount(): number;
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contenteditableRef = useRef<HTMLDivElement | null>(null);

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

    setDebugData(emptyDebugData);
  }, []);

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
    };

    return () => {
      delete window.__typaiReactDebug;
    };
  }, [debugData, memoryExport, renderCount]);

  return (
    <div className="react-demo-content">
      <div className="demo-panel-header">
        <div>
          <h2>React Demo</h2>
          <p>
            React provider, textarea, contenteditable, settings, debug, and memory controls using
            the local deterministic core.
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
            onCorrection={recordContenteditableCorrection}
            onMark={recordContenteditableMark}
            onProtectedSkip={(_token: Token) => recordProtectedSkip("react-contenteditable")}
            onDecision={(decision) => recordDecision("react-contenteditable", decision)}
          />
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
