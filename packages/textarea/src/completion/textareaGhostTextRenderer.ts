import type { TextareaOverlayMirror } from "../overlay/createOverlayMirror";
import type {
  TextareaCompletionRenderMetadata,
  TextareaCompletionSnapshot,
  TextareaGhostTextClearReason,
} from "../types";
import {
  getLineHeightPx,
  measureCaretInOverlayMirror,
  type TextareaCaretClientRect,
} from "./caretGeometry";

export type TextareaGhostTextRenderer = {
  renderTextareaGhostText(
    text: string,
    snapshot: TextareaCompletionSnapshot,
    metadata?: TextareaCompletionRenderMetadata,
  ): boolean;
  clearTextareaGhostText(reason?: TextareaGhostTextClearReason): void;
  isTextareaGhostVisible(): boolean;
  getTextareaGhostText(): string | null;
  getTextareaGhostProposal(): TextareaGhostTextProposal | null;
  resyncTextareaGhostText(): void;
  destroy(): void;
};

export type TextareaGhostTextProposal = {
  text: string;
  snapshot: TextareaCompletionSnapshot;
  metadata: TextareaCompletionRenderMetadata;
};

export type CreateTextareaGhostTextRendererOptions = {
  textarea: HTMLTextAreaElement;
  getOverlay(): TextareaOverlayMirror | null;
  isSnapshotFresh(snapshot: TextareaCompletionSnapshot): boolean;
};

export function createTextareaGhostTextRenderer(
  options: CreateTextareaGhostTextRendererOptions,
): TextareaGhostTextRenderer {
  const { textarea } = options;
  const ownerWindow = textarea.ownerDocument?.defaultView;
  let ghost: HTMLElement | null = null;
  let activeSnapshot: TextareaCompletionSnapshot | null = null;
  let activeText: string | null = null;
  let activeMetadata: TextareaCompletionRenderMetadata = {};
  let destroyed = false;

  const resyncTextareaGhostText = () => {
    if (ghost === null || activeSnapshot === null || activeText === null) {
      return;
    }

    if (!options.isSnapshotFresh(activeSnapshot)) {
      clearTextareaGhostText("stale_snapshot");
      return;
    }

    const overlay = options.getOverlay();

    if (overlay === null) {
      clearTextareaGhostText("overlay_unavailable");
      return;
    }

    copyTextStyles(textarea, ghost);

    const caretRect = measureCaretInOverlayMirror(
      textarea,
      overlay.mirror,
      activeSnapshot.selection.end,
    );
    const rootRect = getElementRect(overlay.root);
    const lineHeight = getLineHeightPx(textarea);

    ghost.textContent = activeText;
    ghost.style.setProperty("left", `${caretRect.left - rootRect.left}px`);
    ghost.style.setProperty("top", `${caretRect.top - rootRect.top}px`);
    ghost.style.setProperty("min-height", `${caretRect.height || lineHeight}px`);
    ghost.style.setProperty("line-height", `${lineHeight}px`);
    ghost.dataset.typaiTextareaGhostVersion = String(activeSnapshot.version);
    ghost.dataset.typaiTextareaGhostOffset = String(activeSnapshot.selection.end);
  };

  const renderTextareaGhostText = (
    text: string,
    snapshot: TextareaCompletionSnapshot,
    metadata: TextareaCompletionRenderMetadata = {},
  ): boolean => {
    if (destroyed) {
      return false;
    }

    if (text.length === 0) {
      clearTextareaGhostText("empty");
      return false;
    }

    if (!options.isSnapshotFresh(snapshot)) {
      clearTextareaGhostText("stale_snapshot");
      return false;
    }

    const overlay = options.getOverlay();
    const ownerDocument = getOwnerDocumentOrNull(textarea);

    if (overlay === null || ownerDocument === null) {
      clearTextareaGhostText("overlay_unavailable");
      return false;
    }

    if (ghost === null) {
      ghost = createGhostElement(ownerDocument, textarea);
      overlay.root.appendChild(ghost);
    }

    activeText = text;
    activeSnapshot = cloneCompletionSnapshot(snapshot);
    activeMetadata = { ...metadata };
    resyncTextareaGhostText();

    return ghost.parentNode !== null;
  };

  const clearTextareaGhostText = (_reason: TextareaGhostTextClearReason = "manual") => {
    activeSnapshot = null;
    activeText = null;
    activeMetadata = {};

    if (ghost === null) {
      return;
    }

    removeNode(ghost);
    ghost = null;
  };

  const onVisualResync = () => {
    if (!destroyed) {
      resyncTextareaGhostText();
    }
  };
  const resizeObserver = createResizeObserver(textarea, onVisualResync);

  textarea.addEventListener("scroll", onVisualResync);
  ownerWindow?.addEventListener("resize", onVisualResync);
  resizeObserver?.observe(textarea);

  return {
    renderTextareaGhostText,
    clearTextareaGhostText,
    isTextareaGhostVisible() {
      return ghost !== null && ghost.parentNode !== null;
    },
    getTextareaGhostText() {
      return activeText;
    },
    getTextareaGhostProposal() {
      if (activeText === null || activeSnapshot === null || ghost === null) {
        return null;
      }

      return {
        text: activeText,
        snapshot: cloneCompletionSnapshot(activeSnapshot),
        metadata: { ...activeMetadata },
      };
    },
    resyncTextareaGhostText,
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      textarea.removeEventListener("scroll", onVisualResync);
      ownerWindow?.removeEventListener("resize", onVisualResync);
      resizeObserver?.disconnect();
      clearTextareaGhostText("detach");
    },
  };
}

function createGhostElement(ownerDocument: Document, textarea: HTMLTextAreaElement): HTMLElement {
  const ghost = ownerDocument.createElement("span");

  ghost.className = "typai-textarea-ghost-text";
  ghost.setAttribute("data-typai-textarea-ghost", "true");
  ghost.setAttribute("data-testid", "textarea-ghost-text");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.setProperty("position", "absolute");
  ghost.style.setProperty("z-index", "4");
  ghost.style.setProperty("pointer-events", "none");
  ghost.style.setProperty("white-space", "pre");
  ghost.style.setProperty("color", "rgba(107, 114, 128, 0.72)");
  ghost.style.setProperty("background", "transparent");
  ghost.style.setProperty("user-select", "none");
  ghost.style.setProperty("contain", "layout style paint");
  copyTextStyles(textarea, ghost);

  return ghost;
}

function cloneCompletionSnapshot(snapshot: TextareaCompletionSnapshot): TextareaCompletionSnapshot {
  return {
    text: snapshot.text,
    version: snapshot.version,
    selection: { ...snapshot.selection },
    isComposingIME: snapshot.isComposingIME,
    mode: snapshot.mode,
  };
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

function getOwnerDocumentOrNull(textarea: HTMLTextAreaElement): Document | null {
  if (textarea.ownerDocument !== undefined && textarea.ownerDocument !== null) {
    return textarea.ownerDocument;
  }

  if (typeof document !== "undefined") {
    return document;
  }

  return null;
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

function getElementRect(element: HTMLElement): TextareaCaretClientRect {
  if (typeof element.getBoundingClientRect !== "function") {
    return emptyRect();
  }

  const rect = element.getBoundingClientRect();

  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function emptyRect(): TextareaCaretClientRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
  };
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

function removeNode(node: Node): void {
  if (typeof node.remove === "function") {
    node.remove();
    return;
  }

  node.parentNode?.removeChild(node);
}
