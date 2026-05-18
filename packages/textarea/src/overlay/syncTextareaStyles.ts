export type TextareaStyleSyncResult = {
  copied: boolean;
  copiedProperties: string[];
};

const rootProperties = ["box-sizing", "width", "height"] as const;

const mirrorTextProperties = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "box-sizing",
  "tab-size",
  "white-space",
  "word-wrap",
  "overflow-wrap",
] as const;

export function syncTextareaStyles(
  textarea: HTMLTextAreaElement,
  mirror: HTMLElement,
  root?: HTMLElement,
): TextareaStyleSyncResult {
  const computedStyle = getComputedStyleForTextarea(textarea);
  const copiedProperties: string[] = [];

  if (root !== undefined) {
    setStyle(root, "position", "relative");
    setStyle(root, "display", blockLikeDisplay(computedStyle) ? "block" : "inline-block");
    setStyle(root, "width", dimensionFor(textarea, computedStyle, "width"));
    setStyle(root, "height", dimensionFor(textarea, computedStyle, "height"));

    for (const property of rootProperties) {
      copiedProperties.push(property);
    }
  }

  setStyle(mirror, "position", "absolute");
  setStyle(mirror, "inset", "0");
  setStyle(mirror, "z-index", "2");
  setStyle(mirror, "margin", "0");
  setStyle(mirror, "pointer-events", "none");
  setStyle(mirror, "overflow", "hidden");
  setStyle(mirror, "color", "transparent");
  setStyle(mirror, "white-space", "pre-wrap");
  setStyle(mirror, "overflow-wrap", getStyleValue(computedStyle, "overflow-wrap") || "break-word");
  setStyle(mirror, "word-wrap", getStyleValue(computedStyle, "word-wrap") || "break-word");
  setStyle(mirror, "border-color", "transparent");

  for (const property of mirrorTextProperties) {
    const value = getStyleValue(computedStyle, property);

    if (value.length === 0) {
      continue;
    }

    setStyle(mirror, property, value);
    copiedProperties.push(property);
  }

  return {
    copied: copiedProperties.length > 0,
    copiedProperties,
  };
}

function getComputedStyleForTextarea(textarea: HTMLTextAreaElement): CSSStyleDeclaration {
  const ownerWindow = textarea.ownerDocument?.defaultView;

  if (ownerWindow?.getComputedStyle !== undefined) {
    return ownerWindow.getComputedStyle(textarea);
  }

  if (typeof getComputedStyle !== "undefined") {
    return getComputedStyle(textarea);
  }

  return {
    getPropertyValue: () => "",
  } as CSSStyleDeclaration;
}

function blockLikeDisplay(style: CSSStyleDeclaration): boolean {
  const display = getStyleValue(style, "display");

  return display === "block" || display === "flex" || display === "grid";
}

function dimensionFor(
  textarea: HTMLTextAreaElement,
  style: CSSStyleDeclaration,
  property: "width" | "height",
): string {
  const offset = property === "width" ? textarea.offsetWidth : textarea.offsetHeight;

  if (Number.isFinite(offset) && offset > 0) {
    return `${offset}px`;
  }

  return getStyleValue(style, property);
}

function getStyleValue(style: CSSStyleDeclaration, property: string): string {
  return style.getPropertyValue(property);
}

function setStyle(element: HTMLElement, property: string, value: string): void {
  if (value.length === 0) {
    return;
  }

  element.style.setProperty(property, value);
}
