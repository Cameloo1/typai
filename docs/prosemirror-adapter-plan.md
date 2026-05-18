# ProseMirror Adapter Plan

This is a planning document only. Do not create `packages/prosemirror`, install
ProseMirror dependencies, or implement adapter code until a later prompt
explicitly opens that phase.

Future package name: `@typai/prosemirror`.

## Why ProseMirror Is Useful

ProseMirror is the base layer for a large rich-text editor ecosystem. A future
adapter would let typai work in schema-driven editors that use structured
documents, node views, marks, transactions, and collaborative editing layers.

ProseMirror is useful for typai because it already has the primitives typai
needs:

- Document schemas that define what content can exist.
- Decorations for red unresolved marks and blue applied-correction marks.
- Transactions for all document mutations.
- Position mapping through document changes.
- Selection APIs for caret and focus behavior.

## Adapter Responsibilities

A future `@typai/prosemirror` adapter must:

- Map ProseMirror document positions to typai text ranges.
- Use ProseMirror decorations for red and blue marks.
- Use ProseMirror transactions for every text mutation.
- Verify stale ranges before dispatching any mutation.
- Preserve schema constraints and never insert invalid content.
- Avoid protected nodes, protected marks, code blocks, inline code, links, URLs,
  emails, paths, identifiers, CVEs, and command-like spans.
- Keep full document text out of C++ token APIs.
- Call `checkCompletedToken()` only for completed-token hot-path checks.
- Preserve selection and caret behavior after corrections and reverts.
- Keep edit-distance candidates as suggestions only.

Blue still means typai changed the word. Red still means unresolved spelling
issue. Protected spans remain hard write barriers.

## Protected Context Strategy

The adapter should start with existing typai protected-span helpers and then add
ProseMirror-aware checks:

- Skip nodes whose schema type is code-like.
- Skip marks that represent code, links, or protected inline regions.
- Skip link targets and URL-bearing attributes.
- Skip atom and node-view regions unless the integration explicitly maps them.
- Skip when text extraction cannot prove a plain-text token range.

The conservative rule is: if the adapter cannot prove the range is normal prose,
it should skip correction and marking.

## Risks

- Schema-specific behavior can make a single universal adapter misleading.
- Rich-text marks and nested nodes can split visible words across document
  positions.
- Collaborative editing can remap or invalidate pending correction ranges.
- Decorations must map correctly through every transaction.
- Selection and caret restoration may differ by editor configuration.
- Node views can hide text or expose text that should not be modified.
- Link, mention, code, and custom domain nodes may need integration-specific
  protected policies.

## Planned Prompt Sequence

1. Define the ProseMirror adapter contract and minimal package scaffold.
2. Add decoration-only red unresolved marks for plain prose nodes.
3. Add schema-aware protected context detection.
4. Add safe common-typo correction transactions and blue marks.
5. Add V1B popovers and controls using ProseMirror commands/transactions.
6. Add adapter conformance coverage and editor-specific tests.
7. Add a ProseMirror demo only after the adapter behavior is stable.

Each prompt should keep implementation scoped to deterministic local
correction. Remote completion must remain outside this adapter plan unless a
future V4+ phase explicitly approves a separate opt-in package.

## Project Vocabulary Planning

Project vocabulary is future-only. It should protect domain terms and team
terms before typai marks or corrects them. The first version should remain
TypeScript-level memory, loaded before hot-path checks, and should not require
new C++ behavior.

Do not add project vocabulary implementation in this planning phase.

## Completion Planning Note

V4 remote completion is a separate future package. Do not fold completion into
the ProseMirror correction adapter. Any rich-editor completion support should
require a separate phase, separate opt-in package, and explicit UI/latency/privacy
contracts.

## Non-Goals

- No ProseMirror implementation now.
- No `packages/prosemirror`.
- No ProseMirror dependencies.
- No generic rich-text one-size-fits-all promise.
- No remote completion in this plan unless a later V4+ phase explicitly
  approves it.
- No `@typai/completion-remote`.
- No ghost text completion.
- No LLM/model calls.
- No server/API path.
- No next-edit logging.
