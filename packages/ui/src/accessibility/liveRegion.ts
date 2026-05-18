export type TypaiLiveRegionOptions = {
  ownerDocument?: Document;
  parent?: HTMLElement;
  politeness?: "polite" | "assertive";
};

export type TypaiLiveRegion = {
  element: HTMLElement;
  announce(message: string): void;
  destroy(): void;
};

export function createTypaiLiveRegion(options: TypaiLiveRegionOptions = {}): TypaiLiveRegion {
  const ownerDocument =
    options.ownerDocument ?? options.parent?.ownerDocument ?? globalThis.document;

  if (ownerDocument === undefined) {
    throw new Error("@typai/ui requires a DOM Document.");
  }

  const parent = options.parent ?? ownerDocument.body;
  const element = ownerDocument.createElement("div");

  element.className = "typai-ui-live-region";
  element.setAttribute("aria-live", options.politeness ?? "polite");
  element.setAttribute("aria-atomic", "true");
  visuallyHide(element);
  parent.appendChild(element);

  return {
    element,
    announce(message) {
      element.textContent = "";
      element.textContent = message;
    },
    destroy() {
      element.remove();
    },
  };
}

function visuallyHide(element: HTMLElement): void {
  element.style.setProperty("border", "0");
  element.style.setProperty("clip", "rect(0 0 0 0)");
  element.style.setProperty("height", "1px");
  element.style.setProperty("margin", "-1px");
  element.style.setProperty("overflow", "hidden");
  element.style.setProperty("padding", "0");
  element.style.setProperty("position", "absolute");
  element.style.setProperty("white-space", "nowrap");
  element.style.setProperty("width", "1px");
}
