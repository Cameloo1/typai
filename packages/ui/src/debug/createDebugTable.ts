import type { TypaiDebugTableHandle, TypaiUiDebugData, TypaiUiDebugEvent } from "./types";

export type CreateDebugTableOptions = {
  ownerDocument?: Document;
  parent?: HTMLElement;
  data: TypaiUiDebugData;
};

export function createDebugTable(options: CreateDebugTableOptions): TypaiDebugTableHandle {
  const ownerDocument = resolveOwnerDocument(options.ownerDocument, options.parent);
  const element = ownerDocument.createElement("section");

  element.className = "typai-ui-debug-panel";
  element.setAttribute("aria-label", "Typai debug summary");
  element.setAttribute("data-typai-ui-debug-table", "true");

  renderDebugTable(element, options.data);
  options.parent?.appendChild(element);

  return {
    element,
    update(data) {
      renderDebugTable(element, data);
    },
    destroy() {
      element.replaceChildren();
      element.remove();
    },
  };
}

function renderDebugTable(element: HTMLElement, data: TypaiUiDebugData): void {
  const ownerDocument = element.ownerDocument;

  element.replaceChildren();
  element.appendChild(createSummaryList(ownerDocument, data));
  element.appendChild(createEventsTable(ownerDocument, data.recentEvents));
}

function createSummaryList(ownerDocument: Document, data: TypaiUiDebugData): HTMLElement {
  const summary = ownerDocument.createElement("dl");

  summary.className = "typai-ui-debug-summary";
  appendSummaryRow(summary, "Corrections", data.correctionCount);
  appendSummaryRow(summary, "Unresolved", data.unresolvedCount);
  appendSummaryRow(summary, "Reverts", data.revertCount);
  appendSummaryRow(summary, "Protected skips", data.protectedSkipCount);
  appendSummaryRow(summary, "Latest latency", formatLatency(data.latenciesMs.at(-1)));
  appendSummaryRow(summary, "P95 latency", formatLatency(getP95(data.latenciesMs)));

  return summary;
}

function appendSummaryRow(summary: HTMLElement, label: string, value: string | number): void {
  const term = summary.ownerDocument.createElement("dt");
  const description = summary.ownerDocument.createElement("dd");

  term.textContent = label;
  description.textContent = String(value);
  summary.appendChild(term);
  summary.appendChild(description);
}

function createEventsTable(ownerDocument: Document, events: TypaiUiDebugEvent[]): HTMLTableElement {
  const table = ownerDocument.createElement("table");
  const caption = ownerDocument.createElement("caption");
  const head = ownerDocument.createElement("thead");
  const headRow = ownerDocument.createElement("tr");
  const body = ownerDocument.createElement("tbody");

  table.className = "typai-ui-debug-table";
  caption.textContent = "Recent local Typai events";
  table.appendChild(caption);

  for (const label of ["Time", "Source", "Action", "Outcome", "Reasons", "Latency"]) {
    const header = ownerDocument.createElement("th");

    header.scope = "col";
    header.textContent = label;
    headRow.appendChild(header);
  }

  head.appendChild(headRow);
  table.appendChild(head);

  for (const event of events) {
    const row = ownerDocument.createElement("tr");

    row.setAttribute("data-typai-debug-row", "true");
    appendCell(row, event.time);
    appendCell(row, event.source);
    appendCell(row, event.action);
    appendCell(row, event.outcome);
    appendCell(row, event.reasonCodes?.join(", ") ?? "");
    appendCell(row, formatLatency(event.latencyMs));
    body.appendChild(row);
  }

  table.appendChild(body);

  return table;
}

function appendCell(row: HTMLTableRowElement, value: string): void {
  const cell = row.ownerDocument.createElement("td");

  cell.textContent = value;
  row.appendChild(cell);
}

function getP95(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return sorted[index];
}

function formatLatency(value: number | undefined): string {
  return value === undefined ? "-" : `${value.toFixed(1)} ms`;
}

function resolveOwnerDocument(
  ownerDocument: Document | undefined,
  parent: HTMLElement | undefined,
): Document {
  const resolved = ownerDocument ?? parent?.ownerDocument ?? globalThis.document;

  if (resolved === undefined) {
    throw new Error("@typai/ui requires a DOM Document.");
  }

  return resolved;
}
