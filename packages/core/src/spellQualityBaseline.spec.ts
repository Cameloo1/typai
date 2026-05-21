import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createTypaiCore } from "./createTypaiCore";
import { classifyToken } from "./protectedSpans";
import type { TypaiCore } from "./types";

const mockDictionaryUrl = new URL("../assets/mock-en-us.dictionary.json", import.meta.url);
const mockDictionaryBinUrl = new URL("../assets/mock-en-us.dictionary.bin", import.meta.url);

const supportedTypos = [
  { token: "teh", replacement: "the" },
  { token: "adn", replacement: "and" },
  { token: "recieve", replacement: "receive" },
  { token: "becuase", replacement: "because" },
  { token: "thier", replacement: "their" },
];

const broadCommonMisspellings = [
  { token: "adress", replacement: "address" },
  { token: "speling", replacement: "spelling" },
  { token: "corection", replacement: "correction" },
  { token: "seperate", replacement: "separate" },
  { token: "definitly", replacement: "definitely" },
  { token: "accomodate", replacement: "accommodate" },
  { token: "occured", replacement: "occurred" },
  { token: "untill", replacement: "until" },
  { token: "tommorow", replacement: "tomorrow" },
  { token: "goverment", replacement: "government" },
  { token: "enviroment", replacement: "environment" },
  { token: "arguement", replacement: "argument" },
  { token: "calender", replacement: "calendar" },
  { token: "embarass", replacement: "embarrass" },
  { token: "publically", replacement: "publicly" },
  { token: "neccessary", replacement: "necessary" },
];

const suggestionsOnlyMisspellings = [
  { token: "reciept", suggestions: ["receipt"] },
  { token: "addres", suggestions: ["address"] },
  { token: "separat", suggestions: ["separate"] },
  { token: "tomorow", suggestions: ["tomorrow"] },
  { token: "becaus", suggestions: ["because"] },
  { token: "calandar", suggestions: ["calendar"] },
  { token: "neccesary", suggestions: ["necessary"] },
  { token: "definately", suggestions: ["definitely"] },
  { token: "acommodate", suggestions: ["accommodate"] },
  { token: "dont", suggestions: ["don't"] },
  { token: "it;s", suggestions: ["it's"] },
  { token: "adresss", suggestions: ["address", "addresses"] },
];

const validWords = ["form", "lead", "to", "its", "there", "their", "from", "too", "led"];

const protectedTerms = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "~/project/src",
  "snake_case_identifier",
  "camelCaseIdentifier",
  "PascalCaseClass",
  "CVE-2024-1234",
  "nmap",
  "sqlmap",
  "ffuf",
  "gobuster",
  "kubectl",
  "iptables",
  "XSS",
  "CSRF",
  "API",
];

const reviewedFalsePositiveCandidates = ["Alice", "Cameloo", "Typai", "OpenAI", "BTC", "ETH"];

describe("spell quality baseline", () => {
  it("records the current mock dictionary fixture size", async () => {
    const fixture = JSON.parse(readFileSync(mockDictionaryUrl, "utf8")) as {
      entries: unknown[];
    };
    const core = await createTypaiCore({
      dictionary: {
        bytes: readFileSync(mockDictionaryBinUrl),
      },
    });

    expect(fixture.entries).toHaveLength(20);
    expect(core.getLoadedDictionaryWordCount()).toBe(20);
  });

  it.each(
    supportedTypos,
  )("records supported common typo autocorrect $token -> $replacement", async ({
    token,
    replacement,
  }) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "auto_correct",
      original: token,
      replacement,
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH", "AUTOCORRECT_GATE_PASSED"],
    });
  });

  it("records prompt 103 broad misspelling autocorrect coverage", async () => {
    const core = await createTypaiCore();

    for (const { token, replacement } of broadCommonMisspellings) {
      const decision = core.checkCompletedToken({ token });

      expect(decision.action, `${token} should pass the explicit common-typo gate`).toBe(
        "auto_correct",
      );

      if (decision.action === "auto_correct") {
        expect(decision.replacement).toBe(replacement);
        expect(decision.reasonCodes).toContain("COMMON_TYPO_TABLE_EXPANDED");
        expect(decision.reasonCodes).toContain("AUTOCORRECT_GATE_PASSED");
      }
    }
  });

  it("records prompt 103 suggestions-only cases without widening autocorrect", async () => {
    const core = await createTypaiCore();

    for (const { token, suggestions } of suggestionsOnlyMisspellings) {
      const decision = core.checkCompletedToken({ token });

      expect(decision.action, `${token} should stay suggestion-only`).toBe("mark_unresolved");

      if (decision.action === "mark_unresolved") {
        expect(decision.suggestions).toEqual(expect.arrayContaining(suggestions));
        expect(decision.reasonCodes).toContain("AUTOCORRECT_GATE_BLOCKED");
      }
    }
  });

  it.each(validWords)("keeps valid word $0 out of autocorrect", async (token) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "do_nothing",
      reasonCodes: ["KNOWN_VALID_WORD", "VALID_WORD_BLOCK"],
    });
  });

  it.each(protectedTerms)("keeps protected term $0 out of autocorrect", async (token) => {
    const core = await createTypaiCore();
    const classification = classifyToken(token);
    const decision = core.checkCompletedToken({ token });

    expect(
      classification.protected || decision.reasonCodes.includes("PROTECTED_TOKEN_BLOCK"),
      `${token} should be tokenizer-protected or blocked by the core protected-token gate`,
    ).toBe(true);
    expect(decision.action, `${token} must not be autocorrected`).toBe("do_nothing");
  });

  it.each(
    reviewedFalsePositiveCandidates,
  )("reviews false-positive candidate $0 without autocorrecting", async (token) => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token });

    expect(decision.action, `${token} must not be autocorrected`).not.toBe("auto_correct");
  });

  it("records kubectl as protected after prompt 103", async () => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token: "kubectl" });

    expect(classifyToken("kubectl").protected).toBe(true);
    expect(decision).toEqual({
      action: "do_nothing",
      reasonCodes: ["PROTECTED_LOOKING_TOKEN", "PROTECTED_TOKEN_BLOCK"],
    });
  });

  it("emits a compact baseline report for prompt 103", async () => {
    const core = await createTypaiCore();
    const report = buildBaselineReport(core);

    expect(report.supportedTypoAutocorrects).toBe(5);
    expect(report.broadMisspellingAutocorrects).toBe(16);
    expect(report.suggestionsOnlyAutocorrects).toBe(0);
    expect(report.suggestionsOnlySuggestions).toBe(12);
    expect(report.validWordAutocorrections).toBe(0);
    expect(report.protectedTermAutocorrections).toBe(0);
    expect(report.reviewedFalsePositiveAutocorrections).toBe(0);
    expect(report.currentProtectedTermGaps).toEqual([]);

    console.info("[typai spell-quality-baseline]", JSON.stringify(report));
  });
});

function buildBaselineReport(core: TypaiCore) {
  const broadDecisions = broadCommonMisspellings.map(({ token }) =>
    core.checkCompletedToken({ token }),
  );
  const suggestionsOnlyDecisions = suggestionsOnlyMisspellings.map(({ token }) =>
    core.checkCompletedToken({ token }),
  );
  const protectedTermDecisions = protectedTerms.map((token) => core.checkCompletedToken({ token }));
  const reviewedFalsePositiveDecisions = reviewedFalsePositiveCandidates.map((token) =>
    core.checkCompletedToken({ token }),
  );

  return {
    supportedTypoAutocorrects: supportedTypos.filter(
      ({ token }) => core.checkCompletedToken({ token }).action === "auto_correct",
    ).length,
    broadMisspellingAutocorrects: broadDecisions.filter(
      (decision) => decision.action === "auto_correct",
    ).length,
    suggestionsOnlyAutocorrects: suggestionsOnlyDecisions.filter(
      (decision) => decision.action === "auto_correct",
    ).length,
    suggestionsOnlySuggestions: suggestionsOnlyDecisions.filter(
      (decision) => decision.action === "mark_unresolved" && decision.suggestions.length > 0,
    ).length,
    validWordAutocorrections: validWords.filter(
      (token) => core.checkCompletedToken({ token }).action === "auto_correct",
    ).length,
    protectedTermAutocorrections: protectedTermDecisions.filter(
      (decision) => decision.action === "auto_correct",
    ).length,
    reviewedFalsePositiveAutocorrections: reviewedFalsePositiveDecisions.filter(
      (decision) => decision.action === "auto_correct",
    ).length,
    currentProtectedTermGaps: ["ffuf", "gobuster", "iptables", "kubectl"].filter(
      (token) => !classifyToken(token).protected,
    ),
  };
}
