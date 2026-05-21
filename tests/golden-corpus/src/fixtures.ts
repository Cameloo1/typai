export interface AllowedAutocorrectionCase {
  token: string;
  replacement: string;
}

export interface TokenCase {
  token: string;
  reason: string;
  category?: string;
}

export interface SuggestionCase {
  token: string;
  suggestion: string;
  category: string;
}

export const allowedAutocorrections: AllowedAutocorrectionCase[] = [
  { token: "teh", replacement: "the" },
  { token: "Teh", replacement: "The" },
  { token: "TEH", replacement: "THE" },
  { token: "teh,", replacement: "the," },
  { token: "teh.", replacement: "the." },
  { token: "Adress", replacement: "Address" },
  { token: "adress.", replacement: "address." },
  { token: "definitly!", replacement: "definitely!" },
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
  { token: "form", reason: "known valid word", category: "valid-word trap" },
  { token: "lead", reason: "known valid word", category: "valid-word trap" },
  { token: "to", reason: "known valid word", category: "valid-word trap" },
  { token: "its", reason: "known valid word", category: "valid-word trap" },
  { token: "it's", reason: "known valid word", category: "valid-word trap" },
  { token: "there", reason: "known valid word", category: "valid-word trap" },
  { token: "their", reason: "known valid word", category: "valid-word trap" },
  { token: "from", reason: "known valid word", category: "valid-word trap" },
  { token: "too", reason: "known valid word", category: "valid-word trap" },
  { token: "led", reason: "known valid word", category: "valid-word trap" },
  { token: "user@example.com", reason: "email address", category: "protected structured token" },
  { token: "https://example.com", reason: "URL", category: "protected structured token" },
  { token: "/etc/passwd", reason: "filesystem path", category: "protected structured token" },
  {
    token: "C:\\Work\\typai\\project",
    reason: "Windows filesystem path",
    category: "protected structured token",
  },
  { token: "~/project/src", reason: "home-relative path", category: "protected structured token" },
  { token: "@typai/core", reason: "scoped package name", category: "protected structured token" },
  {
    token: "OPENAI_API_KEY",
    reason: "environment variable placeholder",
    category: "protected structured token",
  },
  {
    token: "snake_case_identifier",
    reason: "snake_case identifier",
    category: "protected structured token",
  },
  {
    token: "camelCaseIdentifier",
    reason: "camelCase identifier",
    category: "protected structured token",
  },
  {
    token: "PascalCaseClass",
    reason: "PascalCase identifier",
    category: "protected structured token",
  },
  { token: "CVE-2024-1234", reason: "security identifier", category: "protected structured token" },
  { token: "nmap", reason: "technical term", category: "technical/security term" },
  { token: "sqlmap", reason: "technical term", category: "technical/security term" },
  { token: "ffuf", reason: "technical term", category: "technical/security term" },
  { token: "gobuster", reason: "technical term", category: "technical/security term" },
  { token: "kubectl", reason: "technical term", category: "technical/security term" },
  { token: "iptables", reason: "technical term", category: "technical/security term" },
  { token: "XSS", reason: "uppercase acronym-shaped token", category: "acronym" },
  { token: "CSRF", reason: "uppercase acronym-shaped token", category: "acronym" },
  { token: "API", reason: "uppercase acronym-shaped token", category: "acronym" },
  { token: "NASA", reason: "uppercase acronym-shaped token", category: "acronym" },
  { token: "SQL", reason: "uppercase acronym-shaped token", category: "acronym" },
  { token: "HTTP", reason: "uppercase acronym-shaped token", category: "acronym" },
  { token: "BTC", reason: "trading ticker", category: "trading/domain term" },
  { token: "ETH", reason: "trading ticker", category: "trading/domain term" },
  { token: "SPY", reason: "trading ticker", category: "trading/domain term" },
  { token: "NVDA", reason: "trading ticker", category: "trading/domain term" },
];

export const falsePositiveReviewCases: TokenCase[] = [
  { token: "Alice", reason: "proper noun", category: "proper noun" },
  { token: "Cameloo", reason: "proper noun", category: "proper noun" },
  { token: "Typai", reason: "proper noun/product name", category: "proper noun" },
  { token: "OpenAI", reason: "mixed-case product name", category: "proper noun" },
];

export const unresolvedNonWords: TokenCase[] = [
  { token: "zzzzword", reason: "unknown lowercase alphabetic non-word" },
];

export const unresolvedSuggestionCases: SuggestionCase[] = [
  { token: "reciept", suggestion: "receipt", category: "delete-index misspelling" },
  { token: "addres", suggestion: "address", category: "delete-index misspelling" },
  { token: "separat", suggestion: "separate", category: "delete-index misspelling" },
  { token: "tomorow", suggestion: "tomorrow", category: "delete-index misspelling" },
  { token: "becaus", suggestion: "because", category: "delete-index misspelling" },
  { token: "calandar", suggestion: "calendar", category: "delete-index misspelling" },
  { token: "neccesary", suggestion: "necessary", category: "delete-index misspelling" },
  { token: "definately", suggestion: "definitely", category: "delete-index misspelling" },
  { token: "acommodate", suggestion: "accommodate", category: "delete-index misspelling" },
  { token: "dont", suggestion: "don't", category: "contraction" },
  { token: "it;s", suggestion: "it's", category: "contraction punctuation" },
  { token: "adresss", suggestion: "address", category: "plural ambiguity" },
];

export const surfaceParityAutocorrections: AllowedAutocorrectionCase[] = [
  { token: "adress", replacement: "address" },
  { token: "speling", replacement: "spelling" },
  { token: "corection", replacement: "correction" },
  { token: "seperate", replacement: "separate" },
  { token: "definitly", replacement: "definitely" },
];

export const surfaceParitySuggestionCases: SuggestionCase[] = [
  { token: "reciept", suggestion: "receipt", category: "delete-index misspelling" },
  { token: "separat", suggestion: "separate", category: "delete-index misspelling" },
  { token: "adresss", suggestion: "address", category: "plural ambiguity" },
];

export const surfaceParityValidWords = [
  "form",
  "from",
  "lead",
  "led",
  "to",
  "too",
  "its",
  "it's",
  "there",
  "their",
];

export const surfaceParityProtectedTerms = [
  "user@example.com",
  "https://example.com",
  "/etc/passwd",
  "C:\\Work\\typai\\project",
  "~/project/src",
  "@typai/core",
  "OPENAI_API_KEY",
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
