import { syntaxTree } from "@codemirror/language";
import type { EditorState, Text } from "@codemirror/state";
import type { Token } from "@typai/core";
import { getTokenBeforeOffset, isProtectedTokenText } from "@typai/core";

const shellCommandNames = new Set([
  "bash",
  "bun",
  "cargo",
  "cat",
  "cd",
  "chmod",
  "chown",
  "cmd",
  "cp",
  "curl",
  "deno",
  "docker",
  "git",
  "grep",
  "kubectl",
  "mkdir",
  "mv",
  "node",
  "npm",
  "npx",
  "pnpm",
  "powershell",
  "pwsh",
  "python",
  "python3",
  "rg",
  "rm",
  "rustup",
  "sh",
  "uv",
  "wget",
  "yarn",
]);

export function getCompletedTokenBeforeCursor(doc: Text, offset: number): Token | null {
  const clampedOffset = Math.max(0, Math.min(offset, doc.length));
  const line = doc.lineAt(clampedOffset);
  const lineOffset = clampedOffset - line.from;
  const token = getTokenBeforeOffset(line.text, lineOffset);

  if (token === null) {
    return null;
  }

  return {
    ...token,
    range: {
      start: line.from + token.range.start,
      end: line.from + token.range.end,
    },
  };
}

export function isProtectedCodeMirrorToken(state: EditorState, token: Token): boolean {
  return (
    token.protected ||
    isProtectedTokenText(token.text) ||
    isProtectedBySyntaxTree(state, token.range.start, token.range.end) ||
    isProtectedByMarkdownHeuristics(state.doc, token.range.start, token.range.end)
  );
}

function isProtectedBySyntaxTree(state: EditorState, from: number, to: number): boolean {
  const tree = syntaxTree(state);
  let protectedContext = false;

  tree.iterate({
    from,
    to,
    enter(node) {
      if (isProtectedSyntaxNodeName(node.name)) {
        protectedContext = true;
        return false;
      }

      return true;
    },
  });

  return protectedContext;
}

function isProtectedSyntaxNodeName(name: string): boolean {
  const normalizedName = name.toLowerCase();

  return (
    normalizedName.includes("code") ||
    normalizedName.includes("html") ||
    normalizedName.includes("url") ||
    normalizedName.includes("linkdestination") ||
    normalizedName.includes("autolink")
  );
}

function isProtectedByMarkdownHeuristics(doc: Text, from: number, to: number): boolean {
  if (from < 0 || to > doc.length || from >= to) {
    return true;
  }

  const line = doc.lineAt(from);
  const tokenStartInLine = from - line.from;
  const tokenEndInLine = to - line.from;

  return (
    isInsideFencedCodeBlock(doc, line.number) ||
    isInsideInlineCode(line.text, tokenStartInLine, tokenEndInLine) ||
    isInsideMarkdownLinkDestination(line.text, tokenStartInLine) ||
    isUrlSchemePrefix(line.text, tokenStartInLine, tokenEndInLine) ||
    isCommandLookingLine(line.text)
  );
}

function isInsideFencedCodeBlock(doc: Text, lineNumber: number): boolean {
  let fenceOpen = false;

  for (let currentLineNumber = 1; currentLineNumber <= lineNumber; currentLineNumber += 1) {
    const lineText = doc.line(currentLineNumber).text.trimStart();

    if (!isFenceLine(lineText)) {
      continue;
    }

    if (currentLineNumber === lineNumber) {
      return true;
    }

    fenceOpen = !fenceOpen;
  }

  return fenceOpen;
}

function isFenceLine(lineText: string): boolean {
  return lineText.startsWith("```") || lineText.startsWith("~~~");
}

function isInsideInlineCode(
  lineText: string,
  tokenStartInLine: number,
  tokenEndInLine: number,
): boolean {
  const before = lineText.slice(0, tokenStartInLine);
  const after = lineText.slice(tokenEndInLine);

  return hasOddUnescapedBackticks(before) && hasOddUnescapedBackticks(after);
}

function hasOddUnescapedBackticks(text: string): boolean {
  let count = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "`" && text[index - 1] !== "\\") {
      count += 1;
    }
  }

  return count % 2 === 1;
}

function isInsideMarkdownLinkDestination(lineText: string, tokenStartInLine: number): boolean {
  const before = lineText.slice(0, tokenStartInLine);
  const linkDestinationStart = before.lastIndexOf("](");

  if (linkDestinationStart === -1) {
    return false;
  }

  const lastDestinationClose = before.lastIndexOf(")");

  return lastDestinationClose < linkDestinationStart;
}

function isUrlSchemePrefix(
  lineText: string,
  tokenStartInLine: number,
  tokenEndInLine: number,
): boolean {
  const token = lineText.slice(tokenStartInLine, tokenEndInLine).toLowerCase();

  return /^(?:https?|ftp)$/.test(token) && lineText[tokenEndInLine] === ":";
}

function isCommandLookingLine(lineText: string): boolean {
  const trimmedLine = lineText.trimStart();

  if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
    return false;
  }

  if (/^(?:[$>]|PS\s+[^>]+>)\s+\S+/.test(trimmedLine)) {
    return true;
  }

  const match = /^([A-Za-z][A-Za-z0-9_.-]*)(?:\s|$)/.exec(trimmedLine);

  if (match === null || !trimmedLine.includes(" ")) {
    return false;
  }

  return shellCommandNames.has(match[1].toLowerCase());
}
