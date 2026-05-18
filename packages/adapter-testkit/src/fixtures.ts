import type { CorrectionDecision, TypaiCore } from "@typai/core";

export type ConformanceTypaiCore = TypaiCore & {
  calls: string[];
  resetCalls(): void;
};

export type ConformanceTypaiCoreOptions = {
  beforeDecision?: (token: string) => void;
};

export function createConformanceTypaiCore(
  options: ConformanceTypaiCoreOptions = {},
): ConformanceTypaiCore {
  const calls: string[] = [];
  const personalDictionary = new Set<string>();
  const alwaysRules = new Map<string, string>();
  const neverRules = new Map<string, string>();

  return {
    calls,
    resetCalls() {
      calls.splice(0, calls.length);
    },
    checkCompletedToken(input) {
      const normalizedToken = input.token.toLowerCase();
      calls.push(input.token);
      options.beforeDecision?.(input.token);

      if (personalDictionary.has(normalizedToken)) {
        return {
          action: "do_nothing",
          reasonCodes: ["PERSONAL_DICTIONARY_MATCH"],
        };
      }

      const alwaysReplacement = alwaysRules.get(normalizedToken);

      if (alwaysReplacement !== undefined) {
        return {
          action: "auto_correct",
          original: input.token,
          replacement: alwaysReplacement,
          confidence: 1,
          mark: "blue_applied_correction",
          reasonCodes: ["ALWAYS_CORRECT_RULE"],
        };
      }

      return conformanceDecisionForToken(input.token, neverRules);
    },
    suggestToken(input) {
      if (input.token === "reciept") {
        return {
          suggestions: ["receipt"],
          scores: [1],
          reasonCodes: ["EDIT_DISTANCE_SUGGESTIONS"],
        };
      }

      return { suggestions: [], scores: [], reasonCodes: [] };
    },
    getLoadedDictionaryWordCount() {
      return 0;
    },
    clearLoadedDictionary() {},
    async addToPersonalDictionary(word) {
      personalDictionary.add(word.toLowerCase());
    },
    async removeFromPersonalDictionary(word) {
      personalDictionary.delete(word.toLowerCase());
    },
    isInPersonalDictionary(word) {
      return personalDictionary.has(word.toLowerCase());
    },
    async setAlwaysCorrect(original, replacement) {
      alwaysRules.set(original.toLowerCase(), replacement);
    },
    async setNeverCorrect(original, replacement) {
      neverRules.set(original.toLowerCase(), replacement);
    },
    async clearCorrectionRule(original, replacement) {
      const normalizedOriginal = original.toLowerCase();

      if (replacement === undefined || alwaysRules.get(normalizedOriginal) === replacement) {
        alwaysRules.delete(normalizedOriginal);
      }

      if (replacement === undefined || neverRules.get(normalizedOriginal) === replacement) {
        neverRules.delete(normalizedOriginal);
      }
    },
    getCorrectionRule(original, replacement) {
      const normalizedOriginal = original.toLowerCase();
      const alwaysReplacement = alwaysRules.get(normalizedOriginal);
      const neverReplacement = neverRules.get(normalizedOriginal);

      if (
        alwaysReplacement !== undefined &&
        (replacement === undefined || replacement === alwaysReplacement)
      ) {
        return {
          original: normalizedOriginal,
          replacement: alwaysReplacement,
          status: "always",
          createdAt: 1,
          updatedAt: 1,
        };
      }

      if (
        neverReplacement !== undefined &&
        (replacement === undefined || replacement === neverReplacement)
      ) {
        return {
          original: normalizedOriginal,
          replacement: neverReplacement,
          status: "never",
          createdAt: 1,
          updatedAt: 1,
        };
      }

      return null;
    },
    async exportTypaiMemory() {
      return {
        version: 1,
        exportedAt: new Date(0).toISOString(),
        personalDictionary: [...personalDictionary].map((word) => ({
          word,
          createdAt: 1,
        })),
        correctionRules: [
          ...[...alwaysRules].map(([original, replacement]) => ({
            original,
            replacement,
            status: "always" as const,
            createdAt: 1,
            updatedAt: 1,
          })),
          ...[...neverRules].map(([original, replacement]) => ({
            original,
            replacement,
            status: "never" as const,
            createdAt: 1,
            updatedAt: 1,
          })),
        ],
      };
    },
    async importTypaiMemory() {},
    async resetTypaiMemory() {
      personalDictionary.clear();
      alwaysRules.clear();
      neverRules.clear();
    },
  };
}

export function conformanceDecisionForToken(
  token: string,
  neverRules = new Map<string, string>(),
): CorrectionDecision {
  if (neverRules.get(token.toLowerCase()) === "the") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: ["the"],
      mark: "red_spelling_issue",
      reasonCodes: ["COMMON_TYPO_MATCH", "NEVER_CORRECT_RULE"],
    };
  }

  if (token === "teh") {
    return {
      action: "auto_correct",
      original: "teh",
      replacement: "the",
      confidence: 0.99,
      mark: "blue_applied_correction",
      reasonCodes: ["COMMON_TYPO_MATCH"],
    };
  }

  if (token === "reciept") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: ["receipt"],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD", "EDIT_DISTANCE_SUGGESTIONS"],
    };
  }

  if (token === "zzzzword") {
    return {
      action: "mark_unresolved",
      original: token,
      suggestions: [],
      mark: "red_spelling_issue",
      reasonCodes: ["UNKNOWN_NON_WORD"],
    };
  }

  return {
    action: "do_nothing",
    reasonCodes: ["KNOWN_VALID_WORD"],
  };
}
