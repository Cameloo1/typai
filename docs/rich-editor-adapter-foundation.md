# Rich Editor Adapter Foundation

Phase name: Rich Editor Adapter Foundation.

This document is the source-of-truth scope lock for the Rich Editor Adapter
Foundation phase. Prompt 48 created the documentation boundary only. Prompt 49
adds the internal shared adapter contract and conformance test harness without
changing runtime behavior. Prompt 50 adds the internal shared UI package
without migrating existing adapters yet. Prompt 51 scaffolds `@typai/react`.
Prompt 52 implements React hook attachment and cleanup lifecycle for the
textarea and contenteditable adapters. Prompt 53 implements the React component
surface over those hooks. Prompt 54 adds the React demo, React E2E/accessibility
coverage, and local package-readiness smoke coverage. Prompt 55 creates the
initial CodeMirror 6 package with decoration-only red unresolved spelling marks.
Prompt 56 adds Markdown/code protected-context awareness. Prompt 57 adds safe
CodeMirror correction transactions for common typo autocorrection, blue
applied-correction marks, and exact revert commands. Prompt 58 adds CodeMirror
V1B red/blue popovers and controls. Prompt 59 adds the CodeMirror demo and the
Codex-style mock prompt editor demo without adding real Codex integration.
Prompt 60 audits and locks the planning-only ProseMirror and Monaco adapter
docs without adding code or dependencies.

## Why This Phase Exists

typai's generic input coverage is now in place through contenteditable and
textarea. The next product need is app/framework/editor integration without
weakening the deterministic correction contract.

React gives ergonomic app-level integration for applications that want hooks,
components, provider state, settings UI, and debug UI without rewriting adapter
wiring.

CodeMirror gives typai its first serious editor surface for prose, Markdown,
code, and prompt contexts. CodeMirror is also the right place to learn how
typai should behave in rich editor ecosystems before broader editor work.

ProseMirror and Monaco remain planning-only in this phase. Codex remains a
future flagship integration. This phase only creates a Codex-style mock demo
using CodeMirror so the prompt-editor experience can be explored without
implementing real Codex integration.

V4 remote completion is future work in a separate package,
`@typai/completion-remote`. It is not part of this phase.

## Goals

- Add shared adapter contracts and conformance tests. Prompt 49 creates the
  private internal `@typai/adapter-testkit` package for this purpose.
- Add an internal shared UI package, not a public stable UI API yet. Prompt 50
  creates private internal `@typai/ui` for this purpose.
- Add `@typai/react` as a real adapter package. Prompt 51 creates the package
  scaffold, provider, staged hooks, and staged components.
- Add React hooks and components for textarea/contenteditable.
- Add `useTypaiTextarea`.
- Add `useTypaiContenteditable`.
- Add `TypaiTextarea`.
- Add `TypaiContenteditable`.
- Add provider, settings, and debug UI for React usage.
- Add `@typai/codemirror` for CodeMirror 6.
- Add decoration-only CodeMirror marks first.
- Add CodeMirror correction transactions and popovers after the decoration path
  is stable.
- Add Markdown/code-block protected-span awareness for CodeMirror.
- Add a CodeMirror demo.
- Add a Codex-style mock prompt editor demo using CodeMirror.
- Add planning docs for ProseMirror.
- Add planning docs for Monaco.
- Keep publishable-alpha package metadata up to date, but do not publish.

## Non-Goals

- No SymSpell/delete index.
- No keyboard adjacency scoring.
- No edit-distance autocorrect.
- No valid-word autocorrect.
- No production dictionary asset.
- No grammar/style/tone/clarity/sentence rewriting.
- No LLM/model calls.
- No server/local-service/API.
- No browser extension.
- No real Codex adapter implementation.
- No ProseMirror implementation.
- No Monaco implementation.
- No WebKit CI.
- No next-edit logging.
- No project vocabulary implementation, only planning.
- No `@typai/completion-remote`.
- No remote completion.
- No ghost text completion.
- No OpenAI/provider endpoint.
- No streaming/non-streaming completion.

## Hard Product Laws

- Blue = typai changed this word.
- Red = unresolved spelling issue.
- Suggestions can expand; automatic replacements must not.
- Valid words are never autocorrected.
- Protected spans are hard write barriers.
- Every text mutation must verify documentVersion/range/token text or
  editor-equivalent stale-write safety.
- Full document text is not passed into C++ token APIs.
- `checkCompletedToken()` and `suggestToken()` remain sync after
  initialization.
- Storage is async but loaded into in-memory state before hot-path checks.
- `@typai/core` remains local deterministic correction only.
- Remote completion remains future V4 work in a separate opt-in package.

## Adapter Order

1. Shared adapter contracts and conformance tests. Complete for the first
   internal package in Prompt 49 through `@typai/adapter-testkit`.
2. Internal shared UI package. Complete for the first internal package in
   Prompt 50 through `@typai/ui`.
3. `@typai/react` real adapter package. Scaffold complete in Prompt 51; hook
   lifecycle complete in Prompt 52; component surface complete in Prompt 53.
4. `@typai/codemirror` CodeMirror 6 adapter package. Initial decoration-only
   red unresolved spelling marks complete in Prompt 55; Markdown/code
   protected contexts complete in Prompt 56; safe correction transactions and
   exact revert commands complete in Prompt 57; V1B popovers and controls
   complete in Prompt 58.

## Shared Adapter Conformance

`@typai/adapter-testkit` is an internal, private package. It is not a stable
public API. It defines the small test-facing adapter driver contract and runs
shared conformance cases against implemented adapters.

Current conformance coverage:

- `@typai/contenteditable`.
- `@typai/textarea`.

The suite verifies common typo correction, exact blue-mark revert, unresolved
red marks, valid-word no-op behavior, protected email/path/identifier/CVE
tokens, IME guard behavior where supported, stale-write safety where supported,
edit-distance suggestions as red marks only, and plain source text for
textarea-like paths.

The testkit must remain test infrastructure. Do not treat it as a user-facing
runtime dependency or public adapter API until a later explicit phase says so.

## Shared UI

`@typai/ui` is an internal, private package. It is not a stable public UI API.
It provides framework-free DOM utilities for correction popovers, spelling
popovers, settings panels, local debug summaries, live regions, focus helpers,
and shared prefixed styles.

Current migration status:

- Existing `@typai/contenteditable` UI behavior remains unchanged.
- Existing `@typai/textarea` UI behavior remains unchanged.
- `@typai/codemirror` uses `@typai/ui` for V1B red/blue popovers in Prompt 58.
- React may opt further into these utilities in later prompts.

The shared UI package must not add React, CodeMirror, adapter-specific runtime
dependencies, ghost text completion UI, remote completion UI, next-edit
logging, provider metrics, or new product behavior.

## React Scope

`@typai/react` is a real React adapter package, not just thin wrappers around
existing functions. It should provide staged hooks and components:

- `useTypaiTextarea`
- `useTypaiContenteditable`
- `TypaiTextarea`
- `TypaiContenteditable`
- Provider, settings, and debug UI

The React adapter must preserve the same local deterministic correction
contracts as `@typai/contenteditable` and `@typai/textarea`.

Current migration status:

- `TypaiProvider` owns React context, loading state, and async core creation in
  effects.
- `useTypaiCore` exposes `{ typai, status, error }` and keeps staged `core` and
  `loading` aliases during rollout.
- `useTypaiTextarea` and `useTypaiContenteditable` attach adapters in effects,
  detach on cleanup, forward callbacks through stable wrappers, expose
  `idle`/`waiting_for_core`/`attached`/`error` status, and support direct
  `typai` overrides over provider context.
- `TypaiTextarea`, `TypaiContenteditable`, `TypaiSettingsPanel`, and
  `TypaiDebugTable` are implemented over the hook layer.
- `TypaiTextarea` supports direct native textarea props and `textareaProps`,
  forwards refs, uses provider context when `typai` is omitted, and lets direct
  `typai` override provider context.
- `TypaiContenteditable` supports direct native div props and
  `contenteditableProps`, forwards refs, uses provider context when `typai` is
  omitted, and lets direct `typai` override provider context.
- React settings/debug components remain local deterministic correction UI only;
  they do not expose completion settings, completion metrics, next-edit logging,
  provider metrics, or full-document text collection.
- Textarea overlay behavior is opt-in from React hooks so React keeps ownership
  of its rendered element tree unless an embedder explicitly enables overlay
  DOM behavior.
- React is a peer dependency of `@typai/react` only.
- No React dependency is allowed in `@typai/core`, `@typai/contenteditable`,
  `@typai/textarea`, `@typai/ui`, or `@typai/adapter-testkit`.

## CodeMirror Scope

`@typai/codemirror` targets CodeMirror 6 only.

The first implementation path was decoration-only marks. Prompt 55 creates the
package and renders red `typai-cm-red-spelling` unresolved spelling
decorations. Prompt 57 adds blue `typai-cm-blue-corrected` marks for safe
CodeMirror transaction-applied corrections. Prompt 58 adds red/blue popovers
and V1B controls.

Prompt 55 behavior:

- Listens to CodeMirror document updates.
- Detects completed tokens after delimiters.
- Skips protected token text through existing typai helpers.
- Skips Markdown/code contexts through syntax-tree checks where available and
  conservative text heuristics otherwise.
- Calls `typai.checkCompletedToken()` with only the completed token.
- Renders red unresolved spelling decorations for `mark_unresolved` decisions.
- Observes `auto_correct` decisions without mutating editor text.
- Does not implement popovers, completion, ghost text, remote completion, or
  OpenAI/provider calls.

Correction transactions were added in Prompt 57 after decoration behavior was
stable. Popovers and V1B controls were added in Prompt 58.

Prompt 56 behavior:

- Existing typai protected token helpers always run first.
- When a CodeMirror syntax tree is available, inline code, fenced code blocks,
  URL/link-destination nodes, autolinks, and other code-like syntax nodes are
  skipped.
- Without a syntax tree, fallback heuristics skip fenced code, inline code,
  Markdown link destinations, and command-looking shell lines such as
  `npm install zzzzword`.
- Normal Markdown prose can still receive red unresolved spelling decorations.
- Text mutation, popovers, completion, ghost text, remote completion, and
  OpenAI/provider calls remain out of scope.

Prompt 57 behavior:

- Common typo `auto_correct` decisions are applied through CodeMirror
  transactions only.
- Before dispatch, the adapter verifies the queued document version, document
  length, cursor state, and original token text.
- Applied corrections create blue `typai-cm-blue-corrected` marks over the
  replacement text.
- CodeMirror correction transaction history records the original range,
  replacement range, trigger, confidence, and reason codes.
- Revert commands verify that the current blue-mark range still contains the
  replacement text before restoring the exact original token.
- Edit-distance suggestions remain red marks only and are not autocorrected.
- Markdown/code protected contexts remain hard write barriers.
- Popovers, completion, ghost text, remote completion, and OpenAI/provider calls
  remain out of scope.

Prompt 58 behavior:

- Blue correction popovers open from commands, click, or keyboard activation on
  blue marks.
- Blue actions can revert, always correct, never correct, add the original to
  the personal dictionary, or close.
- Adding the original to the dictionary reverts the current correction and
  removes the blue mark because the user has declared the original token valid.
- Red spelling popovers open from commands, click, or keyboard activation on
  red marks.
- Red actions can choose a suggestion, ignore once, add to dictionary, disable
  autocorrect, or close.
- Choosing a red suggestion dispatches a CodeMirror transaction, removes the red
  mark, and adds a blue applied-correction mark because typai changed the word.
- Ignore once removes only the current red mark.
- Disable autocorrect updates current-editor adapter runtime state while
  leaving spellcheck available when configured.
- Popovers use `@typai/ui` dialog semantics, Escape handling, focus helpers,
  Tab-reachable buttons, and explicit Enter/Space activation wiring.
- Popover anchors use CodeMirror coordinates when available, then fall back to
  decoration DOM geometry and finally the editor rectangle.
- Every popover text mutation verifies the current range text before dispatch.
- Protected Markdown/code contexts remain hard write barriers.
- Completion, ghost text, remote completion, OpenAI/provider calls, and
  next-edit logging remain out of scope.

Prompt 59 behavior:

- `examples/simple-demo-editor` includes a CodeMirror Demo tab for plain text
  and Markdown mode.
- The CodeMirror demo exposes local settings for autocorrect, spellcheck, and
  personal-dictionary demo memory, plus debug counters for the last decision,
  corrections, unresolved marks, reverts, protected skips, and latency.
- The CodeMirror demo covers `teh ` auto-correction, `reciept ` red
  suggestions, valid-word no-op behavior, email/URL/path protection, inline
  code protection, and fenced-code protection.
- `examples/simple-demo-editor` includes a Codex Mock Demo tab using CodeMirror
  Markdown mode to mimic a prompt composer.
- The Codex mock includes ordinary prose plus command, code-fence, file-path,
  CVE, and tool-name examples so protected prompt contexts can be tested
  without a real Codex adapter.
- The Codex mock run button is fake local UI. It does not call Codex, OpenAI,
  providers, a server, localhost service, or any remote completion endpoint.
- No ghost text or completion UI is added.

Initial CodeMirror modes:

- Plain text.
- Markdown.
- Code-block awareness.

Protected spans should start with existing typai helpers. CodeMirror
syntax-tree awareness may be added where available, but it must preserve the
same protected-span hard barrier semantics.

## Planning-Only Surfaces

ProseMirror and Monaco are docs-only during this phase. Do not add dependencies,
packages, demos, runtime code, tests, or package metadata for either editor
unless a later prompt explicitly authorizes implementation.

Current planning docs:

- `docs/prosemirror-adapter-plan.md` plans a future `@typai/prosemirror`
  package for ProseMirror schema/decorations/transactions integration.
- `docs/monaco-adapter-plan.md` plans a future `@typai/monaco` package for
  Monaco model/decorations/edit-operation integration.

Both plans keep project vocabulary future-only, keep remote completion separate
from deterministic correction adapters, and explicitly forbid implementation in
this phase.

Prompts 54-60 do not implement or package ProseMirror, Monaco, real Codex
integration, or remote completion.

## React Demo And Package Readiness

Prompt 54 adds a React tab inside `examples/simple-demo-editor`.

The React demo shows:

- `TypaiProvider`.
- `TypaiTextarea`.
- `TypaiContenteditable`.
- `TypaiSettingsPanel`.
- `TypaiDebugTable`.
- Memory export/import/reset controls.

The React E2E coverage proves:

- React textarea common-typo autocorrection.
- React textarea unresolved spelling suggestions.
- React contenteditable common-typo autocorrection.
- Settings can disable autocorrect.
- Provider-created core works.
- React re-render does not duplicate textarea adapter attachment.
- React demo accessibility smoke coverage.
- No remote completion, ghost text, or provider endpoint is used.

Package readiness covers `@typai/react` and internal `@typai/ui` in local
pack dry-run and smoke install. React remains a peer dependency of
`@typai/react`; `@typai/core` does not depend on React.

## Codex Boundary

Codex remains a future flagship integration. This phase may add a Codex-style
mock prompt editor demo using CodeMirror, but it must not integrate with Codex,
Codex APIs, Codex runtime state, local agents, remote agents, or real provider
calls. Prompt 59 adds that mock demo and keeps it demo-only.

## Remote Completion Boundary

V4 remote completion is not part of Rich Editor Adapter Foundation. Do not
create `@typai/completion-remote`, do not add ghost text, do not call OpenAI or
any provider endpoint, and do not add streaming or non-streaming completion
logic in this phase.

`@typai/core`, `@typai/contenteditable`, `@typai/textarea`, `@typai/react`, and
`@typai/codemirror` must remain local deterministic correction packages unless
a later explicit phase changes that contract.
