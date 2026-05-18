import { expect } from "vitest";

import type { AdapterMark } from "./types";

export function expectBlueMark(marks: AdapterMark[]): AdapterMark {
  const mark = marks.find((candidate) => candidate.kind === "blue_applied_correction");

  expect(mark).toBeDefined();

  return mark as AdapterMark;
}

export function expectRedMark(marks: AdapterMark[]): AdapterMark {
  const mark = marks.find((candidate) => candidate.kind === "red_spelling_issue");

  expect(mark).toBeDefined();

  return mark as AdapterMark;
}

export function expectNoBlueMarks(marks: AdapterMark[]): void {
  expect(marks.filter((mark) => mark.kind === "blue_applied_correction")).toHaveLength(0);
}

export function expectNoTransactions(transactions: unknown[]): void {
  expect(transactions).toHaveLength(0);
}

export function expectPlainSourceText(text: string): void {
  expect(text).not.toContain("<");
  expect(text).not.toContain(">");
  expect(text).not.toContain("span");
  expect(text).not.toContain("data-typai");
}
