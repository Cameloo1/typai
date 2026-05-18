import type { TypaiCore } from "@typai/core";
import { createTypaiCore } from "@typai/core";
import { beforeAll, describe, expect, it } from "vitest";

import {
  allowedAutocorrections,
  mustNotAutocorrect,
  unresolvedNonWords,
  unresolvedSuggestionCases,
} from "./fixtures";

describe("Typai V1A-dev golden corpus", () => {
  let typai: TypaiCore;

  beforeAll(async () => {
    typai = await createTypaiCore();
  });

  it.each(allowedAutocorrections)("auto-corrects $token -> $replacement", ({
    token,
    replacement,
  }) => {
    const decision = typai.checkCompletedToken({ token });

    expect(decision, `${token} should be an allowed deterministic autocorrection`).toMatchObject({
      action: "auto_correct",
      original: token,
      replacement,
      mark: "blue_applied_correction",
    });

    expect(decision.action, `${token} should autocorrect`).toBe("auto_correct");
    expect(decision.confidence, `${token} should have high confidence`).toBeGreaterThan(0.9);
  });

  it.each(mustNotAutocorrect)("does not auto-correct $token ($reason)", ({ token, reason }) => {
    const decision = typai.checkCompletedToken({ token });

    expect(decision.action, `${token} (${reason}) must not be autocorrected`).toBe("do_nothing");
  });

  it.each(unresolvedNonWords)("marks $token unresolved ($reason)", ({ token, reason }) => {
    const decision = typai.checkCompletedToken({ token });

    expect(decision, `${token} (${reason}) should be marked unresolved`).toMatchObject({
      action: "mark_unresolved",
      original: token,
      mark: "red_spelling_issue",
    });
  });

  it.each(unresolvedSuggestionCases)("suggests $suggestion for unresolved $token", ({
    token,
    suggestion,
  }) => {
    const decision = typai.checkCompletedToken({ token });

    expect(decision.action, `${token} should be a suggestion-only unresolved word`).toBe(
      "mark_unresolved",
    );

    if (decision.action !== "mark_unresolved") {
      return;
    }

    expect(decision.suggestions, `${token} should include ${suggestion}`).toContain(suggestion);
    expect(decision.mark).toBe("red_spelling_issue");
    expect(decision.reasonCodes).toContain("EDIT_DISTANCE_SUGGESTIONS");
  });
});
