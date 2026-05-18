import { syncTextareaStyles } from "../overlay/syncTextareaStyles";

export type TextareaCaretClientRect = {
  x: number;
  y: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function getTextareaCaretClientRect(
  textarea: HTMLTextAreaElement,
  offset: number,
): TextareaCaretClientRect {
  const ownerDocument = getOwnerDocument(textarea);
  const ownerWindow = ownerDocument.defaultView;
  const textareaRect = textarea.getBoundingClientRect();
  const root = ownerDocument.createElement("div");
  const mirror = ownerDocument.createElement("div");

  root.setAttribute("data-typai-textarea-caret-measure-root", "true");
  mirror.setAttribute("data-typai-textarea-caret-measure", "true");
  root.appendChild(mirror);

  const host = ownerDocument.body ?? textarea.parentElement;
  if (host === null) {
    return emptyRect(textareaRect.left, textareaRect.top, getLineHeightPx(textarea));
  }

  host.appendChild(root);

  try {
    syncTextareaStyles(textarea, mirror, root);
    root.style.setProperty("position", "absolute");
    root.style.setProperty("left", `${textareaRect.left + (ownerWindow?.scrollX ?? 0)}px`);
    root.style.setProperty("top", `${textareaRect.top + (ownerWindow?.scrollY ?? 0)}px`);
    root.style.setProperty("visibility", "hidden");
    root.style.setProperty("pointer-events", "none");
    root.style.setProperty("contain", "layout style paint");
    root.style.setProperty("z-index", "-1");
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;

    const marker = renderCaretMarker(textarea, mirror, offset);

    return toPlainRect(marker.getBoundingClientRect(), getLineHeightPx(textarea));
  } finally {
    removeNode(root);
  }
}

export function measureCaretInOverlayMirror(
  textarea: HTMLTextAreaElement,
  overlay: HTMLElement,
  offset: number,
): TextareaCaretClientRect {
  const ownerDocument = getOwnerDocument(textarea);
  const host = overlay.parentElement;

  if (host === null) {
    return getTextareaCaretClientRect(textarea, offset);
  }

  const measurement = ownerDocument.createElement("div");

  measurement.setAttribute("data-typai-textarea-overlay-caret-measure", "true");
  host.appendChild(measurement);

  try {
    syncTextareaStyles(textarea, measurement);
    measurement.style.setProperty("position", "absolute");
    measurement.style.setProperty("inset", "0");
    measurement.style.setProperty("visibility", "hidden");
    measurement.style.setProperty("pointer-events", "none");
    measurement.style.setProperty("z-index", "3");
    measurement.scrollTop = textarea.scrollTop;
    measurement.scrollLeft = textarea.scrollLeft;

    const marker = renderCaretMarker(textarea, measurement, offset);

    return toPlainRect(marker.getBoundingClientRect(), getLineHeightPx(textarea));
  } finally {
    removeNode(measurement);
  }
}

export function renderCaretMarker(
  textarea: HTMLTextAreaElement,
  mirror: HTMLElement,
  offset: number,
): HTMLElement {
  const ownerDocument = getOwnerDocument(textarea);
  const marker = ownerDocument.createElement("span");
  const clampedOffset = clampOffset(offset, textarea.value.length);

  mirror.replaceChildren();
  mirror.appendChild(ownerDocument.createTextNode(textarea.value.slice(0, clampedOffset)));
  marker.setAttribute("data-typai-textarea-caret-marker", "true");
  marker.textContent = "\u200b";
  marker.style.setProperty("display", "inline-block");
  marker.style.setProperty("width", "0");
  marker.style.setProperty("min-width", "0");
  marker.style.setProperty("height", `${getLineHeightPx(textarea)}px`);
  marker.style.setProperty("vertical-align", "baseline");
  marker.style.setProperty("overflow", "hidden");
  mirror.appendChild(marker);

  return marker;
}

export function clampOffset(offset: number, maxOffset: number): number {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.min(Math.max(0, Math.floor(offset)), Math.max(0, maxOffset));
}

export function getLineHeightPx(textarea: HTMLTextAreaElement): number {
  const computedStyle = getComputedStyleForTextarea(textarea);
  const lineHeight = computedStyle.getPropertyValue("line-height");
  const parsed = Number.parseFloat(lineHeight);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const fontSize = Number.parseFloat(computedStyle.getPropertyValue("font-size"));

  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.2 : 16;
}

export function toPlainRect(rect: DOMRect, fallbackHeight = 16): TextareaCaretClientRect {
  const height = rect.height > 0 ? rect.height : fallbackHeight;

  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom > rect.top ? rect.bottom : rect.top + height,
    left: rect.left,
    width: rect.width,
    height,
  };
}

function getOwnerDocument(textarea: HTMLTextAreaElement): Document {
  const ownerDocument = textarea.ownerDocument ?? globalThis.document;

  if (ownerDocument === undefined) {
    throw new TypeError("Textarea caret geometry requires a DOM ownerDocument.");
  }

  return ownerDocument;
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

function emptyRect(left: number, top: number, height: number): TextareaCaretClientRect {
  return {
    x: left,
    y: top,
    top,
    right: left,
    bottom: top + height,
    left,
    width: 0,
    height,
  };
}

function removeNode(node: Node): void {
  if (typeof node.remove === "function") {
    node.remove();
    return;
  }

  node.parentNode?.removeChild(node);
}
