# Monaco Adapter Plan

This is a planning document only. Do not create `packages/monaco`, install
Monaco dependencies, or implement adapter code until a later prompt explicitly
opens that phase.

Future package name: `@typai/monaco`.

## Why Monaco Is Useful

Monaco is the code-editor ecosystem behind VS Code-like browser editors. A
future adapter would let typai work in code-adjacent surfaces where users write
prompts, comments, Markdown, docs, commit messages, and prose-like regions near
code.

Monaco is useful for typai because it has editor primitives that match the
adapter contract:

- Text models as the document source of truth.
- Decorations and markers for visual annotations.
- Edit operations for safe text changes.
- Selection APIs for caret behavior.
- Language modes that can help identify code and protected regions.

## Adapter Responsibilities

A future `@typai/monaco` adapter must:

- Use Monaco models and decorations for red and blue marks.
- Use Monaco edit operations for every text mutation.
- Verify stale ranges before dispatching any edit operation.
- Protect code identifiers, paths, shell snippets, comments, URLs, emails,
  acronyms, CVEs, and command-like spans.
- Avoid language-server and diagnostic conflicts.
- Support prose-like regions only where explicitly configured.
- Keep broad code spellchecking disabled by default.
- Keep full document text out of C++ token APIs.
- Call `checkCompletedToken()` only for completed-token hot-path checks.
- Keep edit-distance candidates as suggestions only.

Blue still means typai changed the word. Red still means unresolved spelling
issue. Protected spans remain hard write barriers.

## Protected Context Strategy

The adapter should start with existing typai protected-span helpers and then add
Monaco-aware checks:

- Skip identifiers, symbols, strings, paths, and command-looking lines unless an
  integration explicitly opts in.
- Skip code language modes by default.
- Allow prose-like regions through explicit configuration, such as Markdown
  prose, comments, docstrings, or prompt composer buffers.
- Avoid fighting language-server diagnostics, quick fixes, formatters, or editor
  contributions.

The conservative rule is: if the adapter cannot prove the range is prose-like
and safe to edit, it should skip correction and marking.

## Risks

- Code editor false positives are high-cost and can corrupt code intent.
- Language modes differ substantially and may not expose enough syntax context.
- Large files can make decoration and scan behavior expensive.
- Decoration lifecycle must avoid leaks and stale highlights.
- Editor contribution conflicts can create confusing UX with diagnostics,
  completions, snippets, or language-server code actions.
- Selection and multi-cursor behavior can complicate corrections and reverts.

## Planned Prompt Sequence

1. Define the Monaco adapter contract and minimal package scaffold.
2. Add decoration-only red unresolved marks for explicitly configured prose-like
   buffers.
3. Add protected context detection for identifiers, paths, commands, and code
   language modes.
4. Add safe common-typo correction edit operations and blue marks.
5. Add V1B popovers and controls using Monaco commands/actions.
6. Add adapter conformance coverage and editor-specific tests.
7. Add a Monaco demo only after default skip behavior is stable.

Each prompt should keep implementation scoped to deterministic local
correction. Remote completion must remain outside this adapter plan unless a
future V4+ phase explicitly approves a separate opt-in package.

## Project Vocabulary Planning

Project vocabulary is future-only. It should protect repository names, tool
names, domain terms, symbols, and team-specific language before typai marks or
corrects them. The first version should remain TypeScript-level memory, loaded
before hot-path checks, and should not require new C++ behavior.

Do not add project vocabulary implementation in this planning phase.

## Completion Planning Note

V4 remote completion is a separate future package. Do not fold completion into
the Monaco correction adapter. Any rich-editor completion support should require
a separate phase, separate opt-in package, and explicit UI/latency/privacy
contracts.

## Non-Goals

- No Monaco implementation now.
- No `packages/monaco`.
- No Monaco dependencies.
- No broad code spellchecking default.
- No model/LLM path.
- No remote completion in this plan unless a later V4+ phase explicitly
  approves it.
- No `@typai/completion-remote`.
- No ghost text completion.
- No server/API path.
- No next-edit logging.
