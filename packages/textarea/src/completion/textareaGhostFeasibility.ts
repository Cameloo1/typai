import {
  getLineHeightPx,
  getTextareaCaretClientRect,
  type TextareaCaretClientRect,
} from "./caretGeometry";

export type ExperimentalTextareaCaretGhost = {
  ghost: HTMLElement;
  textarea: HTMLTextAreaElement;
  offset: number;
  text: string;
  getRect(): TextareaCaretClientRect;
  resync(nextOffset?: number): TextareaCaretClientRect;
  clear(): void;
};

const activeGhosts = new Set<ExperimentalTextareaCaretGhost>();

export function renderExperimentalCaretGhost(
  textarea: HTMLTextAreaElement,
  text: string,
  offset = textarea.selectionStart,
): ExperimentalTextareaCaretGhost {
  const ownerDocument = getOwnerDocument(textarea);
  const ghost = ownerDocument.createElement("span");
  const ownerWindow = ownerDocument.defaultView;
  let currentOffset = offset;
  let disposed = false;

  ghost.setAttribute("data-typai-textarea-experimental-ghost", "true");
  ghost.setAttribute("data-testid", "textarea-experimental-ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = text;
  ghost.style.setProperty("position", "fixed");
  ghost.style.setProperty("z-index", "4");
  ghost.style.setProperty("pointer-events", "none");
  ghost.style.setProperty("white-space", "pre");
  ghost.style.setProperty("color", "rgba(107, 114, 128, 0.72)");
  ghost.style.setProperty("background", "transparent");
  ghost.style.setProperty("user-select", "none");
  ghost.style.setProperty("contain", "layout style paint");
  copyTextStyles(textarea, ghost);

  const host = ownerDocument.body ?? textarea.parentElement;
  if (host === null) {
    throw new TypeError("Textarea ghost feasibility requires a DOM host.");
  }

  host.appendChild(ghost);

  const resync = (nextOffset = currentOffset): TextareaCaretClientRect => {
    currentOffset = nextOffset;
    copyTextStyles(textarea, ghost);
    const rect = getTextareaCaretClientRect(textarea, currentOffset);

    ghost.style.setProperty("left", `${rect.left}px`);
    ghost.style.setProperty("top", `${rect.top}px`);
    ghost.style.setProperty("min-height", `${rect.height}px`);
    ghost.style.setProperty("line-height", `${getLineHeightPx(textarea)}px`);
    ghost.dataset.typaiCaretOffset = String(currentOffset);

    return rect;
  };

  const onScrollOrResize = () => {
    if (!disposed) {
      resync();
    }
  };
  const resizeObserver = createResizeObserver(textarea, onScrollOrResize);

  textarea.addEventListener("scroll", onScrollOrResize);
  ownerWindow?.addEventListener("resize", onScrollOrResize);
  resizeObserver?.observe(textarea);

  const handle: ExperimentalTextareaCaretGhost = {
    ghost,
    textarea,
    get offset() {
      return currentOffset;
    },
    text,
    getRect() {
      return toPlainRect(ghost.getBoundingClientRect(), getLineHeightPx(textarea));
    },
    resync,
    clear() {
      if (disposed) {
        return;
      }

      disposed = true;
      textarea.removeEventListener("scroll", onScrollOrResize);
      ownerWindow?.removeEventListener("resize", onScrollOrResize);
      resizeObserver?.disconnect();
      activeGhosts.delete(handle);
      removeNode(ghost);
    },
  };

  activeGhosts.add(handle);
  resync(currentOffset);

  return handle;
}

export function clearExperimentalCaretGhost(): void {
  for (const ghost of [...activeGhosts]) {
    ghost.clear();
  }
}

function copyTextStyles(textarea: HTMLTextAreaElement, ghost: HTMLElement): void {
  const computedStyle = getComputedStyleForTextarea(textarea);

  for (const property of [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "text-transform",
  ]) {
    const value = computedStyle.getPropertyValue(property);

    if (value.length > 0) {
      ghost.style.setProperty(property, value);
    }
  }
}

function getOwnerDocument(textarea: HTMLTextAreaElement): Document {
  const ownerDocument = textarea.ownerDocument ?? globalThis.document;

  if (ownerDocument === undefined) {
    throw new TypeError("Textarea ghost feasibility requires a DOM ownerDocument.");
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

function createResizeObserver(
  textarea: HTMLTextAreaElement,
  callback: () => void,
): ResizeObserver | null {
  const ownerWindow = textarea.ownerDocument?.defaultView;
  const ResizeObserverCtor = ownerWindow?.ResizeObserver ?? globalThis.ResizeObserver;

  if (ResizeObserverCtor === undefined) {
    return null;
  }

  return new ResizeObserverCtor(callback);
}

function toPlainRect(rect: DOMRect, fallbackHeight: number): TextareaCaretClientRect {
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

function removeNode(node: Node): void {
  if (typeof node.remove === "function") {
    node.remove();
    return;
  }

  node.parentNode?.removeChild(node);
}
