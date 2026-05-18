import type { TextareaMark, TextareaOverlayMode } from "../types";
import { renderOverlayText } from "./renderOverlayText";
import { syncTextareaStyles } from "./syncTextareaStyles";

export type CreateOverlayMirrorOptions = {
  textarea: HTMLTextAreaElement;
  className?: string;
};

export type TextareaOverlayMirror = {
  mode: TextareaOverlayMode;
  root: HTMLElement;
  mirror: HTMLElement;
  textarea: HTMLTextAreaElement;
  className?: string;
  sync(): void;
  resyncOverlay(): void;
  render(value: string, marks?: TextareaMark[]): void;
  destroy(): void;
};

export function createOverlayMirror(options: CreateOverlayMirrorOptions): TextareaOverlayMirror {
  const { textarea } = options;
  const ownerDocument = getOwnerDocument(textarea);
  const root = ownerDocument.createElement("div");
  const mirror = ownerDocument.createElement("div");
  const originalParent = textarea.parentNode;
  const originalNextSibling = textarea.nextSibling;
  const originalTextareaStyle = textarea.getAttribute("style");
  let overlay: TextareaOverlayMirror | null = null;
  const syncOverlay = () => overlay?.sync();
  const resizeObserver = createResizeObserver(textarea, syncOverlay);
  const mutationObserver = createMutationObserver(textarea, syncOverlay);
  const removeScrollListener = addScrollSync(textarea, mirror);
  const removeWindowResizeListener = addWindowResizeSync(textarea, syncOverlay);

  root.className = "typai-textarea-overlay-root";
  root.setAttribute("data-typai-textarea-overlay-root", "true");
  mirror.className = options.className ?? "typai-textarea-overlay-mirror";
  mirror.setAttribute("data-typai-textarea-overlay", "mirror");
  mirror.setAttribute("aria-hidden", "true");

  if (originalParent !== null) {
    originalParent.insertBefore(root, textarea);
  }

  root.appendChild(mirror);
  root.appendChild(textarea);
  prepareTextareaLayer(textarea);

  const createdOverlay: TextareaOverlayMirror = {
    mode: "overlay-mirror",
    root,
    mirror,
    textarea,
    className: options.className,
    sync() {
      syncTextareaStyles(textarea, mirror, root);
      syncScroll(textarea, mirror);
    },
    resyncOverlay() {
      this.sync();
    },
    render(value, marks = []) {
      renderOverlayText(mirror, value, marks);
      this.sync();
    },
    destroy() {
      removeScrollListener();
      removeWindowResizeListener();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      restoreTextareaStyle(textarea, originalTextareaStyle);

      if (originalParent !== null) {
        if (root.parentNode === originalParent) {
          originalParent.insertBefore(textarea, root);
        } else {
          originalParent.insertBefore(textarea, originalNextSibling);
        }
      } else if (textarea.parentNode === root) {
        root.removeChild(textarea);
      }

      removeNode(root);
    },
  };

  overlay = createdOverlay;
  resizeObserver?.observe(textarea);
  mutationObserver?.observe(textarea, {
    attributes: true,
    attributeFilter: ["class", "cols", "rows", "style"],
  });
  createdOverlay.sync();

  return createdOverlay;
}

export function canCreateOverlayMirror(textarea: HTMLTextAreaElement): boolean {
  return getOwnerDocumentOrNull(textarea) !== null;
}

function getOwnerDocument(textarea: HTMLTextAreaElement): Document {
  const ownerDocument = getOwnerDocumentOrNull(textarea);

  if (ownerDocument === null) {
    throw new TypeError("Textarea overlay mirror requires a DOM ownerDocument.");
  }

  return ownerDocument;
}

function getOwnerDocumentOrNull(textarea: HTMLTextAreaElement): Document | null {
  if (textarea.ownerDocument !== undefined && textarea.ownerDocument !== null) {
    return textarea.ownerDocument;
  }

  if (typeof document !== "undefined") {
    return document;
  }

  return null;
}

function prepareTextareaLayer(textarea: HTMLTextAreaElement): void {
  const computedStyle = getComputedStyleForTextarea(textarea);

  if (computedStyle.position === "static" || computedStyle.position.length === 0) {
    textarea.style.setProperty("position", "relative");
  }

  textarea.style.setProperty("z-index", "1");
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
    position: "static",
  } as CSSStyleDeclaration;
}

function restoreTextareaStyle(textarea: HTMLTextAreaElement, originalStyle: string | null): void {
  if (originalStyle === null) {
    textarea.removeAttribute("style");
    return;
  }

  textarea.setAttribute("style", originalStyle);
}

function addScrollSync(textarea: HTMLTextAreaElement, mirror: HTMLElement): () => void {
  const sync = () => syncScroll(textarea, mirror);

  textarea.addEventListener("scroll", sync);

  return () => textarea.removeEventListener("scroll", sync);
}

function syncScroll(textarea: HTMLTextAreaElement, mirror: HTMLElement): void {
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;
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

function createMutationObserver(
  textarea: HTMLTextAreaElement,
  callback: () => void,
): MutationObserver | null {
  const ownerWindow = textarea.ownerDocument?.defaultView;
  const MutationObserverCtor = ownerWindow?.MutationObserver ?? globalThis.MutationObserver;

  if (MutationObserverCtor === undefined) {
    return null;
  }

  return new MutationObserverCtor(callback);
}

function addWindowResizeSync(textarea: HTMLTextAreaElement, callback: () => void): () => void {
  const ownerWindow = textarea.ownerDocument?.defaultView;

  if (!isEventTargetWithListeners(ownerWindow)) {
    return () => {};
  }

  ownerWindow.addEventListener("resize", callback);

  return () => ownerWindow.removeEventListener("resize", callback);
}

function isEventTargetWithListeners(
  value: unknown,
): value is Pick<EventTarget, "addEventListener" | "removeEventListener"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "addEventListener" in value &&
    "removeEventListener" in value &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}

function removeNode(node: Node): void {
  if (typeof node.remove === "function") {
    node.remove();
    return;
  }

  node.parentNode?.removeChild(node);
}
