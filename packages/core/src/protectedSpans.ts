import type { Token, TokenType } from "./types";

const codeLikeTokens = new Set(["kubectl", "nmap", "sqlmap"]);

export function classifyToken(text: string): Pick<Token, "tokenType" | "protected"> {
  const token = text.trim();

  if (token.length === 0) {
    return protectedToken("mixed");
  }

  if (isMarkdownCodeFence(token) || isInlineCode(token) || isCodeLikeText(token)) {
    return protectedToken("code");
  }

  if (/^https?:\/\/\S+$/i.test(token)) {
    return protectedToken("url");
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) {
    return protectedToken("email");
  }

  if (isPathLike(token)) {
    return protectedToken("path");
  }

  if (/^\d+(?:\.\d+)?$/.test(token)) {
    return protectedToken("number");
  }

  if (isWordLike(token)) {
    return {
      tokenType: "word",
      protected: false,
    };
  }

  if (isIdentifierLike(token)) {
    return protectedToken("identifier");
  }

  if (isMixedToken(token)) {
    return protectedToken("mixed");
  }

  return protectedToken("mixed");
}

export function isProtectedTokenText(text: string): boolean {
  return classifyToken(text).protected;
}

function protectedToken(tokenType: TokenType): Pick<Token, "tokenType" | "protected"> {
  return {
    tokenType,
    protected: true,
  };
}

function isMarkdownCodeFence(text: string): boolean {
  return text.startsWith("```") || text.endsWith("```");
}

function isInlineCode(text: string): boolean {
  return text.length >= 2 && text.startsWith("`") && text.endsWith("`");
}

function isCodeLikeText(text: string): boolean {
  return (
    codeLikeTokens.has(text) ||
    /\b(const|let|var|function|return|class|import|export)\b/.test(text) ||
    /[=;{}]/.test(text)
  );
}

function isPathLike(text: string): boolean {
  return (
    text.startsWith("/") ||
    text.startsWith("~/") ||
    text.startsWith("./") ||
    text.startsWith("../") ||
    /^[A-Za-z]:[\\/]/.test(text) ||
    text.includes("\\")
  );
}

function isIdentifierLike(text: string): boolean {
  return (
    /^[a-z]+(?:[A-Z][A-Za-z0-9]*)+$/.test(text) ||
    /^[A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+$/.test(text) ||
    /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(text)
  );
}

function isWordLike(text: string): boolean {
  return (
    /^[a-z]+(?:'[a-z]+)?$/.test(text) ||
    /^[A-Z][a-z]+(?:'[a-z]+)?$/.test(text) ||
    /^[A-Z]+(?:'[A-Z]+)?$/.test(text)
  );
}

function isMixedToken(text: string): boolean {
  if (!isAscii(text)) {
    return true;
  }

  return (
    /[A-Za-z]/.test(text) && (/\d/.test(text) || /[-_.:@/\\]/.test(text) || /[A-Z]/.test(text))
  );
}

function isAscii(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 0x7f) {
      return false;
    }
  }

  return true;
}
