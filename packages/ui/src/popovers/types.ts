export type TypaiUiActionResult = void | Promise<void>;

export type TypaiUiAction = () => TypaiUiActionResult;

export type TypaiSuggestionAction = (suggestion: string) => TypaiUiActionResult;

export type CorrectionPopoverData = {
  original: string;
  replacement: string;
  anchorRect?: DOMRect;
};

export type CorrectionPopoverActions = {
  revert: TypaiUiAction;
  alwaysCorrect: TypaiUiAction;
  neverCorrect: TypaiUiAction;
  addOriginalToDictionary: TypaiUiAction;
  close: TypaiUiAction;
};

export type SpellingPopoverData = {
  original: string;
  suggestions: string[];
  anchorRect?: DOMRect;
};

export type SpellingPopoverActions = {
  chooseSuggestion: TypaiSuggestionAction;
  ignoreOnce: TypaiUiAction;
  addToDictionary: TypaiUiAction;
  disableAutocorrect: TypaiUiAction;
  close: TypaiUiAction;
};

export type TypaiPopoverHandle = {
  element: HTMLElement;
  close(): void;
  destroy(): void;
  focusFirstAction(): HTMLElement | null;
  restoreFocus(): boolean;
};

export type TypaiPopoverParentOptions = {
  ownerDocument?: Document;
  parent?: HTMLElement;
  onClose?: () => void;
  restoreFocusOnClose?: boolean;
};
