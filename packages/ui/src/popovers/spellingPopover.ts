import { createPopover } from "./createPopover";
import type {
  SpellingPopoverActions,
  SpellingPopoverData,
  TypaiPopoverHandle,
  TypaiPopoverParentOptions,
  TypaiUiAction,
} from "./types";

export type SpellingPopoverOptions = TypaiPopoverParentOptions & {
  data: SpellingPopoverData;
  actions: SpellingPopoverActions;
};

export function createSpellingPopover(options: SpellingPopoverOptions): TypaiPopoverHandle {
  return createPopover({
    ownerDocument: options.ownerDocument,
    parent: options.parent,
    anchorRect: options.data.anchorRect,
    label: "Typai spelling actions",
    className: "typai-popover-spelling",
    onClose: options.onClose,
    restoreFocusOnClose: options.restoreFocusOnClose,
    renderContent({ close, element, ownerDocument }) {
      element.appendChild(
        createTextBlock(
          ownerDocument,
          "typai-popover-title",
          `Possible spelling issue: "${options.data.original}".`,
        ),
      );
      element.appendChild(
        createTextBlock(
          ownerDocument,
          "typai-popover-description",
          "Choose a suggestion or dismiss this spelling mark.",
        ),
      );

      const actions = ownerDocument.createElement("div");
      actions.className = "typai-popover-actions";

      for (const suggestion of options.data.suggestions) {
        actions.appendChild(
          createActionButton(
            ownerDocument,
            suggestion,
            "choose-suggestion",
            () => options.actions.chooseSuggestion(suggestion),
            close,
          ),
        );
      }

      if (options.data.suggestions.length === 0) {
        actions.appendChild(
          createTextBlock(ownerDocument, "typai-popover-empty", "No suggestions."),
        );
      }

      actions.appendChild(
        createActionButton(
          ownerDocument,
          "Ignore once",
          "ignore-once",
          options.actions.ignoreOnce,
          close,
        ),
      );
      actions.appendChild(
        createActionButton(
          ownerDocument,
          "Add to dictionary",
          "add-to-dictionary",
          options.actions.addToDictionary,
          close,
        ),
      );
      actions.appendChild(
        createActionButton(
          ownerDocument,
          "Disable autocorrect",
          "disable-autocorrect",
          options.actions.disableAutocorrect,
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
