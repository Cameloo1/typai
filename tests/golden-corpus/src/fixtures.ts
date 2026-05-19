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
  { token: "Teh", replacement: "The" },
  { token: "TEH", replacement: "THE" },
  { token: "teh,", replacement: "the," },
  { token: "adn", replacement: "and" },
  { token: "recieve", replacement: "receive" },
  { token: "becuase", replacement: "because" },
  { token: "thier", replacement: "their" },
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

export const mustNotAutocorrect: TokenCase[] = [
  { token: "form", reason: "known valid word" },
  { token: "their", reason: "known valid word" },
  { token: "its", reason: "known valid word" },
  { token: "lead", reason: "known valid word" },
  { token: "to", reason: "known valid word" },
  { token: "nmap", reason: "technical term" },
  { token: "sqlmap", reason: "technical term" },
  { token: "kubectl", reason: "technical term" },
  { token: "CVE-2024-1234", reason: "security identifier" },
  { token: "/etc/passwd", reason: "filesystem path" },
  { token: "camelCaseIdentifier", reason: "camelCase identifier" },
  { token: "snake_case_identifier", reason: "snake_case identifier" },
  { token: "PascalCaseClass", reason: "PascalCase identifier" },
  { token: "NASA", reason: "uppercase acronym-shaped token" },
  { token: "https://example.com", reason: "URL" },
  { token: "user@example.com", reason: "email address" },
];

export const unresolvedNonWords: TokenCase[] = [
  { token: "zzzzword", reason: "unknown lowercase alphabetic non-word" },
];

export const unresolvedSuggestionCases: SuggestionCase[] = [
  { token: "reciept", suggestion: "receipt" },
  { token: "addres", suggestion: "address" },
  { token: "dont", suggestion: "don't" },
  { token: "it;s", suggestion: "it's" },
  { token: "adresss", suggestion: "address" },
];

export const surfaceParityAutocorrections: AllowedAutocorrectionCase[] = [
  { token: "adress", replacement: "address" },
  { token: "speling", replacement: "spelling" },
  { token: "corection", replacement: "correction" },
  { token: "seperate", replacement: "separate" },
  { token: "definitly", replacement: "definitely" },
];

export const surfaceParityValidWords = ["form", "lead", "to", "its", "there", "their"];

export const surfaceParityProtectedTerms = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "snake_case_identifier",
  "camelCaseIdentifier",
  "CVE-2024-1234",
  "nmap",
  "sqlmap",
  "kubectl",
];
