// @vitest-environment jsdom

import type { TypaiCore } from "@typai/core";
import { act, createRef, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as TypaiReact from "../src/index";
import {
  TypaiProvider,
  type TypaiTextareaHookOptions,
  useTypaiContenteditable,
  useTypaiCore,
  useTypaiTextarea,
} from "../src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots.splice(0, mountedRoots.length)) {
    act(() => root.unmount());
  }

  document.body.replaceChildren();
});

describe("@typai/react scaffold", () => {
  it("exports the initial React API", () => {
    expect(typeof TypaiReact.TypaiProvider).toBe("function");
    expect(typeof TypaiReact.useTypaiCore).toBe("function");
    expect(typeof TypaiReact.useTypaiTextarea).toBe("function");
    expect(typeof TypaiReact.useTypaiContenteditable).toBe("function");
    expect(typeof TypaiReact.TypaiTextarea).toBe("object");
    expect(typeof TypaiReact.TypaiContenteditable).toBe("object");
    expect(typeof TypaiReact.TypaiSettingsPanel).toBe("function");
    expect(typeof TypaiReact.TypaiDebugTable).toBe("function");
  });

  it("does not export remote completion or ghost text APIs", () => {
    expect(Object.keys(TypaiReact)).not.toContain("completionRemote");
    expect(Object.keys(TypaiReact)).not.toContain("useRemoteCompletion");
    expect(Object.keys(TypaiReact)).not.toContain("TypaiGhostText");
  });

  it("TypaiProvider renders children", () => {
    const { container } = render(
      <TypaiProvider>
        <span data-testid="child">child</span>
      </TypaiProvider>,
    );

    expect(container.querySelector("[data-testid='child']")?.textContent).toBe("child");
  });

  it("useTypaiCore returns the provider context value", () => {
    const core = createFakeCore();

    function Probe(): ReactElement {
      const context = useTypaiCore();

      return (
        <output
          data-core={context.typai === core ? "provided" : "missing"}
          data-status={context.status}
        />
      );
    }

    const { container } = render(
      <TypaiProvider core={core}>
        <Probe />
      </TypaiProvider>,
    );
    const output = container.querySelector("output");

    expect(output?.getAttribute("data-core")).toBe("provided");
    expect(output?.getAttribute("data-status")).toBe("ready");
  });

  it("TypaiProvider reuses a stable createCore promise across rerenders", async () => {
    const core = createFakeCore();
    const createCore = vi.fn(async () => core);

    function Probe(): ReactElement {
      const context = useTypaiCore();

      return <output data-ready={String(context.typai === core)} />;
    }

    const view = render(
      <TypaiProvider createCore={createCore}>
        <Probe />
      </TypaiProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    view.rerender(
      <TypaiProvider createCore={createCore}>
        <Probe />
      </TypaiProvider>,
    );

    expect(createCore).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector("output")?.getAttribute("data-ready")).toBe("true");
  });

  it("components render without adapter attachment requirements", () => {
    const { container } = render(
      <TypaiProvider>
        <TypaiReact.TypaiTextarea aria-label="Prompt" />
        <TypaiReact.TypaiContenteditable aria-label="Editor" />
      </TypaiProvider>,
    );

    expect(container.querySelector("textarea")?.dataset.typaiReactTextarea).toBe("true");
    expect(container.querySelector("[data-typai-react-contenteditable]")).not.toBeNull();
  });

  it("components avoid DOM access during SSR-like render", () => {
    expect(() =>
      renderToString(
        <TypaiProvider>
          <TypaiReact.TypaiTextarea aria-label="Prompt" />
          <TypaiReact.TypaiContenteditable aria-label="Editor" />
        </TypaiProvider>,
      ),
    ).not.toThrow();
  });
});

describe("@typai/react hooks", () => {
  it("useTypaiTextarea attaches to a textarea when core is provided", async () => {
    const core = createFakeCore();

    const view = render(<TextareaProbe typai={core} />);
    await flushEffects();

    const output = view.container.querySelector("output");

    expect(output?.getAttribute("data-status")).toBe("attached");
    expect(output?.getAttribute("data-attach-count")).toBe("1");
  });

  it("useTypaiTextarea cleanup detaches on unmount", async () => {
    const core = createAutoCorrectCore();
    const onCorrection = vi.fn();
    const view = render(<TextareaProbe typai={core} onCorrection={onCorrection} />);
    await flushEffects();
    const textarea = view.container.querySelector("textarea");

    view.unmount();

    typeIntoTextarea(textarea, "teh ");

    expect(textarea?.value).toBe("teh ");
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it("useTypaiTextarea does not reattach on stable rerenders", async () => {
    const core = createFakeCore();
    const onCorrection = vi.fn();
    const view = render(<TextareaProbe typai={core} label="one" onCorrection={onCorrection} />);
    await flushEffects();

    view.rerender(<TextareaProbe typai={core} label="two" onCorrection={onCorrection} />);
    await flushEffects();

    const output = view.container.querySelector("output");

    expect(output?.getAttribute("data-label")).toBe("two");
    expect(output?.getAttribute("data-attach-count")).toBe("1");
  });

  it("useTypaiTextarea forwards callbacks through the adapter", async () => {
    const core = createAutoCorrectCore();
    const onDecision = vi.fn();
    const onCorrection = vi.fn();
    const onMark = vi.fn();
    const view = render(
      <TextareaProbe
        typai={core}
        onDecision={onDecision}
        onCorrection={onCorrection}
        onMark={onMark}
      />,
    );
    await flushEffects();
    const textarea = view.container.querySelector("textarea");

    typeIntoTextarea(textarea, "teh ");

    expect(textarea?.value).toBe("the ");
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onCorrection).toHaveBeenCalledTimes(1);
    expect(onMark).toHaveBeenCalledTimes(1);
  });

  it("useTypaiContenteditable attaches to a contenteditable element", async () => {
    const core = createFakeCore();
    const view = render(<ContenteditableProbe typai={core} />);
    await flushEffects();
    const output = view.container.querySelector("output");

    expect(output?.getAttribute("data-status")).toBe("attached");
    expect(output?.getAttribute("data-attach-count")).toBe("1");
  });

  it("hooks use TypaiProvider context when direct typai is not passed", async () => {
    const core = createFakeCore();
    const view = render(
      <TypaiProvider typai={core}>
        <TextareaProbe />
      </TypaiProvider>,
    );
    await flushEffects();
    const output = view.container.querySelector("output");

    expect(output?.getAttribute("data-status")).toBe("attached");
  });

  it("hooks report waiting state when core is not ready", async () => {
    const view = render(<TextareaProbe />);
    await flushEffects();
    const output = view.container.querySelector("output");

    expect(output?.getAttribute("data-status")).toBe("waiting_for_core");
  });
});

describe("@typai/react components", () => {
  it("TypaiTextarea renders a native textarea with direct and textareaProps props", async () => {
    const core = createFakeCore();
    const view = render(
      <TypaiReact.TypaiTextarea
        typai={core}
        textareaProps={{ placeholder: "Write...", "aria-label": "Prompt from bag" }}
        aria-label="Prompt direct"
        data-testid="textarea"
      />,
    );
    await flushEffects();
    const textarea = view.container.querySelector("textarea");

    expect(textarea).not.toBeNull();
    expect(textarea?.placeholder).toBe("Write...");
    expect(textarea?.getAttribute("aria-label")).toBe("Prompt direct");
    expect(textarea?.dataset.typaiReactTextarea).toBe("true");
  });

  it("TypaiTextarea attaches the adapter and corrects a common typo", async () => {
    const core = createAutoCorrectCore();
    const onCorrection = vi.fn();
    const view = render(
      <TypaiReact.TypaiTextarea
        typai={core}
        onCorrection={onCorrection}
        textareaProps={{ "aria-label": "Prompt" }}
      />,
    );
    await flushEffects();
    const textarea = view.container.querySelector("textarea");

    typeIntoTextarea(textarea, "teh ");

    expect(textarea?.value).toBe("the ");
    expect(onCorrection).toHaveBeenCalledTimes(1);
  });

  it("TypaiTextarea uses provider context when typai prop is omitted", async () => {
    const core = createAutoCorrectCore();
    const view = render(
      <TypaiProvider typai={core}>
        <TypaiReact.TypaiTextarea textareaProps={{ "aria-label": "Prompt" }} />
      </TypaiProvider>,
    );
    await flushEffects();
    const textarea = view.container.querySelector("textarea");

    typeIntoTextarea(textarea, "teh ");

    expect(textarea?.value).toBe("the ");
  });

  it("TypaiTextarea explicit typai prop overrides provider context", async () => {
    const providerCore = createFakeCore();
    const directCore = createAutoCorrectCore();
    const view = render(
      <TypaiProvider typai={providerCore}>
        <TypaiReact.TypaiTextarea typai={directCore} textareaProps={{ "aria-label": "Prompt" }} />
      </TypaiProvider>,
    );
    await flushEffects();
    const textarea = view.container.querySelector("textarea");

    typeIntoTextarea(textarea, "teh ");

    expect(textarea?.value).toBe("the ");
  });

  it("TypaiTextarea forwards refs and cleans up on unmount", async () => {
    const core = createAutoCorrectCore();
    const ref = createRef<HTMLTextAreaElement>();
    const onCorrection = vi.fn();
    const view = render(
      <TypaiReact.TypaiTextarea typai={core} ref={ref} onCorrection={onCorrection} />,
    );
    await flushEffects();
    const textarea = ref.current;

    expect(textarea?.tagName).toBe("TEXTAREA");

    view.unmount();
    typeIntoTextarea(textarea, "teh ");

    expect(textarea?.value).toBe("teh ");
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it("TypaiContenteditable renders a contenteditable element and attaches", async () => {
    const onDecision = vi.fn();
    const view = render(
      <TypaiReact.TypaiContenteditable
        typai={createFakeCore()}
        onDecision={onDecision}
        contenteditableProps={{ role: "textbox", "aria-label": "Editor" }}
      />,
    );
    await flushEffects();
    const element = view.container.querySelector("[data-typai-react-contenteditable]");

    expect(element).not.toBeNull();
    expect(element?.getAttribute("contenteditable")).toBe("true");
    expect(element?.getAttribute("role")).toBe("textbox");

    typeIntoContenteditable(element, "teh ");

    expect(onDecision).toHaveBeenCalledTimes(1);
  });

  it("TypaiSettingsPanel toggles controlled settings callbacks", () => {
    const settings = {
      autocorrect: true,
      spellcheck: true,
      keepCorrectionMarksVisible: true,
      usePersonalDictionary: true,
    };
    const onChange = vi.fn();
    const onSettingsChange = vi.fn();
    const view = render(
      <TypaiReact.TypaiSettingsPanel
        settings={settings}
        onChange={onChange}
        onSettingsChange={onSettingsChange}
      />,
    );
    const checkbox = view.container.querySelector<HTMLInputElement>("input[type='checkbox']");

    expect(view.container.textContent).not.toMatch(/completion/i);

    act(() => {
      checkbox?.click();
    });

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      autocorrect: false,
    });
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...settings,
      autocorrect: false,
    });
  });

  it("TypaiDebugTable renders supplied local debug rows without completion metrics", () => {
    const view = render(
      <TypaiReact.TypaiDebugTable
        data={{
          correctionCount: 2,
          unresolvedCount: 1,
          revertCount: 1,
          protectedSkipCount: 3,
          latenciesMs: [1, 2],
          recentEvents: [
            {
              time: "2026-05-17T23:30:00.000Z",
              source: "textarea",
              action: "auto_correct",
              outcome: "applied",
              latencyMs: 1,
            },
          ],
        }}
      />,
    );

    expect(view.container.textContent).toContain("Corrections");
    expect(view.container.textContent).toContain("auto_correct");
    expect(view.container.textContent).toContain("Latency samples");
    expect(view.container.textContent).not.toMatch(/completion/i);
  });

  it("component render path does not emit React warnings", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(
        <TypaiProvider typai={createFakeCore()}>
          <TypaiReact.TypaiTextarea textareaProps={{ "aria-label": "Prompt" }} />
          <TypaiReact.TypaiContenteditable contenteditableProps={{ "aria-label": "Editor" }} />
        </TypaiProvider>,
      );
      await flushEffects();

      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

function render(ui: ReactElement): {
  container: HTMLElement;
  rerender(nextUi: ReactElement): void;
  unmount(): void;
} {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.appendChild(container);
  mountedRoots.push(root);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    rerender(nextUi) {
      act(() => {
        root.render(nextUi);
      });
    },
    unmount() {
      const index = mountedRoots.indexOf(root);

      if (index !== -1) {
        mountedRoots.splice(index, 1);
      }

      act(() => root.unmount());
    },
  };
}

function TextareaProbe({
  typai,
  label = "probe",
  onDecision,
  onCorrection,
  onMark,
}: {
  typai?: TypaiCore;
  label?: string;
  onDecision?: TypaiTextareaHookOptions["onDecision"];
  onCorrection?: TypaiTextareaHookOptions["onCorrection"];
  onMark?: TypaiTextareaHookOptions["onMark"];
}): ReactElement {
  const hook = useTypaiTextarea({
    typai,
    onDecision,
    onCorrection,
    onMark,
  });

  return (
    <>
      <textarea ref={hook.ref} aria-label="Prompt" />
      <output
        data-label={label}
        data-status={hook.status}
        data-attach-count={String(hook.debug.attachCount)}
        data-has-adapter={String(hook.adapter !== null)}
      />
    </>
  );
}

function ContenteditableProbe({ typai }: { typai?: TypaiCore }): ReactElement {
  const hook = useTypaiContenteditable({ typai });

  return (
    <>
      <div ref={hook.ref} contentEditable data-testid="editor" />
      <output
        data-status={hook.status}
        data-attach-count={String(hook.debug.attachCount)}
        data-has-adapter={String(hook.adapter !== null)}
      />
    </>
  );
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function typeIntoTextarea(textarea: HTMLTextAreaElement | null, text: string): void {
  if (textarea === null) {
    throw new Error("Expected textarea to exist.");
  }

  act(() => {
    textarea.value = text;
    textarea.selectionStart = text.length;
    textarea.selectionEnd = text.length;
    textarea.dispatchEvent(inputEvent(text.at(-1) ?? ""));
  });
}

function typeIntoContenteditable(element: Element | null, text: string): void {
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected contenteditable element to exist.");
  }

  act(() => {
    element.textContent = text;
    element.dispatchEvent(inputEvent(text.at(-1) ?? ""));
  });
}

function inputEvent(data: string): Event {
  const event = new Event("input", { bubbles: true });

  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}

function createFakeCore(
  decide: TypaiCore["checkCompletedToken"] = () => ({
    action: "do_nothing",
    reasonCodes: [],
  }),
): TypaiCore {
  return {
    checkCompletedToken: decide,
    suggestToken() {
      return {
        suggestions: [],
        scores: [],
        reasonCodes: [],
      };
    },
    getLoadedDictionaryWordCount() {
      return 0;
    },
    clearLoadedDictionary() {},
    async addToPersonalDictionary() {},
    async removeFromPersonalDictionary() {},
    isInPersonalDictionary() {
      return false;
    },
    async setAlwaysCorrect() {},
    async setNeverCorrect() {},
    async clearCorrectionRule() {},
    getCorrectionRule() {
      return null;
    },
    async exportTypaiMemory() {
      return {
        version: 1,
        exportedAt: new Date(0).toISOString(),
        personalDictionary: [],
        correctionRules: [],
      };
    },
    async importTypaiMemory() {},
    async resetTypaiMemory() {},
  };
}

function createAutoCorrectCore(): TypaiCore {
  return createFakeCore(({ token }) => {
    if (token === "teh") {
      return {
        action: "auto_correct",
        original: "teh",
        replacement: "the",
        confidence: 0.99,
        mark: "blue_applied_correction",
        reasonCodes: ["COMMON_TYPO_MATCH"],
      };
    }

    return {
      action: "do_nothing",
      reasonCodes: [],
    };
  });
}
