import type { TypaiCore } from "@typai/core";
import { beforeEach, describe, expect, it } from "vitest";

import { attachTextarea } from "../src/index";
import { createOverlayMirror } from "../src/overlay/createOverlayMirror";

describe("createOverlayMirror", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    FakeMutationObserver.instances = [];
  });

  it("creates a root and mirror around the textarea", () => {
    const { parent, textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });

    expect(parent.childNodes).toEqual([overlay.root]);
    expect(overlay.root.childNodes).toEqual([overlay.mirror, textarea]);
    expect(overlay.root.getAttribute("data-typai-textarea-overlay-root")).toBe("true");
    expect(overlay.mirror.getAttribute("data-typai-textarea-overlay")).toBe("mirror");
    expect(overlay.mirror.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.mirror.style.getPropertyValue("pointer-events")).toBe("none");
  });

  it("is destroyed when attachTextarea detaches", () => {
    const { parent, textarea } = createTextareaFixture();
    const detach = attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    const root = parent.childNodes[0];

    expect(root?.getAttribute("data-typai-textarea-overlay-root")).toBe("true");

    detach();
    detach();

    expect(parent.childNodes).toEqual([textarea]);
    expect(textarea.parentNode).toBe(parent);
  });

  it("syncs key font, padding, and box styles", () => {
    const { textarea } = createTextareaFixture({
      "box-sizing": "border-box",
      "font-family": "Typai Mono",
      "font-size": "17px",
      "line-height": "24px",
      "padding-left": "12px",
      "padding-top": "7px",
    });
    const overlay = createOverlayMirror({ textarea });

    expect(overlay.mirror.style.getPropertyValue("box-sizing")).toBe("border-box");
    expect(overlay.mirror.style.getPropertyValue("font-family")).toBe("Typai Mono");
    expect(overlay.mirror.style.getPropertyValue("font-size")).toBe("17px");
    expect(overlay.mirror.style.getPropertyValue("line-height")).toBe("24px");
    expect(overlay.mirror.style.getPropertyValue("padding-left")).toBe("12px");
    expect(overlay.mirror.style.getPropertyValue("padding-top")).toBe("7px");
    expect(overlay.root.style.getPropertyValue("width")).toBe("320px");
    expect(overlay.root.style.getPropertyValue("height")).toBe("120px");
  });

  it("syncs scroll offsets from the textarea", () => {
    const { textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });

    textarea.scrollTop = 42;
    textarea.scrollLeft = 9;
    textarea.dispatchEvent(new Event("scroll"));

    expect(overlay.mirror.scrollTop).toBe(42);
    expect(overlay.mirror.scrollLeft).toBe(9);
  });

  it("cleans up ResizeObserver on destroy", () => {
    const { textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });
    const resizeObserver = FakeResizeObserver.instances[0];

    expect(resizeObserver?.observed).toEqual([textarea]);

    overlay.destroy();

    expect(resizeObserver?.disconnected).toBe(true);
  });

  it("syncs on resize observer and window resize events", () => {
    const { document, textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });
    const resizeObserver = FakeResizeObserver.instances[0];

    textarea.scrollTop = 23;
    resizeObserver?.trigger();
    expect(overlay.mirror.scrollTop).toBe(23);

    textarea.scrollTop = 41;
    document.defaultView.dispatchEvent(new Event("resize"));
    expect(overlay.mirror.scrollTop).toBe(41);
  });

  it("cleans up window and mutation listeners on destroy", () => {
    const { document, textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });
    const mutationObserver = FakeMutationObserver.instances[0];

    expect(document.defaultView.listenerCount("resize")).toBe(1);
    expect(mutationObserver?.observed).toEqual([textarea]);

    overlay.destroy();
    textarea.scrollTop = 61;
    document.defaultView.dispatchEvent(new Event("resize"));

    expect(document.defaultView.listenerCount("resize")).toBe(0);
    expect(mutationObserver?.disconnected).toBe(true);
    expect(overlay.mirror.scrollTop).not.toBe(61);
  });

  it("renders HTML-looking text as escaped text", () => {
    const { textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });

    overlay.render("<script>", []);

    expect(overlay.mirror.textContent).toBe("<script>");
    expect(overlay.mirror.innerHTML).toBe("&lt;script&gt;");
  });

  it("preserves newline count, including a trailing newline placeholder", () => {
    const { textarea } = createTextareaFixture();
    const overlay = createOverlayMirror({ textarea });

    overlay.render("one\ntwo\n", []);

    expect(countNewlines(overlay.mirror.textContent ?? "")).toBe(2);
    expect(overlay.mirror.textContent?.endsWith("\u200b")).toBe(true);
  });
});

describe("attachTextarea overlay integration", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    FakeMutationObserver.instances = [];
  });

  it("updates mirror text when textarea input changes", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "hello");

    const root = parent.childNodes[0];
    const mirror = root?.childNodes[0];

    expect(mirror?.textContent).toBe("hello");
    expect(textarea.value).toBe("hello");
  });

  it("syncs mirror scroll through attachTextarea", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    const root = parent.childNodes[0];
    const mirror = root?.childNodes[0];

    textarea.scrollTop = 80;
    textarea.scrollLeft = 11;
    textarea.dispatchEvent(new Event("scroll"));

    expect(mirror?.scrollTop).toBe(80);
    expect(mirror?.scrollLeft).toBe(11);
  });

  it("renders red mark spans from textarea mark intents", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "zzzzword ");

    const mirror = parent.childNodes[0]?.childNodes[0];

    expect(mirror?.innerHTML).toContain('data-typai-mark-kind="red_spelling_issue"');
    expect(mirror?.innerHTML).toContain('data-typai-range-start="0"');
    expect(mirror?.innerHTML).toContain('data-typai-range-end="8"');
    expect(textarea.value).toBe("zzzzword ");
  });

  it("renders blue mark spans after textarea autocorrection", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");

    const mirror = parent.childNodes[0]?.childNodes[0];

    expect(textarea.value).toBe("the ");
    expect(mirror?.textContent).toBe("the ");
    expect(mirror?.innerHTML).toContain('data-typai-mark-kind="blue_applied_correction"');
    expect(mirror?.innerHTML).toContain('data-typai-original="teh"');
    expect(mirror?.innerHTML).toContain('data-typai-replacement="the"');
  });

  it("keeps overlay hidden from screen readers while mark triggers stay labelled", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");

    const mirror = getMirror(parent);
    const trigger = getMarkTriggers(parent)[0];

    expect(mirror?.getAttribute("aria-hidden")).toBe("true");
    expect(trigger?.getAttribute("aria-label")).toBe("Review spelling issue reciept");
  });

  it("announces automatic corrections and spelling marks", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    expect(getLiveRegion(parent)?.textContent).toBe("Corrected teh to the");

    typeTextareaValue(textarea, "reciept ");
    expect(getLiveRegion(parent)?.textContent).toBe("Spelling issue marked: reciept");
  });

  it("form reset resyncs the mirror and clears stale marks", () => {
    const { parent, textarea } = createTextareaFixture({}, { withForm: true });

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    expect(countMarkTriggers(parent)).toBe(1);

    textarea.value = "";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;
    getTextareaForm(textarea)?.dispatchEvent(new Event("reset"));

    expect(getMirror(parent)?.textContent).toBe("");
    expect(countMarkTriggers(parent)).toBe(0);
  });

  it("opens a blue popover from a blue mark trigger", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    openFirstMarkTrigger(parent);

    const popover = getPopover(parent);

    expect(popover?.getAttribute("role")).toBe("dialog");
    expect(popover?.textContent).toContain('Corrected "teh" -> "the"');
    expect(getButtonByText(popover, 'Revert to "teh"')).not.toBeNull();
  });

  it("blue popover revert restores the original token exactly", async () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), 'Revert to "teh"');
    await flushActions();

    expect(textarea.value).toBe("teh ");
    expect(getPopover(parent)).toBeNull();
    expect(getLiveRegion(parent)?.textContent).toBe("Reverted correction");
    expect(countMarkTriggers(parent)).toBe(0);
  });

  it("always-correct writes a rule and future token uses the rule", async () => {
    const { parent, textarea } = createTextareaFixture();
    const typai = createStubTypai();

    attachTextarea({
      textarea,
      typai,
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), 'Always correct "teh" to "the"');
    await flushActions();
    typeTextareaValue(textarea, "teh ");

    expect(typai.alwaysRules.get("teh")).toBe("the");
    expect(textarea.value).toBe("the ");
  });

  it("never-correct suppresses future autocorrect and leaves a red mark", async () => {
    const { parent, textarea } = createTextareaFixture();
    const typai = createStubTypai();

    attachTextarea({
      textarea,
      typai,
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), "Don't correct this again");
    await flushActions();
    typeTextareaValue(textarea, "teh ");

    expect(typai.neverRules.has("teh->the")).toBe(true);
    expect(textarea.value).toBe("teh ");
    expect(getMirror(parent)?.innerHTML).toContain('data-typai-mark-kind="red_spelling_issue"');
  });

  it("adding the original blue correction token to dictionary suppresses future behavior", async () => {
    const { parent, textarea } = createTextareaFixture();
    const typai = createStubTypai();

    attachTextarea({
      textarea,
      typai,
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "teh ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), 'Add "teh" to dictionary');
    await flushActions();
    typeTextareaValue(textarea, "teh ");

    expect(typai.addedWords.has("teh")).toBe(true);
    expect(textarea.value).toBe("teh ");
    expect(countMarkTriggers(parent)).toBe(0);
  });

  it("opens a red popover with suggestions from a red mark trigger", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);

    const popover = getPopover(parent);

    expect(popover?.textContent).toContain('Possible spelling issue: "reciept"');
    expect(getButtonByText(popover, "receipt")).not.toBeNull();
    expect(getButtonByText(popover, "recipe")).not.toBeNull();
  });

  it("clicking a red suggestion applies the replacement and creates a blue mark", async () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), "receipt");
    await flushActions();

    expect(textarea.value).toBe("receipt ");
    expect(getMirror(parent)?.innerHTML).toContain(
      'data-typai-mark-kind="blue_applied_correction"',
    );
    expect(getMirror(parent)?.innerHTML).toContain('data-typai-original="reciept"');
  });

  it("ignore once removes only the red mark occurrence", async () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), "Ignore once");
    await flushActions();

    expect(textarea.value).toBe("reciept ");
    expect(countMarkTriggers(parent)).toBe(0);
    expect(getLiveRegion(parent)?.textContent).toBe("Ignored spelling issue");
  });

  it("disabling autocorrect keeps spellcheck red marks", async () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);
    clickButton(getPopover(parent), "Disable autocorrect");
    await flushActions();
    typeTextareaValue(textarea, "teh ");

    expect(textarea.value).toBe("teh ");
    expect(getMirror(parent)?.innerHTML).toContain('data-typai-mark-kind="red_spelling_issue"');
  });

  it("stale range prevents red suggestion application", async () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);
    textarea.value = "receipt ";
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    clickButton(getPopover(parent), "receipt");
    await flushActions();

    expect(textarea.value).toBe("receipt ");
    expect(getMirror(parent)?.innerHTML).not.toContain(
      'data-typai-mark-kind="blue_applied_correction"',
    );
  });

  it("Escape closes an open popover", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);
    getPopover(parent)?.dispatchEvent(keyEvent("Escape"));

    expect(getPopover(parent)).toBeNull();
  });

  it("Enter activates a focused popover action", async () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    openFirstMarkTrigger(parent);
    getButtonByText(getPopover(parent), "Ignore once")?.dispatchEvent(keyEvent("Enter"));
    await flushActions();

    expect(countMarkTriggers(parent)).toBe(0);
  });

  it("Space activates a mark trigger", () => {
    const { parent, textarea } = createTextareaFixture();

    attachTextarea({
      textarea,
      typai: createStubTypai(),
      overlay: { enabled: true },
    });

    typeTextareaValue(textarea, "reciept ");
    getMarkTriggers(parent)[0]?.dispatchEvent(keyEvent(" "));

    expect(getPopover(parent)?.textContent).toContain("Possible spelling issue");
  });
});

type StyleValues = Record<string, string>;

class FakeStyle {
  private readonly values = new Map<string, string>();

  setProperty(property: string, value: string): void {
    this.values.set(property, value);
  }

  getPropertyValue(property: string): string {
    return this.values.get(property) ?? "";
  }

  removeProperty(property: string): string {
    const oldValue = this.getPropertyValue(property);
    this.values.delete(property);

    return oldValue;
  }

  clear(): void {
    this.values.clear();
  }
}

class FakeElement extends EventTarget {
  readonly ownerDocument: FakeDocument;
  readonly nodeName: string;
  readonly style = new FakeStyle() as CSSStyleDeclaration;
  readonly childNodes: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  private rawInnerHTML: string | null = null;
  private rawTextContent = "";
  computedStyle: CSSStyleDeclaration;
  className = "";
  parentNode: FakeElement | null = null;
  scrollTop = 0;
  scrollLeft = 0;
  offsetWidth = 320;
  offsetHeight = 120;

  constructor(ownerDocument: FakeDocument, nodeName: string, styleValues: StyleValues = {}) {
    super();
    this.ownerDocument = ownerDocument;
    this.nodeName = nodeName;
    this.computedStyle = createComputedStyle(styleValues);
  }

  get nextSibling(): FakeElement | null {
    if (this.parentNode === null) {
      return null;
    }

    const index = this.parentNode.childNodes.indexOf(this);

    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get innerHTML(): string {
    return this.rawInnerHTML ?? escapeHtml(this.rawTextContent);
  }

  set innerHTML(value: string) {
    this.rawInnerHTML = value;
    this.rawTextContent = decodeHtml(stripTags(value));
  }

  get textContent(): string {
    return this.rawTextContent + this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string | null) {
    this.rawInnerHTML = null;
    this.rawTextContent = value ?? "";
    this.childNodes.splice(0);
  }

  appendChild<T extends FakeElement>(node: T): T {
    moveNode(node, this);
    this.childNodes.push(node);

    return node;
  }

  insertBefore<T extends FakeElement>(node: T, referenceNode: FakeElement | null): T {
    moveNode(node, this);

    if (referenceNode === null) {
      this.childNodes.push(node);
      return node;
    }

    const index = this.childNodes.indexOf(referenceNode);

    if (index === -1) {
      this.childNodes.push(node);
      return node;
    }

    this.childNodes.splice(index, 0, node);

    return node;
  }

  removeChild<T extends FakeElement>(node: T): T {
    const index = this.childNodes.indexOf(node);

    if (index !== -1) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }

    return node;
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  focus(): void {
    this.setAttribute("data-focused", "true");
  }

  contains(node: FakeElement): boolean {
    return this === node || this.childNodes.some((child) => child.contains(node));
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);

    if (name === "style") {
      (this.style as unknown as FakeStyle).clear();
    }
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];

    collectMatches(this, selector, matches);

    return matches;
  }
}

class FakeTextarea extends FakeElement {
  value = "";
  selectionStart = 0;
  selectionEnd = 0;
  form: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, styleValues: StyleValues = {}) {
    super(ownerDocument, "TEXTAREA", styleValues);
  }
}

class FakeDocument {
  readonly defaultView = new FakeWindow();

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName.toUpperCase());
  }
}

class FakeWindow extends EventTarget {
  readonly ResizeObserver = FakeResizeObserver;
  readonly MutationObserver = FakeMutationObserver;
  private readonly listenersByType = new Map<string, Set<EventListenerOrEventListenerObject>>();

  getComputedStyle(element: FakeElement): CSSStyleDeclaration {
    return element.computedStyle;
  }

  setTimeout(callback: () => void): number {
    callback();
    return 0;
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (callback !== null) {
      const listeners = this.listenersByType.get(type) ?? new Set();

      listeners.add(callback);
      this.listenersByType.set(type, listeners);
    }

    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (callback !== null) {
      this.listenersByType.get(type)?.delete(callback);
    }

    super.removeEventListener(type, callback, options);
  }

  listenerCount(type: string): number {
    return this.listenersByType.get(type)?.size ?? 0;
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];

  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: MutationCallback) {
    FakeMutationObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback([], this as unknown as MutationObserver);
  }
}

function createTextareaFixture(
  styleValues: StyleValues = {},
  options: { withForm?: boolean } = {},
): {
  document: FakeDocument;
  parent: FakeElement;
  textarea: HTMLTextAreaElement;
} {
  const document = new FakeDocument();
  const parent = new FakeElement(document, "DIV");
  const textarea = new FakeTextarea(document, styleValues);

  parent.appendChild(textarea);

  if (options.withForm === true) {
    textarea.form = new FakeElement(document, "FORM");
  }

  return {
    document,
    parent,
    textarea: textarea as unknown as HTMLTextAreaElement,
  };
}

function createComputedStyle(styleValues: StyleValues): CSSStyleDeclaration {
  const values: StyleValues = {
    position: "static",
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
  };

  return {
    position: values.position ?? "static",
    getPropertyValue(property: string) {
      return values[property] ?? "";
    },
  } as CSSStyleDeclaration;
}

function moveNode(node: FakeElement, newParent: FakeElement): void {
  if (node.parentNode !== null) {
    node.parentNode.removeChild(node);
  }

  node.parentNode = newParent;
}

function collectMatches(element: FakeElement, selector: string, matches: FakeElement[]): void {
  for (const child of element.childNodes) {
    if (matchesSelector(child, selector)) {
      matches.push(child);
    }

    collectMatches(child, selector, matches);
  }
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  if (selector === "button") {
    return element.nodeName === "BUTTON";
  }

  const dataAttributeMatch = /^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(selector);

  if (dataAttributeMatch === null) {
    return false;
  }

  const [, name, value] = dataAttributeMatch;
  const attributeValue = element.getAttribute(name ?? "");

  return value === undefined ? attributeValue !== null : attributeValue === value;
}

function typeTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.selectionStart = value.length;
  textarea.selectionEnd = value.length;
  textarea.dispatchEvent(inputEvent(value.at(-1) ?? ""));
}

function inputEvent(data: string): Event {
  const event = new Event("input");
  Object.defineProperty(event, "data", {
    value: data,
  });

  return event;
}

function keyEvent(key: string): Event {
  const event = new Event("keydown");

  Object.defineProperty(event, "key", {
    value: key,
  });
  Object.defineProperty(event, "preventDefault", {
    value() {},
  });

  return event;
}

function openFirstMarkTrigger(parent: FakeElement): void {
  getMarkTriggers(parent)[0]?.dispatchEvent(new Event("click"));
}

function clickButton(popover: FakeElement | null, label: string): void {
  const button = getButtonByText(popover, label);

  expect(button).not.toBeNull();
  button?.dispatchEvent(new Event("click"));
}

function getMirror(parent: FakeElement): FakeElement | null {
  return parent.childNodes[0]?.childNodes[0] ?? null;
}

function getPopover(parent: FakeElement): FakeElement | null {
  return findByAttribute(parent, "data-typai-textarea-popover");
}

function getLiveRegion(parent: FakeElement): FakeElement | null {
  return findByAttribute(parent, "aria-live", "polite");
}

function getTextareaForm(textarea: HTMLTextAreaElement): FakeElement | null {
  return (textarea as unknown as FakeTextarea).form;
}

function getMarkTriggers(parent: FakeElement): FakeElement[] {
  return findAllByAttribute(parent, "data-typai-textarea-mark-trigger");
}

function countMarkTriggers(parent: FakeElement): number {
  return getMarkTriggers(parent).length;
}

function getButtonByText(popover: FakeElement | null, label: string): FakeElement | null {
  if (popover === null) {
    return null;
  }

  return (
    findAllByNodeName(popover, "BUTTON").find((button) => button.textContent === label) ?? null
  );
}

function findByAttribute(element: FakeElement, name: string, value?: string): FakeElement | null {
  return findAllByAttribute(element, name, value)[0] ?? null;
}

function findAllByAttribute(element: FakeElement, name: string, value?: string): FakeElement[] {
  const matches: FakeElement[] = [];

  for (const child of element.childNodes) {
    const attributeValue = child.getAttribute(name);

    if (attributeValue !== null && (value === undefined || attributeValue === value)) {
      matches.push(child);
    }

    matches.push(...findAllByAttribute(child, name, value));
  }

  return matches;
}

function findAllByNodeName(element: FakeElement, nodeName: string): FakeElement[] {
  const matches: FakeElement[] = [];

  for (const child of element.childNodes) {
    if (child.nodeName === nodeName) {
      matches.push(child);
    }

    matches.push(...findAllByNodeName(child, nodeName));
  }

  return matches;
}

async function flushActions(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function countNewlines(value: string): number {
  return [...value].filter((character) => character === "\n").length;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripTags(value: string): string {
  return value.replaceAll(/<[^>]*>/g, "");
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

type StubTypai = TypaiCore & {
  addedWords: Set<string>;
  alwaysRules: Map<string, string>;
  neverRules: Set<string>;
};

function createStubTypai(): StubTypai {
  const addedWords = new Set<string>();
  const alwaysRules = new Map<string, string>();
  const neverRules = new Set<string>();

  return {
    addedWords,
    alwaysRules,
    neverRules,
    checkCompletedToken(input) {
      if (addedWords.has(input.token)) {
        return { action: "do_nothing", reasonCodes: ["PERSONAL_DICTIONARY_MATCH"] };
      }

      const alwaysReplacement = alwaysRules.get(input.token);

      if (alwaysReplacement !== undefined) {
        return {
          action: "auto_correct",
          original: input.token,
          replacement: alwaysReplacement,
          confidence: 1,
          mark: "blue_applied_correction",
          reasonCodes: ["ALWAYS_CORRECT_RULE"],
        };
      }

      if (input.token === "teh") {
        if (neverRules.has("teh->the")) {
          return {
            action: "mark_unresolved",
            original: "teh",
            suggestions: ["the"],
            mark: "red_spelling_issue",
            reasonCodes: ["COMMON_TYPO_MATCH", "NEVER_CORRECT_RULE"],
          };
        }

        return {
          action: "auto_correct",
          original: "teh",
          replacement: "the",
          confidence: 0.99,
          mark: "blue_applied_correction",
          reasonCodes: ["COMMON_TYPO_MATCH"],
        };
      }

      if (input.token === "reciept") {
        return {
          action: "mark_unresolved",
          original: "reciept",
          suggestions: ["receipt", "recipe"],
          mark: "red_spelling_issue",
          reasonCodes: ["UNKNOWN_NON_WORD", "EDIT_DISTANCE_SUGGESTIONS"],
        };
      }

      if (input.token === "zzzzword") {
        return {
          action: "mark_unresolved",
          original: "zzzzword",
          suggestions: [],
          mark: "red_spelling_issue",
          reasonCodes: ["UNKNOWN_NON_WORD", "NO_SUGGESTIONS"],
        };
      }

      return { action: "do_nothing", reasonCodes: ["TEST"] };
    },
    suggestToken() {
      return { suggestions: [], scores: [], reasonCodes: [] };
    },
    getLoadedDictionaryWordCount() {
      return 0;
    },
    getDeleteIndexEntryCount() {
      return 0;
    },
    getDeleteIndexMemoryEstimateBytes() {
      return 0;
    },
    clearLoadedDictionary() {},
    async addToPersonalDictionary(word) {
      addedWords.add(word);
    },
    async removeFromPersonalDictionary() {},
    isInPersonalDictionary(word) {
      return addedWords.has(word);
    },
    async setAlwaysCorrect(original, replacement) {
      alwaysRules.set(original, replacement);
    },
    async setNeverCorrect(original, replacement) {
      neverRules.add(`${original}->${replacement}`);
    },
    async clearCorrectionRule() {},
    getCorrectionRule(original) {
      const alwaysReplacement = alwaysRules.get(original);

      if (alwaysReplacement !== undefined) {
        return {
          original,
          replacement: alwaysReplacement,
          status: "always",
          createdAt: 0,
          updatedAt: 0,
        };
      }

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
