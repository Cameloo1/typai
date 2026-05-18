import { describe, expect, it } from "vitest";

import {
  getTextareaCaretClientRect,
  measureCaretInOverlayMirror,
} from "../src/completion/caretGeometry";
import {
  clearExperimentalCaretGhost,
  renderExperimentalCaretGhost,
} from "../src/completion/textareaGhostFeasibility";

describe("textarea ghost feasibility utilities", () => {
  it("measures an empty textarea without throwing", () => {
    const { textarea } = createTextareaFixture("");

    const rect = getTextareaCaretClientRect(textarea, 0);

    expect(rect.height).toBeGreaterThan(0);
    expect(textarea.value).toBe("");
  });

  it("renders an experimental ghost without mutating textarea.value", () => {
    const { document, textarea } = createTextareaFixture("hello prompt");
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    const ghost = renderExperimentalCaretGhost(textarea, " continuation");

    expect(textarea.value).toBe("hello prompt");
    expect(ghost.ghost.textContent).toBe(" continuation");
    expect(ghost.ghost.parentNode).toBe(document.body);

    ghost.clear();
  });

  it("clearExperimentalCaretGhost is idempotent", () => {
    const { document, textarea } = createTextareaFixture("hello");

    renderExperimentalCaretGhost(textarea, " world");
    clearExperimentalCaretGhost();
    clearExperimentalCaretGhost();

    expect(
      document.body.querySelectorAll("[data-typai-textarea-experimental-ghost='true']"),
    ).toHaveLength(0);
    expect(textarea.value).toBe("hello");
  });

  it("handles multiline values", () => {
    const { textarea } = createTextareaFixture("first line\nsecond line");

    const rect = getTextareaCaretClientRect(textarea, textarea.value.length);

    expect(rect.top).toBeGreaterThanOrEqual(20);
    expect(textarea.value).toBe("first line\nsecond line");
  });

  it("handles trailing spaces and newlines", () => {
    for (const value of ["hello   ", "hello\n", "hello\n\n"]) {
      const { textarea } = createTextareaFixture(value);

      expect(() => getTextareaCaretClientRect(textarea, textarea.value.length)).not.toThrow();
      expect(() => renderExperimentalCaretGhost(textarea, " ghost")).not.toThrow();
      expect(textarea.value).toBe(value);
      clearExperimentalCaretGhost();
    }
  });

  it("measures against an overlay mirror without mutating overlay text", () => {
    const { document, parent, textarea } = createTextareaFixture("first\nsecond");
    const overlay = document.createElement("div");

    overlay.setAttribute("data-typai-textarea-overlay", "mirror");
    overlay.textContent = "existing overlay text";
    parent.appendChild(overlay);

    const rect = measureCaretInOverlayMirror(textarea, overlay, textarea.value.length);

    expect(rect.height).toBeGreaterThan(0);
    expect(overlay.textContent).toBe("existing overlay text");
    expect(textarea.value).toBe("first\nsecond");
  });
});

type StyleValues = Record<string, string>;

class FakeStyle {
  private readonly values = new Map<string, string>();

  constructor(initialValues: StyleValues = {}) {
    for (const [property, value] of Object.entries(initialValues)) {
      this.values.set(property, value);
    }
  }

  setProperty(property: string, value: string): void {
    this.values.set(property, value);
  }

  getPropertyValue(property: string): string {
    return this.values.get(property) ?? "";
  }
}

class FakeNode {
  parentNode: FakeElement | null = null;

  remove(): void {
    this.parentNode?.removeChild(this);
  }
}

class FakeTextNode extends FakeNode {
  constructor(readonly text: string) {
    super();
  }

  get textContent(): string {
    return this.text;
  }
}

class FakeElement extends FakeNode {
  readonly ownerDocument: FakeDocument;
  readonly childNodes: FakeNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly style = new FakeStyle() as CSSStyleDeclaration;
  readonly dataset: Record<string, string> = {};
  computedStyle: CSSStyleDeclaration;
  scrollTop = 0;
  scrollLeft = 0;
  offsetWidth = 320;
  offsetHeight = 120;
  private rawTextContent = "";

  constructor(ownerDocument: FakeDocument, styleValues: StyleValues = {}) {
    super();
    this.ownerDocument = ownerDocument;
    this.computedStyle = createComputedStyle(styleValues);
  }

  get parentElement(): FakeElement | null {
    return this.parentNode;
  }

  get textContent(): string {
    return this.rawTextContent + this.childNodes.map((child) => child.textContent ?? "").join("");
  }

  set textContent(value: string | null) {
    this.rawTextContent = value ?? "";
    this.childNodes.splice(0);
  }

  appendChild<T extends FakeNode>(node: T): T {
    moveNode(node, this);
    this.childNodes.push(node);

    return node;
  }

  removeChild<T extends FakeNode>(node: T): T {
    const index = this.childNodes.indexOf(node);

    if (index !== -1) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }

    return node;
  }

  replaceChildren(...nodes: FakeNode[]): void {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }

    this.rawTextContent = "";
    this.childNodes.splice(0);

    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];

    collectMatches(this, selector, matches);

    return matches;
  }

  getBoundingClientRect(): DOMRect {
    const offset = getAncestorOffset(this);
    const prefix = getTextBeforeNode(this);
    const lines = prefix.split("\n");
    const lineIndex = lines.length - 1;
    const column = lines.at(-1)?.length ?? 0;
    const left = offset.left + column * 8 - (this.parentNode?.scrollLeft ?? 0);
    const top = offset.top + lineIndex * 20 - (this.parentNode?.scrollTop ?? 0);
    const height = 20;

    return {
      x: left,
      y: top,
      top,
      right: left,
      bottom: top + height,
      left,
      width: 0,
      height,
    } as DOMRect;
  }
}

class FakeTextarea extends FakeElement {
  value = "";
  selectionStart = 0;
  selectionEnd = 0;

  addEventListener() {}
  removeEventListener() {}

  constructor(ownerDocument: FakeDocument, value: string) {
    super(ownerDocument);
    this.value = value;
    this.selectionStart = value.length;
    this.selectionEnd = value.length;
  }
}

class FakeDocument {
  readonly defaultView = new FakeWindow();
  readonly body = new FakeElement(this);

  createElement(): FakeElement {
    return new FakeElement(this);
  }

  createTextNode(text: string): FakeTextNode {
    return new FakeTextNode(text);
  }
}

class FakeWindow {
  scrollX = 0;
  scrollY = 0;
  readonly ResizeObserver = FakeResizeObserver;

  getComputedStyle(element: FakeElement): CSSStyleDeclaration {
    return element.computedStyle;
  }

  addEventListener() {}
  removeEventListener() {}
}

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

function createTextareaFixture(value: string): {
  document: FakeDocument;
  parent: FakeElement;
  textarea: HTMLTextAreaElement;
} {
  const document = new FakeDocument();
  const parent = new FakeElement(document);
  const textarea = new FakeTextarea(document, value);

  parent.appendChild(textarea);

  return {
    document,
    parent,
    textarea: textarea as unknown as HTMLTextAreaElement,
  };
}

function createComputedStyle(styleValues: StyleValues = {}): CSSStyleDeclaration {
  const style = new FakeStyle({
    display: "block",
    width: "320px",
    height: "120px",
    "box-sizing": "border-box",
    "font-family": "Typai Sans",
    "font-size": "16px",
    "font-weight": "400",
    "font-style": "normal",
    "line-height": "20px",
    "letter-spacing": "0px",
    "text-transform": "none",
    "text-align": "start",
    "padding-top": "4px",
    "padding-right": "6px",
    "padding-bottom": "4px",
    "padding-left": "6px",
    "border-top-width": "1px",
    "border-right-width": "1px",
    "border-bottom-width": "1px",
    "border-left-width": "1px",
    "border-top-style": "solid",
    "border-right-style": "solid",
    "border-bottom-style": "solid",
    "border-left-style": "solid",
    "tab-size": "8",
    "white-space": "pre-wrap",
    "word-wrap": "break-word",
    "overflow-wrap": "break-word",
    ...styleValues,
  });

  return {
    position: "static",
    getPropertyValue(property: string) {
      return style.getPropertyValue(property);
    },
  } as CSSStyleDeclaration;
}

function moveNode(node: FakeNode, parent: FakeElement): void {
  node.parentNode?.removeChild(node);
  node.parentNode = parent;
}

function collectMatches(element: FakeElement, selector: string, matches: FakeElement[]): void {
  for (const child of element.childNodes) {
    if (child instanceof FakeElement) {
      if (matchesSelector(child, selector)) {
        matches.push(child);
      }

      collectMatches(child, selector, matches);
    }
  }
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  const dataAttributeMatch = /^\[([^=\]]+)="([^"]+)"\]$/.exec(selector);

  if (dataAttributeMatch === null) {
    return false;
  }

  const [, name, value] = dataAttributeMatch;

  return element.getAttribute(name ?? "") === value;
}

function getTextBeforeNode(node: FakeNode): string {
  const parent = node.parentNode;

  if (parent === null) {
    return "";
  }

  let text = "";

  for (const child of parent.childNodes) {
    if (child === node) {
      break;
    }

    text += child.textContent ?? "";
  }

  return text;
}

function getAncestorOffset(node: FakeNode): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let current = node.parentNode;

  while (current !== null) {
    left += Number.parseFloat(current.style.getPropertyValue("left")) || 0;
    top += Number.parseFloat(current.style.getPropertyValue("top")) || 0;
    current = current.parentNode;
  }

  return { left, top };
}
