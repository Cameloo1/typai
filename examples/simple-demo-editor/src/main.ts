import {
  attachContenteditable,
  type CorrectionTransaction,
  type PopoverActionResult,
  type TypaiPopover,
  type TypaiSettings,
  type TypaiUserAction,
} from "@typai/contenteditable";
import {
  type CorrectionDecision,
  createIndexedDbStorage,
  createMemoryStorage,
  createTypaiCore,
  type TypaiCore,
  type TypaiMemoryExport,
  type TypaiStorage,
} from "@typai/core";
import {
  attachTextarea,
  type TextareaCompletionAcceptResult,
  type TextareaCompletionRevertResult,
  type TextareaCompletionSnapshot,
  type TextareaCompletionTransaction,
  type TextareaCorrectionEvent,
  type TextareaDecisionEvent,
  type TextareaMark,
  type TextareaMarkEvent,
  type TextareaMarkRemovedEvent,
  type TextareaProtectedSkipEvent,
} from "@typai/textarea";
import { measureCaretInOverlayMirror } from "../../../packages/textarea/src/completion/caretGeometry";
import { mountCodeMirrorDemo, mountCodexMockDemo } from "./codemirrorDemo";
import {
  COMPLETION_DEMO_DEBOUNCE_MS,
  COMPLETION_DEMO_MIN_PREFIX_CHARS,
  createTextareaMockCompletionController,
  type DemoTextareaCompletionController,
} from "./completionDemoControllers";
import { type DemoMark, pruneStaleMarks, renderMarkedText } from "./markRendering";
import { mountReactDemo } from "./reactDemo";
import "./styles.css";

type MetricState = {
  correctionCount: number;
  unresolvedCount: number;
  protectedSkipCount: number;
  revertCount: number;
  personalDictionaryCount: number;
  correctionRulesCount: number;
  latencies: number[];
  latencySamples: number[];
  lastLatency: number | null;
  lastDecision: string;
  lastUserAction: string;
  pendingStartedAt: number | null;
};

type DebugEvent = {
  time: string;
  actionType: string;
  original: string;
  replacement: string;
  result: string;
  reasonCodes: string[];
};

type StorageMode = "indexeddb" | "memory";

type DemoDebugSnapshot = Omit<MetricState, "pendingStartedAt">;

type TypaiDemoDebug = {
  getMetrics(): DemoDebugSnapshot;
  getDebugEvents(): DebugEvent[];
  clearLatencies(): void;
  getLastMemoryExport(): string | null;
  importMemoryText(text: string): Promise<void>;
};

type TypaiTextareaDemoDebug = {
  getMetrics(): { latencySamples: number[] };
  clearLatencies(): void;
};

type TextareaGhostFeasibilitySnapshot = {
  textareaValue: string;
  ghostText: string;
  offset: number;
  ghostRect: RectSnapshot;
  caretRect: RectSnapshot | null;
  deltaLeft: number | null;
  deltaTop: number | null;
};

type RectSnapshot = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type TypaiTextareaGhostFeasibilityDebug = {
  render(text: string, offset?: number): TextareaGhostFeasibilitySnapshot;
  resync(offset?: number): TextareaGhostFeasibilitySnapshot;
  clear(): void;
  getSnapshot(): TextareaGhostFeasibilitySnapshot | null;
  accept(): TextareaCompletionAcceptResult;
  revertLast(): TextareaCompletionRevertResult;
  getTransactions(): TextareaCompletionTransaction[];
};

type TypaiTextareaCompletionDemoDebug = {
  getMetrics(): ReturnType<DemoTextareaCompletionController["getDemoMetrics"]>;
  setLatencyMs(value: number): void;
  setIgnoreAbortForProvider(value: boolean): void;
  failNextRequest(): void;
};

declare global {
  interface Window {
    __typaiDebug?: TypaiDemoDebug;
    __typaiTextareaDebug?: TypaiTextareaDemoDebug;
    __typaiTextareaCompletionDebug?: TypaiTextareaCompletionDemoDebug;
    __typaiTextareaGhostFeasibility?: TypaiTextareaGhostFeasibilityDebug;
    __typaiTextareaGhostRenderer?: TypaiTextareaGhostFeasibilityDebug;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main class="demo-shell">
      <section class="intro-panel" aria-labelledby="demo-title">
        <div>
          <p class="eyebrow">typai V1A-dev</p>
          <h1 id="demo-title">typai MVP Demo</h1>
          <p class="summary">Deterministic local typo correction plus an opt-in mocked V4 remote completion prototype.</p>
        </div>
        <div class="intro-actions">
          <button class="reset-button" type="button" data-reset data-testid="reset-editor">Reset Editor</button>
          <button class="reset-button" type="button" data-clear-storage data-testid="clear-storage">Clear Storage</button>
        </div>
      </section>

      <nav class="demo-tabs" aria-label="Demo surfaces">
        <button type="button" data-demo-tab="contenteditable" data-active="true">Contenteditable Demo</button>
        <button type="button" data-demo-tab="textarea" data-active="false">Textarea Completion Demo</button>
        <button type="button" data-demo-tab="react" data-active="false">React Completion Demo</button>
        <button type="button" data-demo-tab="codemirror" data-active="false">CodeMirror Completion Demo</button>
        <button type="button" data-demo-tab="codex-mock" data-active="false">Codex Mock Demo</button>
        <button type="button" data-demo-tab="remote-completion" data-active="false">V4 Remote Completion</button>
        <button type="button" data-demo-tab="chat" data-active="false">Chat Input Demo</button>
      </nav>

      <section class="instructions-panel" aria-label="Manual verification scenarios" data-demo-panel="contenteditable">
        <h2>Try These</h2>
        <ul id="editor-instructions">
          <li>Try typing: <code>teh </code> Expected correction: <code>the</code> with blue dotted underline.</li>
          <li>Click the blue mark for Revert, Always correct, Don't correct again, or Add original to dictionary.</li>
          <li>Try typing: <code>reciept </code> Expected red squiggly underline with <code>receipt</code> suggestion.</li>
          <li>Try typing: <code>zzzzword </code> Expected red squiggly underline.</li>
          <li>Add <code>zzzzword</code> to the dictionary, reset the editor, then type it again: no red mark.</li>
          <li>Try typing: <code>user@example.com </code> Expected no correction.</li>
          <li>Try typing: <code>form </code> Expected no correction.</li>
          <li>Turning autocorrect off prevents <code>teh</code> from becoming <code>the</code>; spellcheck can still mark it red.</li>
          <li>Turning spellcheck off prevents unresolved red marks.</li>
        </ul>
      </section>

      <section class="editor-panel" aria-label="typai demo editor" data-demo-panel="contenteditable">
        <div
          class="editor-surface"
          contenteditable="true"
          role="textbox"
          aria-label="typai contenteditable demo editor"
          aria-describedby="editor-instructions"
          aria-multiline="true"
          spellcheck="false"
          data-editor
          data-testid="typai-editor"
        ></div>
        <div
          id="typai-popover-dialog"
          class="typai-popover"
          role="dialog"
          aria-modal="false"
          aria-label="typai correction actions"
          data-popover
          data-testid="typai-popover"
          hidden
        ></div>
        <div class="sr-only" aria-live="polite" aria-atomic="true" data-live-region data-testid="live-region"></div>
      </section>

      <section class="settings-panel" aria-label="typai settings" data-demo-panel="contenteditable">
        <h2>Settings</h2>
        <label>
          Storage mode
          <select data-storage-mode data-testid="storage-mode">
            <option value="indexeddb">IndexedDB</option>
            <option value="memory">memory</option>
          </select>
        </label>
        <label>
          <input type="checkbox" data-setting-autocorrect data-testid="autocorrect-toggle" checked />
          Autocorrect
        </label>
        <label>
          <input type="checkbox" data-setting-spellcheck data-testid="spellcheck-toggle" checked />
          Spellcheck marks
        </label>
        <label>
          <input type="checkbox" data-setting-keep-marks data-testid="keep-marks-toggle" checked />
          Keep correction marks visible
        </label>
        <label>
          <input type="checkbox" data-setting-personal-dictionary data-testid="personal-dictionary-toggle" checked />
          Use personal dictionary
        </label>
      </section>

      <section class="memory-panel" aria-label="typai memory controls" data-demo-panel="contenteditable">
        <h2>Memory</h2>
        <div class="memory-actions">
          <button class="reset-button" type="button" data-export-memory data-testid="export-memory">Export Memory</button>
          <label class="file-action">
            Import Memory
            <input type="file" accept="application/json,.json" data-import-memory data-testid="import-memory-input" />
          </label>
          <button class="reset-button" type="button" data-reset-memory data-testid="reset-memory">Reset Memory</button>
        </div>
      </section>

      <section class="debug-panel" aria-label="Debug panel" data-demo-panel="contenteditable">
        <h2>Debug</h2>
        <dl>
          <div>
            <dt>Storage mode</dt>
            <dd data-storage-mode-label data-testid="storage-mode-label">IndexedDB</dd>
          </div>
          <div>
            <dt>Last user action</dt>
            <dd data-last-user-action data-testid="last-user-action">-</dd>
          </div>
          <div>
            <dt>Last decision</dt>
            <dd data-last-decision data-testid="last-decision">Loading core...</dd>
          </div>
          <div>
            <dt>Last latency</dt>
            <dd data-last-latency data-testid="last-latency">-</dd>
          </div>
          <div>
            <dt>Recent p95 latency</dt>
            <dd data-p95-latency data-testid="p95-latency">-</dd>
          </div>
          <div>
            <dt>Dictionary entries</dt>
            <dd data-personal-dictionary-count data-testid="personal-dictionary-count">0</dd>
          </div>
          <div>
            <dt>Correction rules</dt>
            <dd data-correction-rules-count data-testid="correction-rules-count">0</dd>
          </div>
          <div>
            <dt>Corrections</dt>
            <dd data-correction-count data-testid="correction-count">0</dd>
          </div>
          <div>
            <dt>Unresolved marks</dt>
            <dd data-unresolved-count data-testid="unresolved-count">0</dd>
          </div>
          <div>
            <dt>Reverts</dt>
            <dd data-revert-count data-testid="revert-count">0</dd>
          </div>
          <div>
            <dt>Protected skips</dt>
            <dd data-protected-skip-count data-testid="protected-skip-count">0</dd>
          </div>
        </dl>
        <h3>Local event table</h3>
        <div class="debug-table-wrap">
          <table class="debug-table" data-debug-table data-testid="debug-table">
            <caption>Recent local typai actions</caption>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Original</th>
                <th>Replacement</th>
                <th>Result</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody data-debug-table-body></tbody>
          </table>
        </div>
      </section>

      <section class="textarea-demo-panel" aria-label="Native textarea demo" data-demo-panel="textarea" data-testid="textarea-demo-root" hidden>
        <div class="demo-panel-header">
          <div>
            <h2>Textarea Completion Demo</h2>
            <p>Mocked completion renders as overlay ghost text near the caret. <code>textarea.value</code> remains the source of truth until Tab accepts.</p>
          </div>
          <div class="intro-actions">
            <button class="reset-button" type="button" data-textarea-reset data-testid="textarea-reset">Reset Textarea</button>
            <button class="reset-button" type="button" data-textarea-revert-completion data-testid="textarea-revert-completion" disabled>Revert Completion</button>
          </div>
        </div>

        <div class="textarea-demo-layout">
          <form class="textarea-workspace" data-textarea-form data-testid="textarea-form">
            <textarea
              class="textarea-editor"
              aria-label="typai native textarea demo"
              data-textarea-editor
              data-testid="textarea-editor"
              placeholder="Type here..."
              spellcheck="false"
              rows="10"
            ></textarea>
            <div class="textarea-form-actions">
              <button class="reset-button" type="submit" data-testid="textarea-form-submit">Submit Form</button>
              <button class="reset-button" type="reset" data-testid="textarea-form-reset">Native Reset</button>
              <output class="textarea-submit-output" data-textarea-submit-value data-testid="textarea-submit-value" aria-live="polite">-</output>
            </div>
            <ul class="demo-notes">
              <li>Type at least <code>${COMPLETION_DEMO_MIN_PREFIX_CHARS}</code> characters, pause for the mocked provider, then look for gray ghost text at the caret.</li>
              <li>Press Tab to accept the visible completion. Press Escape or keep typing to dismiss it.</li>
              <li>Accepted completion is normal textarea text only after Tab; Revert Completion removes the exact inserted text.</li>
              <li><code>teh </code> becomes <code>the </code> with a blue dotted overlay mark.</li>
              <li>Open the blue mark trigger with keyboard review to revert.</li>
              <li><code>reciept </code> renders a red mark with <code>receipt</code> as a suggestion.</li>
              <li><code>form </code>, <code>user@example.com </code>, and <code>/etc/passwd </code> remain unchanged.</li>
              <li>Paste multiline text and scroll to verify mirror synchronization. Overlay ghost alignment follows the measured caret, with browser text rendering as the remaining limit.</li>
            </ul>
          </form>

          <aside class="textarea-side-panel" aria-label="Textarea controls and debug">
            <section class="settings-panel compact-panel" aria-label="Textarea settings">
              <h2>Controls</h2>
              <label>
                Storage mode
                <select data-textarea-storage-mode data-testid="textarea-storage-mode">
                  <option value="indexeddb">IndexedDB</option>
                  <option value="memory">memory</option>
                </select>
              </label>
              <label>
                <input type="checkbox" data-textarea-autocorrect data-testid="textarea-autocorrect-toggle" checked />
                Autocorrect
              </label>
              <label>
                <input type="checkbox" data-textarea-spellcheck data-testid="textarea-spellcheck-toggle" checked />
                Spellcheck marks
              </label>
              <div class="memory-actions">
                <button class="reset-button" type="button" data-textarea-export-memory data-testid="textarea-export-memory">Export Memory</button>
                <label class="file-action">
                  Import Memory
                  <input type="file" accept="application/json,.json" data-textarea-import-memory data-testid="textarea-import-memory-input" />
                </label>
                <button class="reset-button" type="button" data-textarea-reset-memory data-testid="textarea-reset-memory">Reset Memory</button>
              </div>
            </section>

            <section class="settings-panel compact-panel" aria-label="Textarea completion controls">
              <h2>Completion Controls</h2>
              <label>
                <input type="checkbox" data-textarea-completion-enabled data-testid="textarea-completion-enabled" checked />
                Mock completion
              </label>
              <label>
                Mock text
                <input
                  type="text"
                  data-textarea-completion-text
                  data-testid="textarea-completion-text"
                  value=" with mocked textarea ghost text."
                />
              </label>
              <div class="remote-setting-row">
                <span>Debounce</span>
                <output>${COMPLETION_DEMO_DEBOUNCE_MS} ms</output>
              </div>
              <p class="panel-note">No network calls, no browser key input. The overlay is visual only and is not submitted with the form.</p>
            </section>

            <section class="debug-panel compact-panel" aria-label="Textarea completion status">
              <h2>Completion Status</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd data-textarea-completion-status data-testid="textarea-completion-status">idle</dd>
                </div>
                <div>
                  <dt>Last event</dt>
                  <dd data-textarea-completion-last-event data-testid="textarea-completion-last-event">-</dd>
                </div>
              </dl>
            </section>

            <section class="debug-panel compact-panel" aria-label="Textarea completion metrics">
              <h2>Completion Metrics</h2>
              <dl>
                <div>
                  <dt>Requests</dt>
                  <dd data-textarea-completion-requests data-testid="textarea-completion-requests">0</dd>
                </div>
                <div>
                  <dt>Ghost shown</dt>
                  <dd data-textarea-completion-ghost-shown data-testid="textarea-completion-ghost-shown">0</dd>
                </div>
                <div>
                  <dt>Accepted</dt>
                  <dd data-textarea-completion-accepted data-testid="textarea-completion-accepted">0</dd>
                </div>
                <div>
                  <dt>Dismissed</dt>
                  <dd data-textarea-completion-dismissed data-testid="textarea-completion-dismissed">0</dd>
                </div>
                <div>
                  <dt>Reverted</dt>
                  <dd data-textarea-completion-reverted data-testid="textarea-completion-reverted">0</dd>
                </div>
                <div>
                  <dt>p95 ghost latency</dt>
                  <dd data-textarea-completion-p95 data-testid="textarea-completion-p95">-</dd>
                </div>
              </dl>
              <button class="reset-button" type="button" data-textarea-completion-reset-metrics data-testid="textarea-completion-reset-metrics">Reset completion metrics</button>
            </section>

            <section class="debug-panel compact-panel" aria-label="Textarea debug">
              <h2>Debug</h2>
              <dl>
                <div>
                  <dt>Last decision</dt>
                  <dd data-textarea-last-decision>Loading core...</dd>
                </div>
                <div>
                  <dt>Last correction latency</dt>
                  <dd data-textarea-debug-latency data-testid="textarea-debug-latency">-</dd>
                </div>
                <div>
                  <dt>Corrections</dt>
                  <dd data-textarea-debug-correction-count data-testid="textarea-debug-correction-count">0</dd>
                </div>
                <div>
                  <dt>Unresolved marks</dt>
                  <dd data-textarea-debug-unresolved-count data-testid="textarea-debug-unresolved-count">0</dd>
                </div>
                <div>
                  <dt>Reverts</dt>
                  <dd data-textarea-debug-revert-count data-testid="textarea-debug-revert-count">0</dd>
                </div>
                <div>
                  <dt>Protected skips</dt>
                  <dd data-textarea-debug-protected-skip-count data-testid="textarea-debug-protected-skip-count">0</dd>
                </div>
                <div>
                  <dt>Marks</dt>
                  <dd data-textarea-debug-mark-count data-testid="textarea-debug-mark-count">0</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </section>

      <section class="react-demo-panel" aria-label="React adapter demo" data-demo-panel="react" data-testid="react-demo-root" hidden>
        <div data-react-demo-mount></div>
      </section>

      <section class="codemirror-demo-panel" aria-label="CodeMirror adapter demo" data-demo-panel="codemirror" data-testid="codemirror-demo-root" hidden>
        <div data-codemirror-demo-mount></div>
      </section>

      <section class="codemirror-demo-panel codex-mock-demo-panel" aria-label="Codex mock prompt editor demo" data-demo-panel="codex-mock" data-testid="codex-mock-demo-root" hidden>
        <div data-codex-mock-demo-mount></div>
      </section>

      <section class="remote-completion-demo-panel" aria-label="V4 remote completion demo" data-demo-panel="remote-completion" data-testid="remote-completion-demo-root" hidden>
        <div data-remote-completion-demo-mount></div>
      </section>

      <section class="chat-demo-panel" aria-label="Generic chat input demo" data-demo-panel="chat" data-testid="chat-demo-root" hidden>
        <div class="demo-panel-header">
          <div>
            <h2>Generic Chat Input Demo</h2>
            <p>Native textarea composer with typai correcting before send. Enter sends, Shift+Enter inserts a newline.</p>
          </div>
        </div>

        <div class="chat-window" role="log" aria-label="Sent messages" data-sent-messages></div>

        <form class="chat-composer" data-chat-form>
          <textarea
            class="chat-input"
            aria-label="Chat message"
            data-chat-input
            data-testid="chat-input"
            rows="2"
            spellcheck="false"
          ></textarea>
          <button class="reset-button chat-send" type="submit" data-chat-send data-testid="chat-send">Send</button>
        </form>
      </section>
    </main>
  `;

  const editor = app.querySelector<HTMLElement>("[data-editor]");
  const resetButton = app.querySelector<HTMLButtonElement>("[data-reset]");
  const clearStorageButton = app.querySelector<HTMLButtonElement>("[data-clear-storage]");
  const popoverElement = app.querySelector<HTMLElement>("[data-popover]");
  const storageModeSelect = app.querySelector<HTMLSelectElement>("[data-storage-mode]");
  const autocorrectToggle = app.querySelector<HTMLInputElement>("[data-setting-autocorrect]");
  const spellcheckToggle = app.querySelector<HTMLInputElement>("[data-setting-spellcheck]");
  const keepMarksToggle = app.querySelector<HTMLInputElement>("[data-setting-keep-marks]");
  const personalDictionaryToggle = app.querySelector<HTMLInputElement>(
    "[data-setting-personal-dictionary]",
  );
  const exportMemoryButton = app.querySelector<HTMLButtonElement>("[data-export-memory]");
  const importMemoryInput = app.querySelector<HTMLInputElement>("[data-import-memory]");
  const resetMemoryButton = app.querySelector<HTMLButtonElement>("[data-reset-memory]");
  const debugEls = {
    storageModeLabel: app.querySelector<HTMLElement>("[data-storage-mode-label]"),
    lastUserAction: app.querySelector<HTMLElement>("[data-last-user-action]"),
    lastDecision: app.querySelector<HTMLElement>("[data-last-decision]"),
    lastLatency: app.querySelector<HTMLElement>("[data-last-latency]"),
    p95Latency: app.querySelector<HTMLElement>("[data-p95-latency]"),
    personalDictionaryCount: app.querySelector<HTMLElement>("[data-personal-dictionary-count]"),
    correctionRulesCount: app.querySelector<HTMLElement>("[data-correction-rules-count]"),
    correctionCount: app.querySelector<HTMLElement>("[data-correction-count]"),
    unresolvedCount: app.querySelector<HTMLElement>("[data-unresolved-count]"),
    revertCount: app.querySelector<HTMLElement>("[data-revert-count]"),
    protectedSkipCount: app.querySelector<HTMLElement>("[data-protected-skip-count]"),
    debugTableBody: app.querySelector<HTMLElement>("[data-debug-table-body]"),
    liveRegion: app.querySelector<HTMLElement>("[data-live-region]"),
  };
  const textareaDemoRoot = app.querySelector<HTMLElement>("[data-testid='textarea-demo-root']");
  const textareaEditor = app.querySelector<HTMLTextAreaElement>("[data-textarea-editor]");
  const textareaForm = app.querySelector<HTMLFormElement>("[data-textarea-form]");
  const textareaSubmitValue = app.querySelector<HTMLElement>("[data-textarea-submit-value]");
  const textareaResetButton = app.querySelector<HTMLButtonElement>("[data-textarea-reset]");
  const textareaRevertCompletionButton = app.querySelector<HTMLButtonElement>(
    "[data-textarea-revert-completion]",
  );
  const textareaStorageModeSelect = app.querySelector<HTMLSelectElement>(
    "[data-textarea-storage-mode]",
  );
  const textareaAutocorrectToggle = app.querySelector<HTMLInputElement>(
    "[data-textarea-autocorrect]",
  );
  const textareaSpellcheckToggle = app.querySelector<HTMLInputElement>(
    "[data-textarea-spellcheck]",
  );
  const textareaExportMemoryButton = app.querySelector<HTMLButtonElement>(
    "[data-textarea-export-memory]",
  );
  const textareaImportMemoryInput = app.querySelector<HTMLInputElement>(
    "[data-textarea-import-memory]",
  );
  const textareaResetMemoryButton = app.querySelector<HTMLButtonElement>(
    "[data-textarea-reset-memory]",
  );
  const textareaCompletionEnabledToggle = app.querySelector<HTMLInputElement>(
    "[data-textarea-completion-enabled]",
  );
  const textareaCompletionTextInput = app.querySelector<HTMLInputElement>(
    "[data-textarea-completion-text]",
  );
  const textareaCompletionResetMetricsButton = app.querySelector<HTMLButtonElement>(
    "[data-textarea-completion-reset-metrics]",
  );
  const textareaDebugEls = {
    lastDecision: app.querySelector<HTMLElement>("[data-textarea-last-decision]"),
    latency: app.querySelector<HTMLElement>("[data-textarea-debug-latency]"),
    correctionCount: app.querySelector<HTMLElement>("[data-textarea-debug-correction-count]"),
    unresolvedCount: app.querySelector<HTMLElement>("[data-textarea-debug-unresolved-count]"),
    revertCount: app.querySelector<HTMLElement>("[data-textarea-debug-revert-count]"),
    protectedSkipCount: app.querySelector<HTMLElement>(
      "[data-textarea-debug-protected-skip-count]",
    ),
    markCount: app.querySelector<HTMLElement>("[data-textarea-debug-mark-count]"),
  };
  const textareaCompletionDebugEls = {
    status: app.querySelector<HTMLElement>("[data-textarea-completion-status]"),
    lastEvent: app.querySelector<HTMLElement>("[data-textarea-completion-last-event]"),
    requests: app.querySelector<HTMLElement>("[data-textarea-completion-requests]"),
    ghostShown: app.querySelector<HTMLElement>("[data-textarea-completion-ghost-shown]"),
    accepted: app.querySelector<HTMLElement>("[data-textarea-completion-accepted]"),
    dismissed: app.querySelector<HTMLElement>("[data-textarea-completion-dismissed]"),
    reverted: app.querySelector<HTMLElement>("[data-textarea-completion-reverted]"),
    p95Latency: app.querySelector<HTMLElement>("[data-textarea-completion-p95]"),
  };
  const chatDemoRoot = app.querySelector<HTMLElement>("[data-testid='chat-demo-root']");
  const chatForm = app.querySelector<HTMLFormElement>("[data-chat-form]");
  const chatInput = app.querySelector<HTMLTextAreaElement>("[data-chat-input]");
  const sentMessages = app.querySelector<HTMLElement>("[data-sent-messages]");
  const reactDemoMount = app.querySelector<HTMLElement>("[data-react-demo-mount]");
  const codeMirrorDemoMount = app.querySelector<HTMLElement>("[data-codemirror-demo-mount]");
  const codexMockDemoMount = app.querySelector<HTMLElement>("[data-codex-mock-demo-mount]");
  const remoteCompletionDemoMount = app.querySelector<HTMLElement>(
    "[data-remote-completion-demo-mount]",
  );

  setupDemoTabs(app);

  if (reactDemoMount) {
    mountReactDemo(reactDemoMount);
  }

  if (codeMirrorDemoMount) {
    mountCodeMirrorDemo(codeMirrorDemoMount);
  }

  if (codexMockDemoMount) {
    mountCodexMockDemo(codexMockDemoMount);
  }

  setupRemoteCompletionDemo(app, remoteCompletionDemoMount);

  if (
    editor &&
    resetButton &&
    clearStorageButton &&
    popoverElement &&
    storageModeSelect &&
    autocorrectToggle &&
    spellcheckToggle &&
    keepMarksToggle &&
    personalDictionaryToggle &&
    exportMemoryButton &&
    importMemoryInput &&
    resetMemoryButton
  ) {
    void startDemo(
      editor,
      resetButton,
      clearStorageButton,
      popoverElement,
      storageModeSelect,
      autocorrectToggle,
      spellcheckToggle,
      keepMarksToggle,
      personalDictionaryToggle,
      exportMemoryButton,
      importMemoryInput,
      resetMemoryButton,
      debugEls,
    );
  }

  if (
    textareaDemoRoot &&
    textareaEditor &&
    textareaForm &&
    textareaSubmitValue &&
    textareaResetButton &&
    textareaRevertCompletionButton &&
    textareaStorageModeSelect &&
    textareaAutocorrectToggle &&
    textareaSpellcheckToggle &&
    textareaExportMemoryButton &&
    textareaImportMemoryInput &&
    textareaResetMemoryButton &&
    textareaCompletionEnabledToggle &&
    textareaCompletionTextInput &&
    textareaCompletionResetMetricsButton
  ) {
    void startTextareaDemo({
      root: textareaDemoRoot,
      textarea: textareaEditor,
      form: textareaForm,
      submitValue: textareaSubmitValue,
      resetButton: textareaResetButton,
      revertCompletionButton: textareaRevertCompletionButton,
      storageModeSelect: textareaStorageModeSelect,
      autocorrectToggle: textareaAutocorrectToggle,
      spellcheckToggle: textareaSpellcheckToggle,
      exportMemoryButton: textareaExportMemoryButton,
      importMemoryInput: textareaImportMemoryInput,
      resetMemoryButton: textareaResetMemoryButton,
      completionEnabledToggle: textareaCompletionEnabledToggle,
      completionTextInput: textareaCompletionTextInput,
      completionResetMetricsButton: textareaCompletionResetMetricsButton,
      debugEls: textareaDebugEls,
      completionDebugEls: textareaCompletionDebugEls,
    });
  }

  if (chatDemoRoot && chatForm && chatInput && sentMessages) {
    void startChatDemo(chatDemoRoot, chatForm, chatInput, sentMessages);
  }
}

type TextareaDebugElements = {
  lastDecision: HTMLElement | null;
  latency: HTMLElement | null;
  correctionCount: HTMLElement | null;
  unresolvedCount: HTMLElement | null;
  revertCount: HTMLElement | null;
  protectedSkipCount: HTMLElement | null;
  markCount: HTMLElement | null;
};

type TextareaCompletionDebugElements = {
  status: HTMLElement | null;
  lastEvent: HTMLElement | null;
  requests: HTMLElement | null;
  ghostShown: HTMLElement | null;
  accepted: HTMLElement | null;
  dismissed: HTMLElement | null;
  reverted: HTMLElement | null;
  p95Latency: HTMLElement | null;
};

type TextareaDemoElements = {
  root: HTMLElement;
  textarea: HTMLTextAreaElement;
  form: HTMLFormElement;
  submitValue: HTMLElement;
  resetButton: HTMLButtonElement;
  revertCompletionButton: HTMLButtonElement;
  storageModeSelect: HTMLSelectElement;
  autocorrectToggle: HTMLInputElement;
  spellcheckToggle: HTMLInputElement;
  exportMemoryButton: HTMLButtonElement;
  importMemoryInput: HTMLInputElement;
  resetMemoryButton: HTMLButtonElement;
  completionEnabledToggle: HTMLInputElement;
  completionTextInput: HTMLInputElement;
  completionResetMetricsButton: HTMLButtonElement;
  debugEls: TextareaDebugElements;
  completionDebugEls: TextareaCompletionDebugElements;
};

type TextareaDemoMetrics = {
  correctionCount: number;
  unresolvedCount: number;
  protectedSkipCount: number;
  revertCount: number;
  lastLatency: number | null;
  latencySamples: number[];
  lastDecision: string;
  pendingStartedAt: number | null;
};

function setupDemoTabs(root: HTMLElement): void {
  const tabs = root.querySelectorAll<HTMLButtonElement>("[data-demo-tab]");
  const panels = root.querySelectorAll<HTMLElement>("[data-demo-panel]");

  const showTab = (tabName: string) => {
    for (const tab of tabs) {
      tab.dataset.active = tab.dataset.demoTab === tabName ? "true" : "false";
    }

    for (const panel of panels) {
      panel.hidden = panel.dataset.demoPanel !== tabName;
    }
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.demoTab;

      if (tabName) {
        showTab(tabName);
      }
    });
  }

  showTab("contenteditable");
}

function setupRemoteCompletionDemo(root: HTMLElement, mount: HTMLElement | null): void {
  if (mount === null) {
    return;
  }

  const tab = root.querySelector<HTMLButtonElement>("[data-demo-tab='remote-completion']");
  let mounted = false;
  let mounting: Promise<void> | null = null;

  const mountRemoteDemo = () => {
    if (mounted) {
      return;
    }

    mounting ??= import("./remoteCompletionDemo").then(({ mountRemoteCompletionDemo }) =>
      mountRemoteCompletionDemo(mount),
    );
    mounting
      .then(() => {
        mounted = true;
      })
      .catch((error: unknown) => {
        mounting = null;
        mount.textContent = error instanceof Error ? error.message : String(error);
      });
  };

  tab?.addEventListener("click", mountRemoteDemo);
}

async function startTextareaDemo(elements: TextareaDemoElements): Promise<void> {
  const metrics: TextareaDemoMetrics = {
    correctionCount: 0,
    unresolvedCount: 0,
    protectedSkipCount: 0,
    revertCount: 0,
    lastLatency: null,
    latencySamples: [],
    lastDecision: "Loading core...",
    pendingStartedAt: null,
  };
  const activeMarks = new Map<string, TextareaMark>();
  let storageMode = getInitialStorageMode();
  let storage = createDemoStorage(storageMode);
  let core = await createTypaiCore({ storage });
  let adapter: ReturnType<typeof attachTextarea> | null = null;
  let completionController: DemoTextareaCompletionController | null = null;
  let suppressMarkRemovedMetrics = false;
  let latestCompletionSnapshot: TextareaCompletionSnapshot | null = null;
  let lastCompletionTransactionId: string | null = null;
  let completionLatencyMs = 50;
  let ignoreAbortForCompletionProvider = false;
  let failNextCompletionRequest = false;

  const updateDebug = () => {
    setText(elements.debugEls.lastDecision, metrics.lastDecision);
    setText(elements.debugEls.latency, formatLatency(metrics.lastLatency));
    setText(elements.debugEls.correctionCount, String(metrics.correctionCount));
    setText(elements.debugEls.unresolvedCount, String(metrics.unresolvedCount));
    setText(elements.debugEls.revertCount, String(metrics.revertCount));
    setText(elements.debugEls.protectedSkipCount, String(metrics.protectedSkipCount));
    setText(elements.debugEls.markCount, String(activeMarks.size));
  };

  const updateCompletionDebug = () => {
    const snapshot = completionController?.getDemoMetrics() ?? null;

    setText(
      elements.completionDebugEls.status,
      elements.completionEnabledToggle.checked ? (snapshot?.status ?? "idle") : "disabled",
    );
    setText(elements.completionDebugEls.lastEvent, snapshot?.lastEvent ?? "-");
    setText(elements.completionDebugEls.requests, String(snapshot?.requestCount ?? 0));
    setText(elements.completionDebugEls.ghostShown, String(snapshot?.ghostShownCount ?? 0));
    setText(elements.completionDebugEls.accepted, String(snapshot?.acceptedCount ?? 0));
    setText(elements.completionDebugEls.dismissed, String(snapshot?.dismissedCount ?? 0));
    setText(elements.completionDebugEls.reverted, String(snapshot?.revertedCount ?? 0));
    setText(
      elements.completionDebugEls.p95Latency,
      formatLatency(snapshot?.p95GhostLatencyMs ?? null),
    );
    elements.revertCompletionButton.disabled = lastCompletionTransactionId === null;
  };

  const finishLatency = () => {
    if (metrics.pendingStartedAt === null) {
      return;
    }

    metrics.lastLatency = performance.now() - metrics.pendingStartedAt;
    metrics.latencySamples.push(metrics.lastLatency);
    metrics.pendingStartedAt = null;
  };

  const onDecision = (event: TextareaDecisionEvent) => {
    metrics.lastDecision = formatDecision(event.decision);

    if (event.decision.action === "do_nothing") {
      finishLatency();
    }

    updateDebug();
  };

  const onCorrection = (event: TextareaCorrectionEvent) => {
    metrics.correctionCount += 1;
    metrics.lastDecision = `corrected ${event.transaction.original} -> ${event.transaction.replacement}`;
    finishLatency();
    updateDebug();
  };

  const onMark = (event: TextareaMarkEvent) => {
    activeMarks.set(event.mark.id, event.mark);

    if (event.mark.kind === "red_spelling_issue") {
      metrics.unresolvedCount += 1;
      metrics.lastDecision = `marked ${event.mark.original ?? "token"}`;
    }

    finishLatency();
    updateDebug();
  };

  const onMarkRemoved = (event: TextareaMarkRemovedEvent) => {
    activeMarks.delete(event.mark.id);

    if (!suppressMarkRemovedMetrics && event.mark.kind === "blue_applied_correction") {
      metrics.revertCount += 1;
    }

    updateDebug();
  };

  const onProtectedSkip = (event: TextareaProtectedSkipEvent) => {
    metrics.protectedSkipCount += 1;
    metrics.lastDecision = `protected_skip ${event.token.text}`;
    finishLatency();
    updateDebug();
  };

  const attachAdapter = () => {
    adapter?.();
    lastCompletionTransactionId = null;
    completionController = elements.completionEnabledToggle.checked
      ? createTextareaMockCompletionController({
          surface: "textarea",
          mode: "prose",
          getCompletionText: () => elements.completionTextInput.value,
          getLatencyMs: () => completionLatencyMs,
          shouldIgnoreAbort: () => ignoreAbortForCompletionProvider,
          consumeProviderError: () => {
            const shouldFail = failNextCompletionRequest;

            failNextCompletionRequest = false;
            return shouldFail;
          },
          onUpdate: updateCompletionDebug,
        })
      : null;
    latestCompletionSnapshot = null;
    adapter = attachTextarea({
      textarea: elements.textarea,
      typai: core,
      settings: {
        autocorrect: elements.autocorrectToggle.checked,
        spellcheck: elements.spellcheckToggle.checked,
        keepCorrectionMarksVisible: true,
        usePersonalDictionary: true,
      },
      overlay: {
        enabled: true,
        className: "typai-textarea-demo-overlay",
      },
      completion: {
        onEditorInput(snapshot) {
          latestCompletionSnapshot = snapshot;
          completionController?.onEditorInput?.(snapshot);
        },
        onEditorSelectionChange(snapshot) {
          latestCompletionSnapshot = snapshot;
          completionController?.onEditorSelectionChange?.(snapshot);
        },
        onEditorBlur() {
          latestCompletionSnapshot = null;
          completionController?.onEditorBlur?.();
        },
        onEditorCompositionStart() {
          latestCompletionSnapshot = null;
          completionController?.onEditorCompositionStart?.();
        },
        onCorrectionTransaction() {
          latestCompletionSnapshot = {
            text: elements.textarea.value,
            version: (latestCompletionSnapshot?.version ?? 0) + 1,
            selection: {
              start: elements.textarea.selectionStart,
              end: elements.textarea.selectionEnd,
            },
            isComposingIME: false,
          };
          completionController?.onCorrectionTransaction?.();
        },
        onCompletionAccepted(event) {
          lastCompletionTransactionId = event.transaction.id;
          completionController?.onCompletionAccepted?.(event);
          updateCompletionDebug();
        },
        onCompletionDismissed(event) {
          completionController?.onCompletionDismissed?.(event);
          updateCompletionDebug();
        },
        onCompletionReverted(event) {
          if (lastCompletionTransactionId === event.transaction.id) {
            lastCompletionTransactionId = null;
          }
          completionController?.onCompletionReverted?.(event);
          updateCompletionDebug();
        },
        destroy() {
          completionController?.destroy?.();
          completionController = null;
          latestCompletionSnapshot = null;
        },
      },
      onDecision,
      onCorrection,
      onMark,
      onMarkRemoved,
      onProtectedSkip,
    });
    completionController?.setEditor(adapter);
    markTextareaOverlayForTests(elements.textarea);
    updateCompletionDebug();
  };

  const clearTextareaGhostFeasibility = () => {
    adapter?.clearTextareaGhostText("manual");
  };
  const getGhostFeasibilitySnapshot = (): TextareaGhostFeasibilitySnapshot | null => {
    if (adapter === null || !adapter.isTextareaGhostVisible()) {
      return null;
    }

    return getTextareaGhostFeasibilitySnapshot(elements.textarea, adapter);
  };

  const reinitializeCore = async () => {
    adapter?.();
    completionController = null;
    activeMarks.clear();
    core = await createTypaiCore({ storage });
    attachAdapter();
    metrics.lastDecision = "Ready.";
    updateDebug();
  };

  const resetTextarea = (message = "Ready.") => {
    clearTextareaGhostFeasibility();
    elements.textarea.value = "";
    elements.textarea.setSelectionRange(0, 0);
    activeMarks.clear();
    metrics.correctionCount = 0;
    metrics.unresolvedCount = 0;
    metrics.protectedSkipCount = 0;
    metrics.revertCount = 0;
    metrics.lastLatency = null;
    metrics.latencySamples = [];
    metrics.pendingStartedAt = null;
    metrics.lastDecision = message;
    lastCompletionTransactionId = null;
    completionController?.resetDemoMetrics();
    suppressMarkRemovedMetrics = true;
    dispatchTextareaInput(elements.textarea);
    suppressMarkRemovedMetrics = false;
    elements.textarea.focus();
    metrics.revertCount = 0;
    elements.submitValue.textContent = "-";
    updateDebug();
    updateCompletionDebug();
  };

  elements.storageModeSelect.value = storageMode;
  elements.textarea.addEventListener(
    "input",
    (event) => {
      if (isMeasuredInputEvent(event)) {
        metrics.pendingStartedAt = performance.now();
      }
    },
    { capture: true },
  );
  elements.autocorrectToggle.addEventListener("change", () => {
    adapter?.updateSettings({ autocorrect: elements.autocorrectToggle.checked });
    metrics.lastDecision = `textarea autocorrect=${elements.autocorrectToggle.checked}`;
    updateDebug();
  });
  elements.spellcheckToggle.addEventListener("change", () => {
    adapter?.updateSettings({ spellcheck: elements.spellcheckToggle.checked });
    metrics.lastDecision = `textarea spellcheck=${elements.spellcheckToggle.checked}`;
    updateDebug();
  });
  elements.completionEnabledToggle.addEventListener("change", () => {
    attachAdapter();
    metrics.lastDecision = elements.completionEnabledToggle.checked
      ? "Textarea mock completion enabled."
      : "Textarea mock completion disabled.";
    updateDebug();
    updateCompletionDebug();
  });
  elements.completionResetMetricsButton.addEventListener("click", () => {
    completionController?.resetDemoMetrics();
    updateCompletionDebug();
  });
  elements.revertCompletionButton.addEventListener("click", () => {
    const transaction =
      lastCompletionTransactionId === null
        ? undefined
        : adapter
            ?.getTextareaCompletionTransactions()
            .find((candidate) => candidate.id === lastCompletionTransactionId);

    if (adapter === null || transaction === undefined) {
      metrics.lastDecision = "No accepted completion to revert.";
      updateDebug();
      updateCompletionDebug();
      return;
    }

    const result = adapter.revertTextareaCompletion(transaction.id);

    metrics.lastDecision = result.applied
      ? "Textarea completion reverted."
      : `Textarea completion revert skipped: ${result.reason ?? "unknown"}.`;
    updateDebug();
    updateCompletionDebug();
  });
  elements.storageModeSelect.addEventListener("change", () => {
    storageMode = elements.storageModeSelect.value === "memory" ? "memory" : "indexeddb";
    storage = createDemoStorage(storageMode);
    resetTextarea(`Storage mode changed to ${storageModeLabel(storageMode)}.`);
    void reinitializeCore();
  });
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    elements.submitValue.textContent = elements.textarea.value;
    metrics.lastDecision = "Textarea form submitted.";
    updateDebug();
  });
  elements.form.addEventListener("reset", () => {
    suppressMarkRemovedMetrics = true;
    elements.textarea.ownerDocument.defaultView?.setTimeout(() => {
      activeMarks.clear();
      metrics.lastLatency = null;
      metrics.pendingStartedAt = null;
      metrics.lastDecision = "Textarea form reset.";
      elements.submitValue.textContent = "-";
      adapter?.resyncOverlay();
      suppressMarkRemovedMetrics = false;
      updateDebug();
    }, 0);
  });
  elements.resetButton.addEventListener("click", () => {
    resetTextarea();
  });
  elements.resetMemoryButton.addEventListener("click", () => {
    void (async () => {
      await core.resetTypaiMemory();
      metrics.lastDecision = "Textarea memory reset.";
      updateDebug();
    })();
  });
  elements.exportMemoryButton.addEventListener("click", () => {
    void (async () => {
      const memory = await core.exportTypaiMemory();
      const memoryExport = JSON.stringify(memory, null, 2);

      downloadMemoryExport(memoryExport);
      metrics.lastDecision = "Textarea memory exported.";
      updateDebug();
    })();
  });
  elements.importMemoryInput.addEventListener("change", () => {
    void (async () => {
      const file = elements.importMemoryInput.files?.[0];

      if (file === undefined) {
        return;
      }

      const data = JSON.parse(await file.text()) as TypaiMemoryExport;

      await core.importTypaiMemory(data);
      elements.importMemoryInput.value = "";
      metrics.lastDecision = "Textarea memory imported.";
      updateDebug();
    })();
  });

  attachAdapter();
  window.__typaiTextareaDebug = {
    getMetrics() {
      return {
        latencySamples: [...metrics.latencySamples],
      };
    },
    clearLatencies() {
      metrics.latencySamples = [];
      metrics.lastLatency = null;
      metrics.pendingStartedAt = null;
      updateDebug();
    },
  };
  window.__typaiTextareaGhostFeasibility = {
    render(text, offset = elements.textarea.selectionStart) {
      const snapshot = getTextareaCompletionSnapshotForDemo(
        elements.textarea,
        latestCompletionSnapshot,
        offset,
      );

      if (
        adapter?.renderTextareaGhostText(text, snapshot, {
          requestId: `textarea-demo-completion-${snapshot.version}-${offset}`,
          providerName: "demo-mock",
          model: "mock-textarea",
          latencyMs: 0,
        }) !== true
      ) {
        throw new Error("Textarea ghost renderer did not render.");
      }

      latestCompletionSnapshot = snapshot;

      return getTextareaGhostFeasibilitySnapshot(elements.textarea, adapter);
    },
    resync(offset = elements.textarea.selectionStart) {
      if (adapter === null || !adapter.isTextareaGhostVisible()) {
        throw new Error("Textarea ghost renderer has no visible ghost to resync.");
      }

      const text = adapter.getTextareaGhostText() ?? "";
      const snapshot = getTextareaCompletionSnapshotForDemo(
        elements.textarea,
        latestCompletionSnapshot,
        offset,
      );

      adapter.renderTextareaGhostText(text, snapshot);
      latestCompletionSnapshot = snapshot;

      return getTextareaGhostFeasibilitySnapshot(elements.textarea, adapter);
    },
    clear() {
      clearTextareaGhostFeasibility();
    },
    getSnapshot() {
      return getGhostFeasibilitySnapshot();
    },
    accept() {
      const result = adapter?.acceptTextareaCompletion();

      if (result === undefined) {
        throw new Error("Textarea adapter is not attached.");
      }

      updateCompletionDebug();
      return result;
    },
    revertLast() {
      const transaction = adapter?.getTextareaCompletionTransactions().at(-1);

      if (adapter === null || transaction === undefined) {
        return { applied: false, reason: "missing_transaction" };
      }

      const result = adapter.revertTextareaCompletion(transaction.id);

      updateCompletionDebug();
      return result;
    },
    getTransactions() {
      return adapter?.getTextareaCompletionTransactions() ?? [];
    },
  };
  window.__typaiTextareaGhostRenderer = window.__typaiTextareaGhostFeasibility;
  window.__typaiTextareaCompletionDebug = {
    getMetrics() {
      return (
        completionController?.getDemoMetrics() ?? {
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
        }
      );
    },
    setLatencyMs(value) {
      completionLatencyMs = value;
    },
    setIgnoreAbortForProvider(value) {
      ignoreAbortForCompletionProvider = value;
    },
    failNextRequest() {
      failNextCompletionRequest = true;
    },
  };
  metrics.lastDecision = "Ready.";
  updateDebug();
  updateCompletionDebug();
}

async function startChatDemo(
  root: HTMLElement,
  form: HTMLFormElement,
  input: HTMLTextAreaElement,
  sentMessages: HTMLElement,
): Promise<void> {
  const core = await createTypaiCore({ storage: createMemoryStorage() });

  const adapter = attachTextarea({
    textarea: input,
    typai: core,
    settings: {
      autocorrect: true,
      spellcheck: true,
      keepCorrectionMarksVisible: true,
      usePersonalDictionary: true,
    },
    overlay: {
      enabled: true,
      className: "typai-textarea-demo-overlay",
    },
  });

  const resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    adapter.resyncOverlay();
  };

  const sendMessage = () => {
    const message = input.value.trimEnd();

    if (message.trim().length === 0) {
      return;
    }

    const item = root.ownerDocument.createElement("div");

    item.className = "sent-message";
    item.dataset.testid = "sent-message";
    item.textContent = message;
    sentMessages.appendChild(item);
    input.value = "";
    input.setSelectionRange(0, 0);
    dispatchTextareaInput(input);
    resizeInput();
    input.focus();
  };

  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    sendMessage();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  resizeInput();
}

function dispatchTextareaInput(textarea: HTMLTextAreaElement): void {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function markTextareaOverlayForTests(textarea: HTMLTextAreaElement): void {
  const overlay = textarea.parentElement?.querySelector<HTMLElement>(
    "[data-typai-textarea-overlay='mirror']",
  );

  if (overlay !== undefined && overlay !== null) {
    overlay.dataset.testid = "textarea-overlay";
  }
}

function getTextareaGhostFeasibilitySnapshot(
  textarea: HTMLTextAreaElement,
  adapter: ReturnType<typeof attachTextarea>,
): TextareaGhostFeasibilitySnapshot {
  const ghost = textarea.parentElement?.querySelector<HTMLElement>(
    "[data-typai-textarea-ghost='true']",
  );

  if (ghost === undefined || ghost === null) {
    throw new Error("Textarea ghost element is not visible.");
  }

  const offset = Number.parseInt(ghost.dataset.typaiTextareaGhostOffset ?? "", 10);
  const safeOffset = Number.isFinite(offset) ? offset : textarea.selectionStart;
  const ghostRect = rectSnapshot(ghost.getBoundingClientRect());
  const overlay = textarea.parentElement?.querySelector<HTMLElement>(
    "[data-testid='textarea-overlay']",
  );
  const caretRect =
    overlay === undefined || overlay === null
      ? null
      : rectSnapshot(measureCaretInOverlayMirror(textarea, overlay, safeOffset));

  return {
    textareaValue: textarea.value,
    ghostText: adapter.getTextareaGhostText() ?? "",
    offset: safeOffset,
    ghostRect,
    caretRect,
    deltaLeft: caretRect === null ? null : ghostRect.left - caretRect.left,
    deltaTop: caretRect === null ? null : ghostRect.top - caretRect.top,
  };
}

function getTextareaCompletionSnapshotForDemo(
  textarea: HTMLTextAreaElement,
  latestSnapshot: TextareaCompletionSnapshot | null,
  offset: number,
): TextareaCompletionSnapshot {
  return {
    text: textarea.value,
    version: latestSnapshot?.text === textarea.value ? latestSnapshot.version : 0,
    selection: {
      start: offset,
      end: offset,
    },
    isComposingIME: false,
  };
}

function rectSnapshot(rect: DOMRect | RectSnapshot): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

async function startDemo(
  editor: HTMLElement,
  resetButton: HTMLButtonElement,
  clearStorageButton: HTMLButtonElement,
  popoverElement: HTMLElement,
  storageModeSelect: HTMLSelectElement,
  autocorrectToggle: HTMLInputElement,
  spellcheckToggle: HTMLInputElement,
  keepMarksToggle: HTMLInputElement,
  personalDictionaryToggle: HTMLInputElement,
  exportMemoryButton: HTMLButtonElement,
  importMemoryInput: HTMLInputElement,
  resetMemoryButton: HTMLButtonElement,
  debugEls: Record<string, HTMLElement | null>,
) {
  const metrics: MetricState = {
    correctionCount: 0,
    unresolvedCount: 0,
    protectedSkipCount: 0,
    revertCount: 0,
    personalDictionaryCount: 0,
    correctionRulesCount: 0,
    latencies: [],
    latencySamples: [],
    lastLatency: null,
    lastDecision: "Loading core...",
    lastUserAction: "-",
    pendingStartedAt: null,
  };
  const debugEvents: DebugEvent[] = [];
  const marks: DemoMark[] = [];
  const corrections = new Map<string, CorrectionTransaction>();
  let lastMemoryExport: string | null = null;
  let currentPopover: TypaiPopover | null = null;
  let settings: TypaiSettings = {
    autocorrect: true,
    spellcheck: true,
    keepCorrectionMarksVisible: true,
    usePersonalDictionary: true,
  };
  let storageMode = getInitialStorageMode();
  let storage = createDemoStorage(storageMode);
  let core = await createTypaiCore({ storage });
  let adapter: ReturnType<typeof attachContenteditable> | null = null;

  const updateDebug = () => {
    setText(debugEls.storageModeLabel, storageModeLabel(storageMode));
    setText(debugEls.lastUserAction, metrics.lastUserAction);
    setText(debugEls.lastDecision, metrics.lastDecision);
    setText(debugEls.lastLatency, formatLatency(metrics.lastLatency));
    setText(debugEls.p95Latency, formatLatency(getP95(metrics.latencies)));
    setText(debugEls.personalDictionaryCount, String(metrics.personalDictionaryCount));
    setText(debugEls.correctionRulesCount, String(metrics.correctionRulesCount));
    setText(debugEls.correctionCount, String(metrics.correctionCount));
    setText(debugEls.unresolvedCount, String(metrics.unresolvedCount));
    setText(debugEls.revertCount, String(metrics.revertCount));
    setText(debugEls.protectedSkipCount, String(metrics.protectedSkipCount));
    renderDebugTable(debugEls.debugTableBody, debugEvents);
  };

  const logDebugEvent = (event: Omit<DebugEvent, "time">) => {
    debugEvents.unshift({
      time: new Date().toLocaleTimeString(),
      ...event,
    });

    if (debugEvents.length > 20) {
      debugEvents.pop();
    }

    updateDebug();
  };

  const announce = (message: string) => {
    setText(debugEls.liveRegion, message);
  };

  const renderEditor = (caretOffset = getPlainTextCaretOffset(editor)) => {
    const text = readEditorText(editor);
    const nextMarks = pruneStaleMarks(text, marks);
    marks.splice(0, marks.length, ...nextMarks);
    editor.innerHTML = renderMarkedText(text, marks);
    setPlainTextCaretOffset(editor, caretOffset ?? text.length);
  };

  const finishLatency = () => {
    if (metrics.pendingStartedAt === null) {
      return;
    }

    const elapsed = performance.now() - metrics.pendingStartedAt;
    metrics.pendingStartedAt = null;
    metrics.lastLatency = elapsed;
    metrics.latencies.push(elapsed);
    metrics.latencySamples.push(elapsed);

    if (metrics.latencies.length > 40) {
      metrics.latencies.shift();
    }
  };

  const refreshMemoryCounts = async () => {
    const [personalDictionaryEntries, correctionRuleEntries] = await Promise.all([
      storage.list("personalDictionary"),
      storage.list("correctionRules"),
    ]);

    metrics.personalDictionaryCount = personalDictionaryEntries.length;
    metrics.correctionRulesCount = correctionRuleEntries.length;
    updateDebug();
  };

  const measuredCore = (): TypaiCore => ({
    checkCompletedToken(input) {
      return core.checkCompletedToken(input);
    },
    suggestToken(input) {
      return core.suggestToken(input);
    },
    getLoadedDictionaryWordCount() {
      return core.getLoadedDictionaryWordCount();
    },
    clearLoadedDictionary() {
      return core.clearLoadedDictionary();
    },
    addToPersonalDictionary(word) {
      return core.addToPersonalDictionary(word);
    },
    removeFromPersonalDictionary(word) {
      return core.removeFromPersonalDictionary(word);
    },
    isInPersonalDictionary(word) {
      return core.isInPersonalDictionary(word);
    },
    setAlwaysCorrect(original, replacement) {
      return core.setAlwaysCorrect(original, replacement);
    },
    setNeverCorrect(original, replacement) {
      return core.setNeverCorrect(original, replacement);
    },
    clearCorrectionRule(original, replacement) {
      return core.clearCorrectionRule(original, replacement);
    },
    getCorrectionRule(original, replacement) {
      return core.getCorrectionRule(original, replacement);
    },
    exportTypaiMemory() {
      return core.exportTypaiMemory();
    },
    importTypaiMemory(data, options) {
      return core.importTypaiMemory(data, options);
    },
    resetTypaiMemory(options) {
      return core.resetTypaiMemory(options);
    },
  });

  const attachAdapter = () => {
    adapter?.();
    adapter = attachContenteditable({
      element: editor,
      typai: measuredCore(),
      settings,
      onDecision(decision) {
        metrics.lastDecision = formatDecision(decision);

        if (decision.action === "do_nothing") {
          finishLatency();
          updateDebug();
        }
      },
      onCorrection(transaction) {
        corrections.set(transaction.id, transaction);
        metrics.correctionCount += 1;
        announce(`Corrected ${transaction.original} to ${transaction.replacement}.`);
        logDebugEvent({
          actionType: "correction",
          original: transaction.original,
          replacement: transaction.replacement,
          result: transaction.trigger,
          reasonCodes: transaction.reasonCodes,
        });
        updateDebug();
      },
      onMark(mark) {
        const text = readEditorText(editor);
        const markedText = text.slice(mark.range.start, mark.range.end);

        if (markedText.length > 0) {
          marks.push({ ...mark, text: markedText });
        }

        if (mark.kind === "red_spelling_issue") {
          metrics.unresolvedCount += 1;
          announce(`Spelling issue marked: ${mark.original ?? markedText}.`);
          logDebugEvent({
            actionType: "unresolved_mark",
            original: mark.original ?? markedText,
            replacement: mark.suggestions?.[0] ?? "",
            result: "red_mark",
            reasonCodes: mark.reasonCodes ?? [],
          });
        }

        renderEditor();
        finishLatency();
        updateDebug();
      },
      onMarkRemoved(mark) {
        const index = marks.findIndex((candidate) => candidate.id === mark.id);

        if (index >= 0) {
          marks.splice(index, 1);
        }

        renderEditor();
      },
      onPopover(popover) {
        currentPopover = popover;
        renderPopover(popoverElement, popover, editor);
      },
      onProtectedSkip(token) {
        metrics.protectedSkipCount += 1;
        metrics.lastDecision = `protected_skip ${token.text}`;
        logDebugEvent({
          actionType: "protected_skip",
          original: token.text,
          replacement: "",
          result: token.tokenType,
          reasonCodes: [],
        });
        finishLatency();
        updateDebug();
      },
      onSettingsChange(nextSettings) {
        settings = nextSettings;
        syncSettingsToggles(
          settings,
          autocorrectToggle,
          spellcheckToggle,
          keepMarksToggle,
          personalDictionaryToggle,
        );
        metrics.lastDecision = formatSettings(settings);
        updateDebug();
      },
      onTextChange(change) {
        renderEditor(change.caretOffset);
      },
      onUserAction(action) {
        handleUserAction(action, metrics);
        announce(liveMessageFromUserAction(action));
        logDebugEvent(debugEventFromUserAction(action));
        void refreshMemoryCounts();
      },
    });
  };

  const reinitializeCore = async () => {
    core = await createTypaiCore({ storage });
    attachAdapter();
    await refreshMemoryCounts();
  };

  editor.addEventListener(
    "input",
    (event) => {
      if (isMeasuredInputEvent(event)) {
        metrics.pendingStartedAt = performance.now();
      }
    },
    { capture: true },
  );

  const resetEditor = (message = "Reset. Ready.") => {
    marks.splice(0, marks.length);
    corrections.clear();
    metrics.correctionCount = 0;
    metrics.unresolvedCount = 0;
    metrics.protectedSkipCount = 0;
    metrics.revertCount = 0;
    metrics.latencies = [];
    metrics.latencySamples = [];
    debugEvents.splice(0, debugEvents.length);
    metrics.lastLatency = null;
    metrics.lastDecision = message;
    metrics.pendingStartedAt = null;
    currentPopover = null;
    editor.textContent = "";
    renderPopover(popoverElement, null, editor);
    renderEditor(0);
    editor.focus();
    updateDebug();
  };

  storageModeSelect.value = storageMode;
  syncSettingsToggles(
    settings,
    autocorrectToggle,
    spellcheckToggle,
    keepMarksToggle,
    personalDictionaryToggle,
  );
  attachAdapter();
  await refreshMemoryCounts();

  editor.addEventListener("input", () => {
    const text = readEditorText(editor);
    const nextMarks = pruneStaleMarks(text, marks);

    if (nextMarks.length !== marks.length) {
      marks.splice(0, marks.length, ...nextMarks);
      renderEditor();
    }
  });

  popoverElement.addEventListener("click", (event) => {
    void handlePopoverClick(event, currentPopover, editor);
  });

  autocorrectToggle.addEventListener("change", () => {
    adapter?.updateSettings({ autocorrect: autocorrectToggle.checked });
  });

  spellcheckToggle.addEventListener("change", () => {
    adapter?.updateSettings({ spellcheck: spellcheckToggle.checked });
  });

  keepMarksToggle.addEventListener("change", () => {
    adapter?.updateSettings({ keepCorrectionMarksVisible: keepMarksToggle.checked });
  });

  personalDictionaryToggle.addEventListener("change", () => {
    adapter?.updateSettings({ usePersonalDictionary: personalDictionaryToggle.checked });
  });

  storageModeSelect.addEventListener("change", () => {
    const nextMode = storageModeSelect.value === "memory" ? "memory" : "indexeddb";
    storageMode = nextMode;
    storage = createDemoStorage(storageMode);
    metrics.lastUserAction = `storage_mode ${storageModeLabel(storageMode)}`;
    resetEditor("Storage mode changed. Ready.");
    void reinitializeCore();
  });

  clearStorageButton.addEventListener("click", () => {
    void (async () => {
      await clearUserStorage(storage);
      metrics.lastUserAction = "clear_storage";
      resetEditor("Storage cleared. Ready.");
      await reinitializeCore();
    })();
  });

  exportMemoryButton.addEventListener("click", () => {
    void (async () => {
      const memory = await core.exportTypaiMemory();
      lastMemoryExport = JSON.stringify(memory, null, 2);
      metrics.lastUserAction = "export_memory";
      metrics.lastDecision = "Memory exported.";
      announce("typai memory exported.");
      downloadMemoryExport(lastMemoryExport);
      logDebugEvent({
        actionType: "export_memory",
        original: "",
        replacement: "",
        result: `${memory.personalDictionary.length} dictionary, ${memory.correctionRules.length} rules`,
        reasonCodes: [],
      });
      updateDebug();
    })();
  });

  importMemoryInput.addEventListener("change", () => {
    void (async () => {
      const file = importMemoryInput.files?.[0];

      if (file === undefined) {
        return;
      }

      try {
        const text = await file.text();
        await importMemoryText(text);
        importMemoryInput.value = "";
      } catch (error) {
        metrics.lastUserAction = "import_memory_failed";
        metrics.lastDecision =
          error instanceof Error ? `Import failed: ${error.message}` : "Import failed.";
        logDebugEvent({
          actionType: "import_memory",
          original: "",
          replacement: "",
          result: "failed",
          reasonCodes: [],
        });
        updateDebug();
      }
    })();
  });

  resetMemoryButton.addEventListener("click", () => {
    void (async () => {
      await core.resetTypaiMemory();
      metrics.lastUserAction = "reset_memory";
      resetEditor("Memory reset. Ready.");
      announce("typai memory reset.");
      await refreshMemoryCounts();
      logDebugEvent({
        actionType: "reset_memory",
        original: "",
        replacement: "",
        result: "cleared",
        reasonCodes: [],
      });
    })();
  });

  resetButton.addEventListener("click", () => {
    resetEditor();
  });

  const importMemoryText = async (text: string) => {
    const data = JSON.parse(text) as TypaiMemoryExport;

    await core.importTypaiMemory(data);
    metrics.lastUserAction = "import_memory";
    metrics.lastDecision = "Memory imported.";
    announce("typai memory imported.");
    await refreshMemoryCounts();
    logDebugEvent({
      actionType: "import_memory",
      original: "",
      replacement: "",
      result: "applied",
      reasonCodes: [],
    });
    updateDebug();
  };

  window.__typaiDebug = {
    getMetrics() {
      return {
        correctionCount: metrics.correctionCount,
        unresolvedCount: metrics.unresolvedCount,
        protectedSkipCount: metrics.protectedSkipCount,
        revertCount: metrics.revertCount,
        personalDictionaryCount: metrics.personalDictionaryCount,
        correctionRulesCount: metrics.correctionRulesCount,
        latencies: [...metrics.latencies],
        latencySamples: [...metrics.latencySamples],
        lastLatency: metrics.lastLatency,
        lastDecision: metrics.lastDecision,
        lastUserAction: metrics.lastUserAction,
      };
    },
    getDebugEvents() {
      return debugEvents.map((event) => ({ ...event, reasonCodes: [...event.reasonCodes] }));
    },
    clearLatencies() {
      metrics.latencies = [];
      metrics.latencySamples = [];
      metrics.lastLatency = null;
      metrics.pendingStartedAt = null;
      updateDebug();
    },
    getLastMemoryExport() {
      return lastMemoryExport;
    },
    importMemoryText,
  };

  metrics.lastDecision = "Ready.";
  updateDebug();
}

function readEditorText(editor: HTMLElement): string {
  return editor.textContent ?? "";
}

function createDemoStorage(mode: StorageMode): TypaiStorage {
  if (mode === "memory") {
    return createMemoryStorage();
  }

  return createIndexedDbStorage({
    dbName: getDemoDbName(),
  });
}

async function clearUserStorage(storage: TypaiStorage): Promise<void> {
  await Promise.all([storage.clear("personalDictionary"), storage.clear("correctionRules")]);
}

function getInitialStorageMode(): StorageMode {
  const params = new URLSearchParams(window.location.search);

  return params.get("storage") === "memory" ? "memory" : "indexeddb";
}

function getDemoDbName(): string {
  const params = new URLSearchParams(window.location.search);

  return params.get("typaiDbName") ?? "typai-simple-demo-editor";
}

function storageModeLabel(mode: StorageMode): string {
  return mode === "memory" ? "memory" : "IndexedDB";
}

function renderPopover(
  element: HTMLElement,
  popover: TypaiPopover | null,
  editor: HTMLElement,
): void {
  updateMarkTriggerExpandedState(editor, popover?.mark.id ?? null);

  if (popover === null) {
    element.hidden = true;
    element.removeAttribute("aria-labelledby");
    element.removeAttribute("aria-describedby");
    element.replaceChildren();
    return;
  }

  element.hidden = false;
  const titleId = `${popover.id}-title`;
  const descriptionId = `${popover.id}-description`;

  element.setAttribute("aria-labelledby", titleId);
  element.setAttribute("aria-describedby", descriptionId);

  if (popover.kind === "blue_correction") {
    element.innerHTML = `
      <div data-testid="blue-popover">
        <p id="${escapeAttribute(titleId)}" class="popover-title">${escapeHtml(popover.label)}</p>
        <p id="${escapeAttribute(
          descriptionId,
        )}" class="popover-description">Choose how typai should handle this correction.</p>
        <div class="popover-actions">
          <button type="button" data-popover-action="revert" data-testid="revert-action">Revert</button>
          <button type="button" data-popover-action="always" data-testid="always-correct-action">Always correct</button>
          <button type="button" data-popover-action="never" data-testid="never-correct-action">Don't correct again</button>
          <button type="button" data-popover-action="add-original" data-testid="add-dictionary-action">Add original to dictionary</button>
        </div>
      </div>
    `;
    focusFirstPopoverAction(element);
    return;
  }

  const suggestions = popover.suggestions
    .map(
      (suggestion) =>
        `<button type="button" data-popover-action="suggestion" data-suggestion="${escapeAttribute(
          suggestion,
        )}" data-testid="suggestion-item">${escapeHtml(suggestion)}</button>`,
    )
    .join("");

  element.innerHTML = `
    <div data-testid="red-popover">
      <p id="${escapeAttribute(titleId)}" class="popover-title">${escapeHtml(popover.label)}</p>
      <p id="${escapeAttribute(
        descriptionId,
      )}" class="popover-description">Choose a suggestion or dismiss this spelling mark.</p>
      <div class="suggestion-list">${suggestions || "<span>No suggestions</span>"}</div>
      <div class="popover-actions">
        <button type="button" data-popover-action="ignore" data-testid="ignore-once-action">Ignore once</button>
        <button type="button" data-popover-action="add-dictionary" data-testid="add-dictionary-action">Add to dictionary</button>
        <button type="button" data-popover-action="disable-autocorrect" data-testid="disable-autocorrect-action">Disable autocorrect</button>
      </div>
    </div>
  `;
  focusFirstPopoverAction(element);
}

function updateMarkTriggerExpandedState(editor: HTMLElement, activeMarkId: string | null): void {
  const marks = editor.querySelectorAll<HTMLElement>("[data-typai-mark-id]");

  for (const mark of marks) {
    mark.setAttribute(
      "aria-expanded",
      activeMarkId !== null && mark.dataset.typaiMarkId === activeMarkId ? "true" : "false",
    );
  }
}

function focusFirstPopoverAction(element: HTMLElement): void {
  queueMicrotask(() => {
    const firstAction = element.querySelector<HTMLElement>("button");

    firstAction?.focus();
  });
}

function focusAfterPopoverAction(editor: HTMLElement, result: PopoverActionResult | null): void {
  if (result?.applied !== true) {
    return;
  }

  queueMicrotask(() => {
    editor.focus();
  });
}

function renderDebugTable(element: HTMLElement | null, events: DebugEvent[]): void {
  if (element === null) {
    return;
  }

  if (events.length === 0) {
    element.innerHTML = `
      <tr>
        <td colspan="6">No local events yet.</td>
      </tr>
    `;
    return;
  }

  element.innerHTML = events
    .map(
      (event) => `
        <tr data-testid="debug-row">
          <td>${escapeHtml(event.time)}</td>
          <td>${escapeHtml(event.actionType)}</td>
          <td>${escapeHtml(event.original)}</td>
          <td>${escapeHtml(event.replacement)}</td>
          <td>${escapeHtml(event.result)}</td>
          <td>${escapeHtml(event.reasonCodes.join(", "))}</td>
        </tr>
      `,
    )
    .join("");
}

async function handlePopoverClick(
  event: Event,
  popover: TypaiPopover | null,
  editor: HTMLElement,
): Promise<void> {
  if (popover === null || !(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest<HTMLButtonElement>("[data-popover-action]");

  if (button === null) {
    return;
  }

  event.preventDefault();

  const action = button.dataset.popoverAction;
  let result: PopoverActionResult | null = null;

  if (popover.kind === "blue_correction") {
    if (action === "revert") {
      result = await popover.actions.revert();
    } else if (action === "always") {
      result = await popover.actions.alwaysCorrect();
    } else if (action === "never") {
      result = await popover.actions.neverCorrect();
    } else if (action === "add-original") {
      result = await popover.actions.addOriginalToDictionary();
    }
    focusAfterPopoverAction(editor, result);
    return;
  }

  if (action === "suggestion") {
    const suggestion = button.dataset.suggestion;

    if (suggestion) {
      result = await popover.actions.applySuggestion(suggestion);
    }
  } else if (action === "ignore") {
    result = await popover.actions.ignoreOnce();
  } else if (action === "add-dictionary") {
    result = await popover.actions.addToDictionary();
  } else if (action === "disable-autocorrect") {
    result = await popover.actions.disableAutocorrect();
  }

  focusAfterPopoverAction(editor, result);
}

function debugEventFromUserAction(action: TypaiUserAction): Omit<DebugEvent, "time"> {
  if (action.type === "revert_correction") {
    return {
      actionType: "revert_correction",
      original: action.original,
      replacement: action.replacement,
      result: "applied",
      reasonCodes: [],
    };
  }

  if (action.type === "always_correct") {
    return {
      actionType: "always_correct",
      original: action.original,
      replacement: action.replacement,
      result: "saved",
      reasonCodes: [],
    };
  }

  if (action.type === "never_correct") {
    return {
      actionType: "never_correct",
      original: action.original,
      replacement: action.replacement,
      result: "saved",
      reasonCodes: [],
    };
  }

  if (action.type === "add_to_dictionary") {
    return {
      actionType: "add_to_dictionary",
      original: action.word,
      replacement: "",
      result: "saved",
      reasonCodes: [],
    };
  }

  if (action.type === "apply_suggestion") {
    return {
      actionType: "apply_suggestion",
      original: action.original,
      replacement: action.replacement,
      result: "applied",
      reasonCodes: [],
    };
  }

  if (action.type === "ignore_once") {
    return {
      actionType: "ignore_once",
      original: action.original,
      replacement: "",
      result: "removed",
      reasonCodes: [],
    };
  }

  return {
    actionType: "disable_autocorrect",
    original: "",
    replacement: "",
    result: "session",
    reasonCodes: [],
  };
}

function liveMessageFromUserAction(action: TypaiUserAction): string {
  if (action.type === "revert_correction") {
    return `Reverted correction to ${action.original}.`;
  }

  if (action.type === "always_correct") {
    return `Always correct rule saved for ${action.original}.`;
  }

  if (action.type === "never_correct") {
    return `typai will not correct ${action.original} to ${action.replacement} again.`;
  }

  if (action.type === "add_to_dictionary") {
    return `Added ${action.word} to the personal dictionary.`;
  }

  if (action.type === "apply_suggestion") {
    return `Applied suggestion ${action.replacement}.`;
  }

  if (action.type === "ignore_once") {
    return `Ignored spelling issue ${action.original}.`;
  }

  return "Autocorrect disabled.";
}

function handleUserAction(action: TypaiUserAction, metrics: MetricState): void {
  if (action.type === "revert_correction") {
    metrics.revertCount += 1;
    metrics.lastDecision = `reverted ${action.replacement} -> ${action.original}`;
    return;
  }

  if (action.type === "always_correct") {
    metrics.lastDecision = `always_correct ${action.original} -> ${action.replacement}`;
    return;
  }

  if (action.type === "never_correct") {
    metrics.lastDecision = `never_correct ${action.original} -> ${action.replacement}`;
    return;
  }

  if (action.type === "add_to_dictionary") {
    metrics.lastDecision = `dictionary_add ${action.word}`;
    return;
  }

  if (action.type === "apply_suggestion") {
    metrics.lastDecision = `suggestion_applied ${action.original} -> ${action.replacement}`;
    return;
  }

  if (action.type === "ignore_once") {
    metrics.lastDecision = `ignored ${action.original}`;
    return;
  }

  metrics.lastDecision = "autocorrect disabled";
}

function downloadMemoryExport(text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = `typai-memory-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function syncSettingsToggles(
  settings: TypaiSettings,
  autocorrectToggle: HTMLInputElement,
  spellcheckToggle: HTMLInputElement,
  keepMarksToggle: HTMLInputElement,
  personalDictionaryToggle: HTMLInputElement,
): void {
  autocorrectToggle.checked = settings.autocorrect;
  spellcheckToggle.checked = settings.spellcheck;
  keepMarksToggle.checked = settings.keepCorrectionMarksVisible;
  personalDictionaryToggle.checked = settings.usePersonalDictionary;
}

function formatSettings(settings: TypaiSettings): string {
  return `settings autocorrect=${settings.autocorrect} spellcheck=${settings.spellcheck}`;
}

function setText(element: HTMLElement | null, value: string): void {
  if (element) {
    element.textContent = value;
  }
}

function formatDecision(decision: CorrectionDecision): string {
  const reasons = decision.reasonCodes.length > 0 ? ` [${decision.reasonCodes.join(", ")}]` : "";

  if (decision.action === "auto_correct") {
    return `auto_correct ${decision.original} -> ${decision.replacement}${reasons}`;
  }

  if (decision.action === "mark_unresolved") {
    return `mark_unresolved ${decision.original}${reasons}`;
  }

  return `do_nothing ${decision.reasonCodes.join(", ") || "none"}`;
}

function formatLatency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(2)} ms`;
}

function getP95(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * 0.95) - 1;

  return sorted[Math.max(0, index)] ?? null;
}

function isMeasuredInputEvent(event: Event): boolean {
  const data = (event as { data?: unknown }).data;

  return data === " " || data === "\n" || data === "\t";
}

function getPlainTextCaretOffset(element: HTMLElement): number | null {
  const selection = element.ownerDocument.getSelection();

  if (selection === null || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!element.contains(range.endContainer)) {
    return null;
  }

  const prefixRange = range.cloneRange();
  prefixRange.selectNodeContents(element);
  prefixRange.setEnd(range.endContainer, range.endOffset);

  return prefixRange.toString().length;
}

function setPlainTextCaretOffset(element: HTMLElement, offset: number): void {
  element.focus();

  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const selection = element.ownerDocument.getSelection();

  if (selection === null) {
    return;
  }

  let remaining = Math.max(0, offset);
  let current = walker.nextNode();

  while (current) {
    const length = current.textContent?.length ?? 0;

    if (remaining <= length) {
      const range = element.ownerDocument.createRange();
      range.setStart(current, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    remaining -= length;
    current = walker.nextNode();
  }

  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
