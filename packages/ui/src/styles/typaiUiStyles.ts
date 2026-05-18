export const typaiUiStyles = `
.typai-ui-popover,
.typai-popover-panel {
  background: Canvas;
  border: 1px solid color-mix(in srgb, CanvasText 30%, transparent);
  border-radius: 6px;
  box-shadow: 0 8px 24px color-mix(in srgb, CanvasText 18%, transparent);
  color: CanvasText;
  display: grid;
  gap: 8px;
  max-width: min(320px, calc(100vw - 24px));
  padding: 10px;
  z-index: 20;
}

.typai-popover-title,
.typai-popover-description,
.typai-popover-empty {
  margin: 0;
}

.typai-popover-title {
  font-weight: 700;
}

.typai-popover-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.typai-popover-action {
  border: 1px solid currentColor;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 4px 8px;
}

.typai-ui-settings-panel,
.typai-ui-debug-panel {
  display: grid;
  gap: 8px;
}

.typai-ui-settings-title {
  font-size: 1rem;
  margin: 0;
}

.typai-ui-setting {
  align-items: center;
  display: flex;
  gap: 8px;
}

.typai-ui-debug-summary {
  display: grid;
  gap: 4px 12px;
  grid-template-columns: max-content 1fr;
  margin: 0;
}

.typai-ui-debug-summary dd {
  margin: 0;
}

.typai-ui-debug-table {
  border-collapse: collapse;
  inline-size: 100%;
}

.typai-ui-debug-table caption {
  text-align: start;
}

.typai-ui-debug-table th,
.typai-ui-debug-table td {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
  padding: 4px 6px;
  text-align: start;
}

.typai-mark-red-spelling-issue,
.typai-mark-red {
  text-decoration: underline wavy #b91c1c;
  text-decoration-thickness: 1.5px;
}

.typai-mark-blue-applied-correction,
.typai-mark-blue {
  background: color-mix(in srgb, #2563eb 16%, transparent);
  text-decoration: underline #2563eb;
  text-decoration-thickness: 1.5px;
}
`;

export function createTypaiUiStyleElement(ownerDocument = globalThis.document): HTMLStyleElement {
  if (ownerDocument === undefined) {
    throw new Error("@typai/ui requires a DOM Document.");
  }

  const style = ownerDocument.createElement("style");

  style.setAttribute("data-typai-ui-styles", "true");
  style.textContent = typaiUiStyles;

  return style;
}

export function ensureTypaiUiStyles(ownerDocument = globalThis.document): HTMLStyleElement {
  if (ownerDocument === undefined) {
    throw new Error("@typai/ui requires a DOM Document.");
  }

  const existing = ownerDocument.querySelector<HTMLStyleElement>("[data-typai-ui-styles]");

  if (existing !== null) {
    return existing;
  }

  const style = createTypaiUiStyleElement(ownerDocument);

  ownerDocument.head.appendChild(style);

  return style;
}
