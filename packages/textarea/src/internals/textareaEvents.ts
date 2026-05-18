export type TextareaEventName =
  | "blur"
  | "compositionstart"
  | "compositionend"
  | "input"
  | "keydown"
  | "paste"
  | "select";

export type TextareaEventDisposables = {
  add(dispose: () => void): void;
  disposeAll(): void;
};

export function addTextareaEventListener(
  textarea: HTMLTextAreaElement,
  eventName: TextareaEventName,
  listener: (event: Event) => void,
): () => void {
  textarea.addEventListener(eventName, listener);

  let disposed = false;

  return () => {
    if (disposed) {
      return;
    }

    disposed = true;
    textarea.removeEventListener(eventName, listener);
  };
}

export function createTextareaEventDisposables(): TextareaEventDisposables {
  const disposables: Array<() => void> = [];

  return {
    add(dispose) {
      disposables.push(dispose);
    },
    disposeAll() {
      while (disposables.length > 0) {
        disposables.pop()?.();
      }
    },
  };
}
