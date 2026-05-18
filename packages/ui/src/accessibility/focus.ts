const defaultFocusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function focusFirstAction(
  container: ParentNode,
  selector = defaultFocusableSelector,
): HTMLElement | null {
  const target = container.querySelector<HTMLElement>(selector);

  target?.focus();

  return target;
}

export function restoreFocus(target: Element | null | undefined): boolean {
  if (target === null || target === undefined || !("focus" in target)) {
    return false;
  }

  (target as HTMLElement).focus();

  return true;
}

export function createEscapeKeyHandler(
  target: EventTarget,
  onEscape: (event: KeyboardEvent) => void,
): () => void {
  const handler = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.key !== "Escape") {
      return;
    }

    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    onEscape(keyboardEvent);
  };

  target.addEventListener("keydown", handler);

  return () => target.removeEventListener("keydown", handler);
}
