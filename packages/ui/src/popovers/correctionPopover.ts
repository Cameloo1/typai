import { createPopover } from "./createPopover";
import type {
  CorrectionPopoverActions,
  CorrectionPopoverData,
  TypaiPopoverHandle,
  TypaiPopoverParentOptions,
  TypaiUiAction,
} from "./types";

export type CorrectionPopoverOptions = TypaiPopoverParentOptions & {
  data: CorrectionPopoverData;
  actions: CorrectionPopoverActions;
};

export function createCorrectionPopover(options: CorrectionPopoverOptions): TypaiPopoverHandle {
  return createPopover({
    ownerDocument: options.ownerDocument,
    parent: options.parent,
    anchorRect: options.data.anchorRect,
    label: "Typai correction actions",
    className: "typai-popover-correction",
    onClose: options.onClose,
    restoreFocusOnClose: options.restoreFocusOnClose,
    renderContent({ close, element, ownerDocument }) {
      element.appendChild(
        createTextBlock(
          ownerDocument,
          "typai-popover-title",
          `Corrected "${options.data.original}" -> "${options.data.replacement}".`,
        ),
      );
      element.appendChild(
        createTextBlock(
          ownerDocument,
          "typai-popover-description",
          "Choose how Typai should handle this correction.",
        ),
      );

      const actions = ownerDocument.createElement("div");
      actions.className = "typai-popover-actions";

      actions.appendChild(
        createActionButton(ownerDocument, "Revert", "revert", options.actions.revert, close),
      );
      actions.appendChild(
        createActionButton(
          ownerDocument,
          "Always correct",
          "always-correct",
          options.actions.alwaysCorrect,
          close,
        ),
      );
      actions.appendChild(
        createActionButton(
          ownerDocument,
          "Don't correct again",
          "never-correct",
          options.actions.neverCorrect,
          close,
        ),
      );
      actions.appendChild(
        createActionButton(
          ownerDocument,
          "Add original to dictionary",
          "add-original-to-dictionary",
          options.actions.addOriginalToDictionary,
          close,
        ),
      );
      actions.appendChild(
        createActionButton(ownerDocument, "Close", "close", options.actions.close, close),
      );

      element.appendChild(actions);
    },
  });
}

function createTextBlock(ownerDocument: Document, className: string, text: string): HTMLElement {
  const element = ownerDocument.createElement("p");

  element.className = className;
  element.textContent = text;

  return element;
}

function createActionButton(
  ownerDocument: Document,
  label: string,
  actionName: string,
  action: TypaiUiAction,
  close: () => void,
): HTMLButtonElement {
  const button = ownerDocument.createElement("button");

  button.type = "button";
  button.className = "typai-popover-action";
  button.dataset.typaiPopoverAction = actionName;
  button.textContent = label;
  button.addEventListener("click", () => {
    void action();
    close();
  });

  return button;
}
