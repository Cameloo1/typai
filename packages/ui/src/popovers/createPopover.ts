import { createEscapeKeyHandler, focusFirstAction, restoreFocus } from "../accessibility/focus";
import type { TypaiPopoverHandle, TypaiPopoverParentOptions } from "./types";

export type CreatePopoverOptions = TypaiPopoverParentOptions & {
  label: string;
  anchorRect?: DOMRect;
  className?: string;
  onClose?: () => void;
  restoreFocusOnClose?: boolean;
  renderContent(context: {
    close: () => void;
    element: HTMLElement;
    ownerDocument: Document;
  }): void;
};

export function createPopover(options: CreatePopoverOptions): TypaiPopoverHandle {
  const ownerDocument = resolveOwnerDocument(options);
  const parent = options.parent ?? ownerDocument.body;
  const previousFocus = ownerDocument.activeElement;
  const element = ownerDocument.createElement("div");
  let closed = false;

  element.className = ["typai-ui-popover", "typai-popover-panel", options.className]
    .filter(Boolean)
    .join(" ");
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "false");
  element.setAttribute("aria-label", options.label);
  element.setAttribute("data-typai-ui-popover", "true");

  if (options.anchorRect !== undefined) {
    positionPopover(element, options.anchorRect, ownerDocument);
  }

  const destroy = () => {
    if (closed) {
      return;
    }

    closed = true;
    cleanupEscape();
    element.remove();

    if (options.restoreFocusOnClose === true) {
      restoreFocus(previousFocus);
    }
  };

  const close = () => {
    if (closed) {
      return;
    }

    options.onClose?.();
    destroy();
  };

  const cleanupEscape = createEscapeKeyHandler(element, close);

  options.renderContent({
    close,
    element,
    ownerDocument,
  });

  parent.appendChild(element);

  return {
    element,
    close,
    destroy,
    focusFirstAction() {
      return focusFirstAction(element);
    },
    restoreFocus() {
      return restoreFocus(previousFocus);
    },
  };
}

function resolveOwnerDocument(options: TypaiPopoverParentOptions): Document {
  const ownerDocument =
    options.ownerDocument ?? options.parent?.ownerDocument ?? globalThis.document;

  if (ownerDocument === undefined) {
    throw new Error("@typai/ui requires a DOM Document.");
  }

  return ownerDocument;
}

function positionPopover(element: HTMLElement, anchorRect: DOMRect, ownerDocument: Document): void {
  const view = ownerDocument.defaultView;
  const scrollX = view?.scrollX ?? 0;
  const scrollY = view?.scrollY ?? 0;

  element.style.setProperty("position", "absolute");
  element.style.setProperty("left", `${Math.max(0, anchorRect.left + scrollX)}px`);
  element.style.setProperty("top", `${Math.max(0, anchorRect.bottom + scrollY)}px`);
}
