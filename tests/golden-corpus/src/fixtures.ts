export interface AllowedAutocorrectionCase {
  token: string;
  replacement: string;
}

export interface TokenCase {
  token: string;
  reason: string;
}

export interface SuggestionCase {
  token: string;
  suggestion: string;
}

export const allowedAutocorrections: AllowedAutocorrectionCase[] = [
  { token: "teh", replacement: "the" },
  { token: "adn", replacement: "and" },
  { token: "recieve", replacement: "receive" },
  { token: "becuase", replacement: "because" },
  { token: "thier", replacement: "their" },
];

export const mustNotAutocorrect: TokenCase[] = [
  { token: "form", reason: "known valid word" },
  { token: "their", reason: "known valid word" },
  { token: "its", reason: "known valid word" },
  { token: "lead", reason: "known valid word" },
  { token: "to", reason: "known valid word" },
  { token: "nmap", reason: "technical term" },
  { token: "sqlmap", reason: "technical term" },
  { token: "CVE-2024-1234", reason: "security identifier" },
  { token: "/etc/passwd", reason: "filesystem path" },
  { token: "camelCaseIdentifier", reason: "camelCase identifier" },
  { token: "snake_case_identifier", reason: "snake_case identifier" },
  { token: "PascalCaseClass", reason: "PascalCase identifier" },
  { token: "https://example.com", reason: "URL" },
  { token: "user@example.com", reason: "email address" },
];

export const unresolvedNonWords: TokenCase[] = [
  { token: "zzzzword", reason: "unknown lowercase alphabetic non-word" },
];

export const unresolvedSuggestionCases: SuggestionCase[] = [
  { token: "reciept", suggestion: "receipt" },
  { token: "adress", suggestion: "address" },
  { token: "corection", suggestion: "correction" },
  { token: "speling", suggestion: "spelling" },
];
