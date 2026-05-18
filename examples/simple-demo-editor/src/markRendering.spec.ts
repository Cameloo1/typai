import type { CorrectionTransaction } from "@typai/contenteditable";
import { describe, expect, it } from "vitest";

import {
  buildRevertResult,
  type DemoMark,
  pruneStaleMarks,
  renderMarkedText,
  replaceRangeText,
  shiftMarksAfterEdit,
} from "./markRendering";

describe("demo mark rendering", () => {
  it("renders a blue dotted mark for an applied correction", () => {
    const html = renderMarkedText("the ", [
      {
        id: "mark-1",
        range: { start: 0, end: 3 },
        kind: "blue_applied_correction",
        correctionEventId: "correction-1",
        original: "teh",
        replacement: "the",
        text: "the",
      },
    ]);

    expect(html).toContain("typai-mark-blue");
    expect(html).toContain('data-correction-id="correction-1"');
    expect(html).toContain('data-typai-mark-id="mark-1"');
    expect(html).toContain('data-typai-mark-kind="blue_applied_correction"');
    expect(html).toContain('data-typai-original="teh"');
    expect(html).toContain('data-typai-replacement="the"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain(">the</span>");
  });

  it("renders a red squiggly mark for an unresolved word", () => {
    const html = renderMarkedText("zzzzword ", [
      {
        id: "mark-1",
        range: { start: 0, end: 8 },
        kind: "red_spelling_issue",
        text: "zzzzword",
      },
    ]);

    expect(html).toContain("typai-mark-red");
    expect(html).toContain('data-typai-mark-id="mark-1"');
    expect(html).toContain('data-typai-mark-kind="red_spelling_issue"');
    expect(html).toContain('aria-label="Spelling issue: zzzzword. Open spelling actions."');
    expect(html).toContain(">zzzzword</span>");
  });

  it("does not render nested typai mark spans for overlapping marks", () => {
    const html = renderMarkedText("the ", [
      {
        id: "mark-1",
        range: { start: 0, end: 3 },
        kind: "blue_applied_correction",
        correctionEventId: "correction-1",
        text: "the",
      },
      {
        id: "mark-2",
        range: { start: 1, end: 3 },
        kind: "red_spelling_issue",
        text: "he",
      },
    ]);

    expect(html.match(/class="typai-mark/g) ?? []).toHaveLength(1);
  });

  it("builds direct click-to-revert text for a blue correction", () => {
    const correction = correctionTransaction();
    const mark: DemoMark = {
      id: "mark-1",
      range: { start: 0, end: 3 },
      kind: "blue_applied_correction",
      correctionEventId: correction.id,
      text: "the",
    };

    expect(buildRevertResult("the ", mark, correction)).toEqual({
      text: "teh ",
      caretOffset: 3,
      revertedRange: { start: 0, end: 3 },
    });
  });

  it("reverts exactly without losing punctuation or whitespace", () => {
    const correction = correctionTransaction();
    const mark: DemoMark = {
      id: "mark-1",
      range: { start: 0, end: 3 },
      kind: "blue_applied_correction",
      correctionEventId: correction.id,
      text: "the",
    };

    expect(buildRevertResult("the, next ", mark, correction)?.text).toBe("teh, next ");
  });

  it("removes the blue mark after revert", () => {
    const correction = correctionTransaction();
    const mark: DemoMark = {
      id: "mark-1",
      range: { start: 0, end: 3 },
      kind: "blue_applied_correction",
      correctionEventId: correction.id,
      text: "the",
    };
    const result = buildRevertResult("the ", mark, correction);
    const remainingMarks = pruneStaleMarks(
      result?.text ?? "",
      shiftMarksAfterEdit([], mark.range, correction.original.length),
    );

    expect(result?.text).toBe("teh ");
    expect(remainingMarks).toEqual([]);
  });

  it("drops marks when their word text changes", () => {
    const marks: DemoMark[] = [
      {
        id: "mark-1",
        range: { start: 0, end: 3 },
        kind: "blue_applied_correction",
        correctionEventId: "correction-1",
        text: "the",
      },
    ];

    expect(pruneStaleMarks("the typed later", marks)).toHaveLength(1);
    expect(pruneStaleMarks("then typed later", marks)).toHaveLength(0);
    expect(pruneStaleMarks("teh typed later", marks)).toHaveLength(0);
  });

  it("keeps valid words and protected tokens unmarked by rendering plain text", () => {
    expect(renderMarkedText("form user@example.com ", [])).toBe("form user@example.com ");
  });

  it("replaces and shifts marked ranges without persistence", () => {
    const replaced = replaceRangeText("the zzzzword ", { start: 0, end: 3 }, "teh");
    const shifted = shiftMarksAfterEdit(
      [
        {
          id: "mark-2",
          range: { start: 4, end: 12 },
          kind: "red_spelling_issue",
          text: "zzzzword",
        },
      ],
      { start: 0, end: 3 },
      3,
    );

    expect(replaced).toBe("teh zzzzword ");
    expect(shifted[0]?.range).toEqual({ start: 4, end: 12 });
  });
});

function correctionTransaction(): CorrectionTransaction {
  return {
    id: "correction-1",
    documentVersion: 2,
    rangeBefore: {
      start: 0,
      end: 3,
      text: "teh",
    },
    rangeAfter: {
      start: 0,
      end: 3,
      text: "the",
    },
    original: "teh",
    replacement: "the",
    trigger: "space",
    confidence: 0.99,
    reasonCodes: ["COMMON_TYPO_MATCH"],
    createdAt: 1,
  };
}
