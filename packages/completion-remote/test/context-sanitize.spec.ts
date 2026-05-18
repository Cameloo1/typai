import { describe, expect, it } from "vitest";
import {
  buildContinuationInstruction,
  buildEndpointPayload,
  createCompletionRequest,
  extractCompletionContext,
  sanitizeCompletionText,
  trimDuplicateCompletionPrefix,
} from "../src";

describe("completion context extraction", () => {
  it("extracts bounded context before and after the cursor", () => {
    const fullText = `${"a".repeat(2100)}CURSOR${"b".repeat(400)}`;
    const cursorOffset = 2106;

    const context = extractCompletionContext({
      fullText,
      cursorOffset,
      mode: "prompt",
    });

    expect(context.contextBefore).toHaveLength(2000);
    expect(context.contextBefore.endsWith("CURSOR")).toBe(true);
    expect(context.contextAfter).toHaveLength(300);
    expect(context.contextAfter).toBe("b".repeat(300));
    expect(context.cursorOffset).toBe(context.contextBefore.length);
  });

  it("does not include the full document by default", () => {
    const fullText = `${"before ".repeat(500)}cursor${" after".repeat(500)}`;
    const context = extractCompletionContext({
      fullText,
      cursorOffset: fullText.indexOf("cursor") + "cursor".length,
      mode: "prose",
    });

    expect(context.contextBefore.length + context.contextAfter.length).toBeLessThan(
      fullText.length,
    );
    expect(context.contextBefore).toHaveLength(2000);
    expect(context.contextAfter).toHaveLength(300);
  });

  it("respects beforeChars and afterChars", () => {
    const context = extractCompletionContext({
      fullText: "0123456789abcdefghij",
      cursorOffset: 10,
      mode: "markdown",
      options: {
        beforeChars: 4,
        afterChars: 3,
      },
    });

    expect(context.contextBefore).toBe("6789");
    expect(context.contextAfter).toBe("abc");
    expect(context.cursorOffset).toBe(4);
  });

  it("supports custom redaction hooks", () => {
    const context = extractCompletionContext({
      fullText: "token=secret\nContinue here",
      cursorOffset: "token=secret\nContinue".length,
      mode: "prompt",
      options: {
        redact({ textBefore, textAfter, mode }) {
          return {
            contextBefore: textBefore.replace("secret", "[redacted]"),
            contextAfter: textAfter,
            metadata: {
              redacted: true,
              mode,
            },
          };
        },
      },
    });

    expect(context.contextBefore).toContain("token=[redacted]");
    expect(context.contextBefore).not.toContain("secret");
    expect(context.metadata).toEqual({
      redacted: true,
      mode: "prompt",
    });
  });

  it("extracts the current line from bounded context", () => {
    const context = extractCompletionContext({
      fullText: "line one\nline two partial",
      cursorOffset: "line one\nline two".length,
      mode: "prose",
    });

    expect(context.currentLine).toBe("line two");
  });

  it("builds continuation instructions with V4 constraints", () => {
    const instruction = buildContinuationInstruction();

    expect(instruction).toMatchObject({
      task: "continue",
      style: "same_voice",
      output: "continuation_only",
    });
    expect(instruction.constraints).toEqual(
      expect.arrayContaining([
        "Continue from the cursor.",
        "Return only text that should be inserted at the cursor.",
        "Do not answer the user.",
        "Do not explain the completion.",
        "Do not quote the completion.",
        "Do not repeat text that already appears before the cursor.",
        "Match the existing voice, tone, formatting, and markdown style.",
        "Stop at a natural short boundary.",
        "Return an empty string when no useful continuation exists.",
      ]),
    );
  });

  it("builds endpoint payloads without changing the request", () => {
    const request = createCompletionRequest({
      id: "request-1",
      mode: "prompt",
      contextBefore: "hello",
    });

    expect(buildEndpointPayload(request)).toEqual({ request });
  });
});

describe("completion sanitization", () => {
  it("trims duplicated completion prefixes and preserves returned separator spacing", () => {
    const text = sanitizeCompletionText({
      text: "Can you help me understand this",
      contextBefore: "Can you help me",
      maxCompletionChars: 220,
    });

    expect(text).toBe(" understand this");
  });

  it("trims duplicated suffix-prefix overlap", () => {
    expect(
      trimDuplicateCompletionPrefix("brown fox jumps over the fence", "The quick brown fox"),
    ).toBe(" jumps over the fence");
  });

  it("enforces max completion characters", () => {
    const text = sanitizeCompletionText("abcdef", {
      maxCompletionChars: 3,
    });

    expect(text).toBe("abc");
  });

  it("returns empty for whitespace-only completions", () => {
    expect(sanitizeCompletionText(" \n\t ", { maxCompletionChars: 220 })).toBe("");
  });

  it("unquotes quoted continuations when safe", () => {
    const text = sanitizeCompletionText({
      text: '" continue here "',
      contextBefore: "Please",
      maxCompletionChars: 220,
    });

    expect(text).toBe(" continue here");
  });

  it("applies stop sequences before max character enforcement", () => {
    const text = sanitizeCompletionText("abcSTOPdef", {
      maxCompletionChars: 10,
      stopSequences: ["STOP"],
    });

    expect(text).toBe("abc");
  });
});
