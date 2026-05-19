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
  { token: "adress", suggestions: ["address"] },
  { token: "speling", suggestions: ["spelling"] },
  { token: "corection", suggestions: ["correction"] },
  { token: "seperate", suggestions: [] },
  { token: "definitly", suggestions: [] },
  { token: "accomodate", suggestions: [] },
  { token: "occured", suggestions: [] },
  { token: "untill", suggestions: [] },
  { token: "tommorow", suggestions: [] },
  { token: "goverment", suggestions: [] },
  { token: "enviroment", suggestions: [] },
  { token: "arguement", suggestions: [] },
  { token: "calender", suggestions: [] },
  { token: "embarass", suggestions: [] },
  { token: "publically", suggestions: [] },
  { token: "neccessary", suggestions: [] },
];

const validWords = ["form", "lead", "to", "its", "there", "their"];

const protectedTerms = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "snake_case_identifier",
  "camelCaseIdentifier",
  "CVE-2024-1234",
  "nmap",
  "sqlmap",
];

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
      reasonCodes: ["COMMON_TYPO_MATCH"],
    });
  });

  it("records current broad misspelling weakness without widening autocorrect", async () => {
    const core = await createTypaiCore();

    for (const { token, suggestions } of broadCommonMisspellings) {
      const decision = core.checkCompletedToken({ token });

      expect(decision.action, `${token} should stay suggestion-only today`).toBe("mark_unresolved");

      if (decision.action !== "mark_unresolved") {
        continue;
      }

      expect(decision.mark).toBe("red_spelling_issue");
      expect(decision.suggestions).toEqual(suggestions);
      expect(decision.reasonCodes).toContain("UNKNOWN_NON_WORD");
    }
  });

  it.each(validWords)("keeps valid word $0 out of autocorrect", async (token) => {
    const core = await createTypaiCore();

    expect(core.checkCompletedToken({ token })).toEqual({
      action: "do_nothing",
      reasonCodes: ["KNOWN_VALID_WORD"],
    });
  });

  it.each(protectedTerms)("keeps protected term $0 out of autocorrect", async (token) => {
    const core = await createTypaiCore();
    const classification = classifyToken(token);
    const decision = core.checkCompletedToken({ token });

    expect(classification.protected, `${token} should be tokenizer-protected`).toBe(true);
    expect(decision.action, `${token} must not be autocorrected`).toBe("do_nothing");
  });

  it("records kubectl as a current protected-term gap", async () => {
    const core = await createTypaiCore();
    const decision = core.checkCompletedToken({ token: "kubectl" });

    expect(classifyToken("kubectl").protected).toBe(false);
    expect(decision).toEqual({
      action: "mark_unresolved",
      original: "kubectl",
      suggestions: [],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD", "NO_SUGGESTIONS"],
    });
  });

  it("emits a compact baseline report for prompt 99", async () => {
    const core = await createTypaiCore();
    const report = buildBaselineReport(core);

    expect(report.supportedTypoAutocorrects).toBe(5);
    expect(report.broadMisspellingAutocorrects).toBe(0);
    expect(report.broadMisspellingSuggestions).toBe(3);
    expect(report.validWordAutocorrections).toBe(0);
    expect(report.protectedTermAutocorrections).toBe(0);
    expect(report.currentProtectedTermGaps).toEqual(["kubectl"]);

    console.info("[typai spell-quality-baseline]", JSON.stringify(report));
  });
});

function buildBaselineReport(core: TypaiCore) {
  const broadDecisions = broadCommonMisspellings.map(({ token }) =>
    core.checkCompletedToken({ token }),
  );
  const protectedTermDecisions = [...protectedTerms, "kubectl"].map((token) =>
    core.checkCompletedToken({ token }),
  );

  return {
    supportedTypoAutocorrects: supportedTypos.filter(
      ({ token }) => core.checkCompletedToken({ token }).action === "auto_correct",
    ).length,
    broadMisspellingAutocorrects: broadDecisions.filter(
      (decision) => decision.action === "auto_correct",
    ).length,
    broadMisspellingSuggestions: broadDecisions.filter(
      (decision) => decision.action === "mark_unresolved" && decision.suggestions.length > 0,
    ).length,
    validWordAutocorrections: validWords.filter(
      (token) => core.checkCompletedToken({ token }).action === "auto_correct",
    ).length,
    protectedTermAutocorrections: protectedTermDecisions.filter(
      (decision) => decision.action === "auto_correct",
    ).length,
    currentProtectedTermGaps: ["kubectl"].filter((token) => !classifyToken(token).protected),
  };
}
