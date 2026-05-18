import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension, type Text } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import {
  applyFirstTypaiCodeMirrorRedSuggestion,
  type CodeMirrorTypaiMark,
  clearTypaiCodeMirrorCompletionTransactionsEffect,
  clearTypaiCodeMirrorMarks,
  closeTypaiCodeMirrorPopover,
  createTypaiCodeMirrorExtension,
  getTypaiCodeMirrorViewCompletionTransactions,
  getTypaiCodeMirrorViewMarks,
  openFirstTypaiCodeMirrorBluePopover,
  openFirstTypaiCodeMirrorRedPopover,
  revertFirstTypaiCodeMirrorCorrection,
  revertLastTypaiCodeMirrorCompletion,
  setTypaiCodeMirrorRuntimeSettingsEffect,
  type TypaiCodeMirrorCorrectionEvent,
  type TypaiCodeMirrorDecisionEvent,
} from "@typai/codemirror";
import {
  type CorrectionDecision,
  createMemoryStorage,
  createTypaiCore,
  getTokenBeforeOffset,
  isDelimiter,
  isProtectedTokenText,
  type TypaiCore,
} from "@typai/core";
import {
  COMPLETION_DEMO_DEBOUNCE_MS,
  COMPLETION_DEMO_MIN_PREFIX_CHARS,
  createCodeMirrorMockCompletionController,
  type DemoCodeMirrorCompletionController,
  formatCompletionLatency,
} from "./completionDemoControllers";

type CodeMirrorDemoMode = "plain" | "markdown";

type CodeMirrorDemoMetrics = {
  lastDecision: string;
  correctionCount: number;
  unresolvedCount: number;
  revertCount: number;
  protectedSkipCount: number;
  lastLatency: number | null;
  latencySamples: number[];
};

type CodeMirrorDemoDebug = {
  getText(): string;
  reset(): void;
  setText(text: string): void;
  getMarks(): CodeMirrorTypaiMark[];
  getMetrics(): CodeMirrorDemoMetrics;
  clearLatencies(): void;
  getCompletionMetrics(): ReturnType<DemoCodeMirrorCompletionController["getDemoMetrics"]>;
  openFirstRedPopover(): boolean;
  openFirstBluePopover(): boolean;
  applyFirstRedSuggestion(suggestion?: string): boolean;
  revertFirstBlueCorrection(): boolean;
  revertLastCompletion(): boolean;
};

type CodeMirrorDemoConfig = {
  kind: "codemirror" | "codex-mock";
  initialDoc: string;
  initialMode: CodeMirrorDemoMode;
  exposeDebugName: "__typaiCodeMirrorDemo" | "__typaiCodexMockDemo";
};

declare global {
  interface Window {
    __typaiCodeMirrorDemo?: CodeMirrorDemoDebug;
    __typaiCodexMockDemo?: CodeMirrorDemoDebug;
  }
}

const commandNames = new Set([
  "bash",
  "bun",
  "cargo",
  "cat",
  "cd",
  "chmod",
  "cmd",
  "cp",
  "curl",
  "deno",
  "docker",
  "git",
  "grep",
  "kubectl",
  "node",
  "npm",
  "npx",
  "pnpm",
  "powershell",
  "pwsh",
  "python",
  "python3",
  "rg",
  "sh",
  "uv",
  "yarn",
]);
const maxLatencySamples = 120;

export function mountCodeMirrorDemo(mount: HTMLElement): void {
  void mountCodeMirrorSurface(mount, {
    kind: "codemirror",
    initialDoc: [
      "Draft a release note for this mocked completion demo.",
      "",
      "`pnpm test` should remain protected inline code.",
      "",
      "```bash",
      "pnpm test",
      "rg CVE-2024-1234 /etc/passwd",
      "```",
      "",
      "Ordinary prose after the fence can show completion again.",
    ].join("\n"),
    initialMode: "markdown",
    exposeDebugName: "__typaiCodeMirrorDemo",
  });
}

export function mountCodexMockDemo(mount: HTMLElement): void {
  void mountCodeMirrorSurface(mount, {
    kind: "codex-mock",
    initialDoc: [
      "Please review teh migration plan and keep ordinary prose readable.",
      "",
      "```bash",
      "pnpm test",
      "rg CVE-2024-1234 /etc/passwd",
      "```",
      "",
      "Use @typai/codemirror in Markdown mode, but do not change code or paths.",
    ].join("\n"),
    initialMode: "markdown",
    exposeDebugName: "__typaiCodexMockDemo",
  });
}

async function mountCodeMirrorSurface(
  mount: HTMLElement,
  config: CodeMirrorDemoConfig,
): Promise<void> {
  mount.innerHTML =
    config.kind === "codex-mock" ? renderCodexMockMarkup() : renderCodeMirrorDemoMarkup();

  const status = mount.querySelector<HTMLElement>("[data-codemirror-status]");

  setText(status, "loading");

  try {
    const typai = await createTypaiCore({ storage: createMemoryStorage() });

    startCodeMirrorSurface(mount, typai, config);
  } catch (error) {
    setText(status, "error");
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-last-decision]"),
      error instanceof Error ? error.message : "CodeMirror demo failed to initialize.",
    );
  }
}

function renderCodeMirrorDemoMarkup(): string {
  return `
    <div class="codemirror-demo-content">
      <div class="demo-panel-header">
        <div>
          <h2>CodeMirror Completion Demo</h2>
          <p>CodeMirror-native ghost decorations with mocked completion. Document changes happen only through CodeMirror transactions.</p>
        </div>
        <div class="intro-actions">
          <button class="reset-button" type="button" data-codemirror-reset data-testid="codemirror-reset">Reset CodeMirror</button>
          <button class="reset-button" type="button" data-codemirror-revert-completion data-testid="codemirror-revert-completion" disabled>Revert Completion</button>
        </div>
      </div>

      <div class="codemirror-demo-layout">
        <section class="codemirror-workspace" aria-label="CodeMirror editor workspace">
          <div class="codemirror-toolbar" aria-label="CodeMirror mode and review controls">
            <div class="codemirror-mode-toggle" role="group" aria-label="Editor mode">
              <button class="reset-button" type="button" data-codemirror-mode="plain" data-testid="codemirror-mode-plain">Plain text</button>
              <button class="reset-button" type="button" data-codemirror-mode="markdown" data-testid="codemirror-mode-markdown">Markdown</button>
            </div>
            <div class="codemirror-review-actions">
              <button class="reset-button" type="button" data-codemirror-open-red data-testid="codemirror-open-red">Review red</button>
              <button class="reset-button" type="button" data-codemirror-apply-suggestion data-testid="codemirror-apply-suggestion">Apply first suggestion</button>
              <button class="reset-button" type="button" data-codemirror-open-blue data-testid="codemirror-open-blue">Review blue</button>
              <button class="reset-button" type="button" data-codemirror-revert-blue data-testid="codemirror-revert-blue">Revert blue</button>
            </div>
          </div>
          <div class="codemirror-editor-shell">
            <div class="codemirror-editor-host" data-codemirror-editor data-testid="codemirror-editor"></div>
          </div>
          <ul class="demo-notes">
            <li>Type at least <code>${COMPLETION_DEMO_MIN_PREFIX_CHARS}</code> prose characters, pause, then look for gray ghost text.</li>
            <li>Press Tab to accept the visible completion. Press Escape or continue typing to dismiss it.</li>
            <li>Use Revert Completion to remove the exact text inserted by the last accepted completion.</li>
            <li><code>teh </code> becomes <code>the </code> with a blue CodeMirror mark.</li>
            <li><code>reciept </code> stays unchanged and opens a red suggestion popover with <code>receipt</code>.</li>
            <li><code>form </code> and <code>user@example.com </code> remain unchanged.</li>
            <li>Markdown mode suppresses completion and correction in inline code and fenced code blocks, while ordinary prose can still show completion.</li>
          </ul>
        </section>

        <aside class="textarea-side-panel" aria-label="CodeMirror controls and debug">
          <section class="settings-panel compact-panel" aria-label="CodeMirror settings">
            <h2>Controls</h2>
            <label>
              <input type="checkbox" data-codemirror-autocorrect data-testid="codemirror-autocorrect-toggle" checked />
              Autocorrect
            </label>
            <label>
              <input type="checkbox" data-codemirror-spellcheck data-testid="codemirror-spellcheck-toggle" checked />
              Spellcheck marks
            </label>
            <label>
              <input type="checkbox" data-codemirror-personal-dictionary data-testid="codemirror-personal-dictionary-toggle" checked />
              Use personal dictionary
            </label>
          </section>
          <section class="settings-panel compact-panel" aria-label="CodeMirror completion controls">
            <h2>Completion Controls</h2>
            <label>
              Mock completion
              <input
                type="text"
                data-codemirror-completion-text
                data-testid="codemirror-completion-text"
                value=" with mocked CodeMirror completion."
              />
            </label>
            <div class="remote-setting-row">
              <span>Debounce</span>
              <output>${COMPLETION_DEMO_DEBOUNCE_MS} ms</output>
            </div>
            <button class="reset-button" type="button" data-codemirror-completion-reset-metrics data-testid="codemirror-completion-reset-metrics">Reset completion metrics</button>
          </section>
          ${renderCompletionStatusMarkup("CodeMirror completion status")}
          ${renderCompletionMetricsMarkup("CodeMirror completion metrics")}
          ${renderDebugPanelMarkup("CodeMirror debug")}
        </aside>
      </div>
    </div>
  `;
}

function renderCodexMockMarkup(): string {
  return `
    <div class="codemirror-demo-content codex-mock-content">
      <div class="demo-panel-header">
        <div>
          <p class="codex-mock-label" data-testid="codex-mock-label">Codex mock only</p>
          <h2>Codex-Style Mock Prompt Editor</h2>
          <p>No real Codex integration. No remote completion in this demo. The surface is a local CodeMirror Markdown prompt composer.</p>
        </div>
        <button class="reset-button" type="button" data-codemirror-reset data-testid="codex-mock-reset">Reset Mock Prompt</button>
      </div>

      <div class="codemirror-demo-layout">
        <section class="codemirror-workspace" aria-label="Codex mock prompt workspace">
          <div class="codemirror-editor-shell codex-mock-editor-shell">
            <div class="codemirror-editor-host" data-codemirror-editor data-testid="codex-mock-editor"></div>
          </div>
          <div class="codex-mock-actions">
            <button class="reset-button" type="button" data-codex-mock-run data-testid="codex-mock-run">Run mock prompt</button>
            <output class="codex-mock-output" data-codex-mock-output data-testid="codex-mock-output" aria-live="polite">Mock output stays local.</output>
          </div>
          <ul class="demo-notes">
            <li>Ordinary prose can receive typai correction.</li>
            <li>Shell commands such as <code>pnpm test</code> and <code>rg CVE-2024-1234 /etc/passwd</code> are protected.</li>
            <li>Code fences, file paths, CVEs, package names, and tool names remain prompt text only.</li>
            <li>No real Codex APIs are called.</li>
          </ul>
        </section>

        <aside class="textarea-side-panel" aria-label="Codex mock debug">
          <section class="settings-panel compact-panel" aria-label="Codex mock settings">
            <h2>Controls</h2>
            <label>
              <input type="checkbox" data-codemirror-autocorrect data-testid="codex-mock-autocorrect-toggle" checked />
              Autocorrect
            </label>
            <label>
              <input type="checkbox" data-codemirror-spellcheck data-testid="codex-mock-spellcheck-toggle" checked />
              Spellcheck marks
            </label>
            <label>
              <input type="checkbox" data-codemirror-personal-dictionary data-testid="codex-mock-personal-dictionary-toggle" checked />
              Use personal dictionary
            </label>
          </section>
          ${renderDebugPanelMarkup("Codex mock debug")}
        </aside>
      </div>
    </div>
  `;
}

function renderDebugPanelMarkup(label: string): string {
  return `
    <section class="debug-panel compact-panel" aria-label="${escapeAttribute(label)}">
      <h2>Debug</h2>
      <dl>
        <div>
          <dt>Core status</dt>
          <dd data-codemirror-status data-testid="codemirror-core-status">loading</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd data-codemirror-debug-mode data-testid="codemirror-debug-mode">-</dd>
        </div>
        <div>
          <dt>Last decision</dt>
          <dd data-codemirror-last-decision data-testid="codemirror-last-decision">Loading core...</dd>
        </div>
        <div>
          <dt>Last latency</dt>
          <dd data-codemirror-debug-latency data-testid="codemirror-debug-latency">-</dd>
        </div>
        <div>
          <dt>Recent p95 latency</dt>
          <dd data-codemirror-debug-p95 data-testid="codemirror-debug-p95">-</dd>
        </div>
        <div>
          <dt>Corrections</dt>
          <dd data-codemirror-debug-correction-count data-testid="codemirror-debug-correction-count">0</dd>
        </div>
        <div>
          <dt>Unresolved marks</dt>
          <dd data-codemirror-debug-unresolved-count data-testid="codemirror-debug-unresolved-count">0</dd>
        </div>
        <div>
          <dt>Reverts</dt>
          <dd data-codemirror-debug-revert-count data-testid="codemirror-debug-revert-count">0</dd>
        </div>
        <div>
          <dt>Protected skips</dt>
          <dd data-codemirror-debug-protected-skip-count data-testid="codemirror-debug-protected-skip-count">0</dd>
        </div>
      </dl>
    </section>
  `;
}

function renderCompletionStatusMarkup(label: string): string {
  return `
    <section class="debug-panel compact-panel" aria-label="${escapeAttribute(label)}">
      <h2>Completion Status</h2>
      <dl>
        <div>
          <dt>Status</dt>
          <dd data-codemirror-completion-status data-testid="codemirror-completion-status">idle</dd>
        </div>
        <div>
          <dt>Last event</dt>
          <dd data-codemirror-completion-last-event data-testid="codemirror-completion-last-event">-</dd>
        </div>
      </dl>
    </section>
  `;
}

function renderCompletionMetricsMarkup(label: string): string {
  return `
    <section class="debug-panel compact-panel" aria-label="${escapeAttribute(label)}">
      <h2>Completion Metrics</h2>
      <dl>
        <div>
          <dt>Requests</dt>
          <dd data-codemirror-completion-requests data-testid="codemirror-completion-requests">0</dd>
        </div>
        <div>
          <dt>Ghost shown</dt>
          <dd data-codemirror-completion-ghost-shown data-testid="codemirror-completion-ghost-shown">0</dd>
        </div>
        <div>
          <dt>Accepted</dt>
          <dd data-codemirror-completion-accepted data-testid="codemirror-completion-accepted">0</dd>
        </div>
        <div>
          <dt>Dismissed</dt>
          <dd data-codemirror-completion-dismissed data-testid="codemirror-completion-dismissed">0</dd>
        </div>
        <div>
          <dt>Reverted</dt>
          <dd data-codemirror-completion-reverted data-testid="codemirror-completion-reverted">0</dd>
        </div>
        <div>
          <dt>p95 ghost latency</dt>
          <dd data-codemirror-completion-p95 data-testid="codemirror-completion-p95">-</dd>
        </div>
      </dl>
    </section>
  `;
}

function startCodeMirrorSurface(
  mount: HTMLElement,
  typai: TypaiCore,
  config: CodeMirrorDemoConfig,
): void {
  const editorHost = getRequiredElement(mount, "[data-codemirror-editor]");
  const languageCompartment = new Compartment();
  let mode = config.initialMode;
  const settings = {
    autocorrect: true,
    spellcheck: true,
    usePersonalDictionary: true,
  };
  const metrics: CodeMirrorDemoMetrics = {
    lastDecision: "Ready.",
    correctionCount: 0,
    unresolvedCount: 0,
    revertCount: 0,
    protectedSkipCount: 0,
    lastLatency: null,
    latencySamples: [],
  };
  let pendingStartedAt: number | null = null;
  let view: EditorView;
  let lastCompletionTransactionId: string | null = null;
  const completionTextInput = mount.querySelector<HTMLInputElement>(
    "[data-codemirror-completion-text]",
  );
  const revertCompletionButton = mount.querySelector<HTMLButtonElement>(
    "[data-codemirror-revert-completion]",
  );
  let completionController: DemoCodeMirrorCompletionController | null = null;

  const updateCompletionDebug = () => {
    const snapshot = completionController?.getDemoMetrics() ?? null;

    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-status]"),
      snapshot?.status ?? "idle",
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-last-event]"),
      snapshot?.lastEvent ?? "-",
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-requests]"),
      String(snapshot?.requestCount ?? 0),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-ghost-shown]"),
      String(snapshot?.ghostShownCount ?? 0),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-accepted]"),
      String(snapshot?.acceptedCount ?? 0),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-dismissed]"),
      String(snapshot?.dismissedCount ?? 0),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-reverted]"),
      String(snapshot?.revertedCount ?? 0),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-completion-p95]"),
      formatCompletionLatency(snapshot?.p95GhostLatencyMs ?? null),
    );

    if (revertCompletionButton !== null) {
      revertCompletionButton.disabled = lastCompletionTransactionId === null;
    }
  };

  completionController =
    config.kind === "codemirror"
      ? createCodeMirrorMockCompletionController({
          surface: "codemirror",
          mode,
          getCompletionText: () =>
            completionTextInput?.value.trim() === ""
              ? " with mocked CodeMirror completion."
              : (completionTextInput?.value ?? " with mocked CodeMirror completion."),
          onUpdate: updateCompletionDebug,
        })
      : null;

  const updateDebug = () => {
    const marks = getTypaiCodeMirrorViewMarks(view);

    metrics.unresolvedCount = marks.filter((mark) => mark.kind === "red_spelling_issue").length;
    setText(mount.querySelector<HTMLElement>("[data-codemirror-status]"), "ready");
    setText(mount.querySelector<HTMLElement>("[data-codemirror-debug-mode]"), mode);
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-last-decision]"),
      metrics.lastDecision,
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-debug-latency]"),
      formatLatency(metrics.lastLatency),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-debug-p95]"),
      formatLatency(getP95(metrics.latencySamples)),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-debug-correction-count]"),
      String(metrics.correctionCount),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-debug-unresolved-count]"),
      String(metrics.unresolvedCount),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-debug-revert-count]"),
      String(metrics.revertCount),
    );
    setText(
      mount.querySelector<HTMLElement>("[data-codemirror-debug-protected-skip-count]"),
      String(metrics.protectedSkipCount),
    );

    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-codemirror-mode]")) {
      button.dataset.active = button.dataset.codemirrorMode === mode ? "true" : "false";
    }
  };

  const finishLatency = () => {
    if (pendingStartedAt === null) {
      return;
    }

    const elapsed = performance.now() - pendingStartedAt;

    metrics.lastLatency = elapsed;
    metrics.latencySamples.push(elapsed);
    metrics.latencySamples = metrics.latencySamples.slice(-maxLatencySamples);
    pendingStartedAt = null;
  };

  const onDecision = (event: TypaiCodeMirrorDecisionEvent) => {
    finishLatency();
    metrics.lastDecision = formatDecision(event.decision);
    updateDebug();
  };

  const onCorrection = (event: TypaiCodeMirrorCorrectionEvent) => {
    finishLatency();
    if (event.applied) {
      metrics.correctionCount += 1;
    }
    metrics.lastDecision = event.applied
      ? `auto_correct ${event.decision.original} -> ${event.decision.replacement}`
      : `auto_correct skipped ${event.reason}`;
    updateDebug();
  };

  const onMark = (mark: CodeMirrorTypaiMark) => {
    finishLatency();
    if (mark.kind === "red_spelling_issue") {
      metrics.lastDecision = `mark_unresolved ${mark.original ?? "word"}`;
    }
    updateDebug();
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return;
    }

    if (update.transactions.some((transaction) => transaction.isUserEvent("input.typai.revert"))) {
      metrics.revertCount += 1;
      metrics.lastDecision = "reverted correction";
      updateDebug();
      return;
    }

    if (
      update.transactions.some((transaction) => transaction.isUserEvent("input.typai.suggestion"))
    ) {
      metrics.correctionCount += 1;
      metrics.lastDecision = "suggestion applied";
      updateDebug();
      return;
    }

    if (
      update.transactions.some((transaction) =>
        transaction.isUserEvent("input.typai.completion.accept"),
      )
    ) {
      lastCompletionTransactionId =
        getTypaiCodeMirrorViewCompletionTransactions(view).at(-1)?.id ?? null;
      metrics.lastDecision = "completion accepted";
      updateDebug();
      updateCompletionDebug();
      return;
    }

    if (
      update.transactions.some((transaction) =>
        transaction.isUserEvent("input.typai.completion.revert"),
      )
    ) {
      lastCompletionTransactionId = null;
      metrics.lastDecision = "completion reverted";
      updateDebug();
      updateCompletionDebug();
      return;
    }

    if (update.transactions.some((transaction) => transaction.isUserEvent("input.typai.correct"))) {
      updateDebug();
      return;
    }

    if (isDelimiterBeforeCursor(update.state)) {
      pendingStartedAt = performance.now();
      if (recordProtectedSkip(update)) {
        finishLatency();
        metrics.lastDecision = "protected_skip";
      }
    }

    updateDebug();
  });

  view = new EditorView({
    parent: editorHost,
    state: EditorState.create({
      doc: config.initialDoc,
      extensions: [
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label":
            config.kind === "codex-mock"
              ? "Codex mock prompt editor"
              : "CodeMirror typing demo editor",
        }),
        languageCompartment.of(languageExtensionForMode(mode)),
        updateListener,
        createTypaiCodeMirrorExtension({
          typai,
          completion: completionController ?? undefined,
          completionMode: mode,
          autocorrect: settings.autocorrect,
          spellcheck: settings.spellcheck,
          onDecision,
          onCorrection,
          onMark,
        }),
      ],
    }),
  });

  const resetDoc = (doc = "") => {
    closeTypaiCodeMirrorPopover(view);
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: doc,
      },
      selection: { anchor: 0 },
      effects: clearTypaiCodeMirrorCompletionTransactionsEffect.of(),
      userEvent: "input.typai.demo-reset",
    });
    clearTypaiCodeMirrorMarks(view);
    pendingStartedAt = null;
    metrics.lastDecision = "Reset. Ready.";
    metrics.correctionCount = 0;
    metrics.unresolvedCount = 0;
    metrics.revertCount = 0;
    metrics.protectedSkipCount = 0;
    metrics.lastLatency = null;
    metrics.latencySamples = [];
    lastCompletionTransactionId = null;
    completionController?.resetDemoMetrics();
    updateDebug();
    updateCompletionDebug();
    view.focus();
  };

  const setMode = (nextMode: CodeMirrorDemoMode) => {
    mode = nextMode;
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtensionForMode(mode)),
    });
    metrics.lastDecision = `${mode} mode ready`;
    updateDebug();
  };

  const setRuntimeSettings = () => {
    view.dispatch({
      effects: setTypaiCodeMirrorRuntimeSettingsEffect.of({
        autocorrect: settings.autocorrect,
        spellcheck: settings.spellcheck,
      }),
    });
    metrics.lastDecision = `settings autocorrect=${settings.autocorrect} spellcheck=${settings.spellcheck}`;
    updateDebug();
  };

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-reset]")
    ?.addEventListener("click", () => {
      resetDoc(config.initialDoc);
    });

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-revert-completion]")
    ?.addEventListener("click", () => {
      if (lastCompletionTransactionId === null) {
        metrics.lastDecision = "No accepted completion to revert.";
        updateDebug();
        updateCompletionDebug();
        return;
      }

      if (revertLastTypaiCodeMirrorCompletion(view)) {
        lastCompletionTransactionId = null;
        metrics.lastDecision = "completion reverted";
      } else {
        metrics.lastDecision = "completion revert skipped";
      }

      updateDebug();
      updateCompletionDebug();
    });

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-completion-reset-metrics]")
    ?.addEventListener("click", () => {
      completionController?.resetDemoMetrics();
      updateCompletionDebug();
    });

  for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-codemirror-mode]")) {
    button.addEventListener("click", () => {
      setMode(button.dataset.codemirrorMode === "markdown" ? "markdown" : "plain");
    });
  }

  mount
    .querySelector<HTMLInputElement>("[data-codemirror-autocorrect]")
    ?.addEventListener("change", (event) => {
      settings.autocorrect = (event.currentTarget as HTMLInputElement).checked;
      setRuntimeSettings();
    });

  mount
    .querySelector<HTMLInputElement>("[data-codemirror-spellcheck]")
    ?.addEventListener("change", (event) => {
      settings.spellcheck = (event.currentTarget as HTMLInputElement).checked;
      setRuntimeSettings();
    });

  mount
    .querySelector<HTMLInputElement>("[data-codemirror-personal-dictionary]")
    ?.addEventListener("change", async (event) => {
      settings.usePersonalDictionary = (event.currentTarget as HTMLInputElement).checked;
      if (!settings.usePersonalDictionary) {
        await typai.resetTypaiMemory({ personalDictionary: true });
      }
      metrics.lastDecision = settings.usePersonalDictionary
        ? "personal dictionary enabled"
        : "personal dictionary cleared for demo";
      updateDebug();
    });

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-open-red]")
    ?.addEventListener("click", () => {
      openFirstTypaiCodeMirrorRedPopover(view);
    });

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-apply-suggestion]")
    ?.addEventListener("click", () => {
      if (applyFirstTypaiCodeMirrorRedSuggestion(view)) {
        metrics.lastDecision = "suggestion applied";
        updateDebug();
      }
    });

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-open-blue]")
    ?.addEventListener("click", () => {
      openFirstTypaiCodeMirrorBluePopover(view);
    });

  mount
    .querySelector<HTMLButtonElement>("[data-codemirror-revert-blue]")
    ?.addEventListener("click", () => {
      if (revertFirstTypaiCodeMirrorCorrection(view)) {
        metrics.lastDecision = "reverted correction";
        updateDebug();
      }
    });

  mount.querySelector<HTMLButtonElement>("[data-codex-mock-run]")?.addEventListener("click", () => {
    const output = mount.querySelector<HTMLElement>("[data-codex-mock-output]");
    const wordCount = view.state.doc.toString().trim().split(/\s+/).filter(Boolean).length;

    setText(
      output,
      `Mock run only. ${wordCount} prompt tokens inspected locally. No Codex APIs called.`,
    );
  });

  window[config.exposeDebugName] = {
    getText() {
      return view.state.doc.toString();
    },
    reset() {
      resetDoc("");
    },
    setText(text: string) {
      resetDoc(text);
    },
    getMarks() {
      return getTypaiCodeMirrorViewMarks(view);
    },
    getMetrics() {
      return {
        ...metrics,
        latencySamples: [...metrics.latencySamples],
      };
    },
    clearLatencies() {
      metrics.latencySamples = [];
      metrics.lastLatency = null;
      updateDebug();
    },
    getCompletionMetrics() {
      return (
        completionController?.getDemoMetrics() ?? {
          status: "idle",
          requestCount: 0,
          ghostShownCount: 0,
          acceptedCount: 0,
          dismissedCount: 0,
          revertedCount: 0,
          p95GhostLatencyMs: null,
          lastEvent: "-",
        }
      );
    },
    openFirstRedPopover() {
      return openFirstTypaiCodeMirrorRedPopover(view);
    },
    openFirstBluePopover() {
      return openFirstTypaiCodeMirrorBluePopover(view);
    },
    applyFirstRedSuggestion(suggestion?: string) {
      return applyFirstTypaiCodeMirrorRedSuggestion(view, suggestion);
    },
    revertFirstBlueCorrection() {
      return revertFirstTypaiCodeMirrorCorrection(view);
    },
    revertLastCompletion() {
      return revertLastTypaiCodeMirrorCompletion(view);
    },
  };

  updateDebug();
  updateCompletionDebug();
}

function recordProtectedSkip(update: ViewUpdate): boolean {
  const selection = update.state.selection.main;

  if (!selection.empty) {
    return false;
  }

  const token = getCompletedTokenBeforeCursor(update.state, selection.head);

  if (
    token === null ||
    !isDemoProtectedToken(update.state.doc, token.start, token.end, token.text)
  ) {
    return false;
  }

  return true;
}

function getCompletedTokenBeforeCursor(
  state: EditorState,
  offset: number,
): { text: string; start: number; end: number } | null {
  const line = state.doc.lineAt(offset);
  const token = getTokenBeforeOffset(line.text, offset - line.from);

  if (token === null) {
    return null;
  }

  return {
    text: token.text,
    start: line.from + token.range.start,
    end: line.from + token.range.end,
  };
}

function isDemoProtectedToken(doc: Text, from: number, to: number, text: string): boolean {
  if (isProtectedTokenText(text)) {
    return true;
  }

  const line = doc.lineAt(from);
  const startInLine = from - line.from;
  const endInLine = to - line.from;

  return (
    isInsideFencedCodeBlock(doc, line.number) ||
    isInsideInlineCode(line.text, startInLine, endInLine) ||
    isInsideMarkdownLinkDestination(line.text, startInLine) ||
    isUrlSchemePrefix(line.text, startInLine, endInLine) ||
    isCommandLookingLine(line.text)
  );
}

function isDelimiterBeforeCursor(state: EditorState): boolean {
  const head = state.selection.main.head;

  return head > 0 && isDelimiter(state.doc.sliceString(head - 1, head));
}

function isInsideFencedCodeBlock(doc: Text, lineNumber: number): boolean {
  let fenceOpen = false;

  for (let currentLineNumber = 1; currentLineNumber <= lineNumber; currentLineNumber += 1) {
    const lineText = doc.line(currentLineNumber).text.trimStart();

    if (!lineText.startsWith("```") && !lineText.startsWith("~~~")) {
      continue;
    }

    if (currentLineNumber === lineNumber) {
      return true;
    }

    fenceOpen = !fenceOpen;
  }

  return fenceOpen;
}

function isInsideInlineCode(lineText: string, start: number, end: number): boolean {
  return (
    hasOddUnescapedBackticks(lineText.slice(0, start)) &&
    hasOddUnescapedBackticks(lineText.slice(end))
  );
}

function hasOddUnescapedBackticks(text: string): boolean {
  let count = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "`" && text[index - 1] !== "\\") {
      count += 1;
    }
  }

  return count % 2 === 1;
}

function isInsideMarkdownLinkDestination(lineText: string, start: number): boolean {
  const before = lineText.slice(0, start);
  const destinationStart = before.lastIndexOf("](");

  if (destinationStart === -1) {
    return false;
  }

  return before.lastIndexOf(")") < destinationStart;
}

function isUrlSchemePrefix(lineText: string, start: number, end: number): boolean {
  const token = lineText.slice(start, end).toLowerCase();

  return /^(?:https?|ftp)$/.test(token) && lineText[end] === ":";
}

function isCommandLookingLine(lineText: string): boolean {
  const trimmedLine = lineText.trimStart();
  const match = /^([A-Za-z][A-Za-z0-9_.-]*)(?:\s|$)/.exec(trimmedLine);

  if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
    return false;
  }

  if (/^(?:[$>]|PS\s+[^>]+>)\s+\S+/.test(trimmedLine)) {
    return true;
  }

  return match !== null && trimmedLine.includes(" ") && commandNames.has(match[1].toLowerCase());
}

function languageExtensionForMode(mode: CodeMirrorDemoMode): Extension {
  return mode === "markdown" ? markdown() : [];
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

function getRequiredElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);

  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function setText(element: HTMLElement | null, value: string): void {
  if (element !== null) {
    element.textContent = value;
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
