import { describe, expect, it } from "vitest";

import { classifyToken, isProtectedTokenText } from "./protectedSpans";
import { getTokenBeforeOffset, isDelimiter } from "./tokenization";
import type { TokenType } from "./types";

describe("protected token classification", () => {
  it.each([
    ["https://example.com", "url"],
    ["http://example.com/path", "url"],
    ["user@example.com", "email"],
    ["123", "number"],
    ["12.5", "number"],
    ["abc123", "mixed"],
    ["CVE-2024-1234", "mixed"],
    ["camelCaseIdentifier", "identifier"],
    ["snake_case_identifier", "identifier"],
    ["PascalCaseClass", "identifier"],
    ["`nmap`", "code"],
    ["nmap", "code"],
    ["const x = 1", "code"],
    ["```ts\nconst x = 1\n```", "code"],
    ["ffuf", "code"],
    ["gobuster", "code"],
    ["iptables", "code"],
    ["kubectl", "code"],
    ["sqlmap", "code"],
    ["/etc/passwd", "path"],
    ["~/project/src", "path"],
    ["./src/index.ts", "path"],
    ["C:\\Users\\Name\\file.txt", "path"],
  ] satisfies Array<[string, TokenType]>)("protects %s as %s", (text, tokenType) => {
    expect(classifyToken(text), `${text} should be protected`).toEqual({
      tokenType,
      protected: true,
    });
    expect(isProtectedTokenText(text), `${text} should be protected`).toBe(true);
  });

  it.each([
    "teh",
    "Teh",
    "TEH",
    "hello",
    "Hello",
    "HELLO",
    "it's",
    "IT'S",
  ])("keeps word-shaped token %s unprotected for core gating", (text) => {
    expect(classifyToken(text)).toEqual({
      tokenType: "word",
      protected: false,
    });
  });

  it.each([
    "API",
    "SQL",
    "XSS",
  ])("lets acronym-shaped token %s reach core's uppercase safety gate", (text) => {
    expect(classifyToken(text)).toEqual({
      tokenType: "word",
      protected: false,
    });
  });

  it("keeps mixed-case identifiers protected", () => {
    expect(classifyToken("PascalCaseClass")).toEqual({
      tokenType: "identifier",
      protected: true,
    });
    expect(classifyToken("camelCaseIdentifier")).toEqual({
      tokenType: "identifier",
      protected: true,
    });
  });

  it.each(["teh", "hello", "it's"])("keeps plain word %s unprotected", (text) => {
    expect(classifyToken(text)).toEqual({
      tokenType: "word",
      protected: false,
    });
  });

  it("does not crash on non-ASCII text and protects it for V1A-dev", () => {
    expect(classifyToken("héllo")).toEqual({
      tokenType: "mixed",
      protected: true,
    });
  });
});

describe("tokenization", () => {
  it.each([
    ["teh ", 4, "teh", 0, 3],
    ["hello teh ", 10, "teh", 6, 9],
    ["hello, teh.", 11, "teh", 7, 10],
  ])("extracts %s before offset %s", (text, offset, tokenText, start, end) => {
    expect(getTokenBeforeOffset(text, offset)).toMatchObject({
      text: tokenText,
      range: { start, end },
      tokenType: "word",
      protected: false,
    });
  });

  it.each([
    ["user@example.com ", "user@example.com", "email"],
    ["snake_case_identifier ", "snake_case_identifier", "identifier"],
    ["nmap ", "nmap", "code"],
    ["ffuf ", "ffuf", "code"],
    ["iptables ", "iptables", "code"],
  ] satisfies Array<
    [string, string, TokenType]
  >)("extracts protected token from %s", (text, tokenText, tokenType) => {
    expect(getTokenBeforeOffset(text, text.length)).toMatchObject({
      text: tokenText,
      tokenType,
      protected: true,
    });
  });

  it("extracts a valid plain word", () => {
    expect(getTokenBeforeOffset("hello ", 6)).toMatchObject({
      text: "hello",
      normalized: "hello",
      range: { start: 0, end: 5 },
      tokenType: "word",
      protected: false,
    });
  });

  it("returns null when no token exists", () => {
    expect(getTokenBeforeOffset("", 0)).toBeNull();
    expect(getTokenBeforeOffset("   ", 3)).toBeNull();
    expect(getTokenBeforeOffset(".", 1)).toBeNull();
  });

  it("recognizes V1A delimiters", () => {
    for (const char of [" ", "\n", "\t", ".", ",", "!", "?", ";", ":", ")", "]", "}"]) {
      expect(isDelimiter(char), `${JSON.stringify(char)} should be a delimiter`).toBe(true);
    }

    expect(isDelimiter("'")).toBe(false);
    expect(isDelimiter("a")).toBe(false);
  });
});
