# Typai

Typai is a deterministic writing intelligence layer for the browser. It runs
entirely in the page through a C++ core compiled to Wasm, with no server, no
remote model call, no daemon, and no extension. The user types, Typai corrects
or marks the text in real time, and the embedding application stays in full
control of what gets corrected and how.

Status: alpha. Packages are local-ready and tested but not yet published to npm.

## What this is, structurally

Typai is built as three layers:

A **C++ correction engine** that owns the hot path. Deterministic,
sub-millisecond on typical inputs, no allocations during steady-state
correction. The engine holds rules, dictionaries, and the matching logic.

A **Rust/Wasm bridge** that compiles the C++ to a browser-safe binary and
exposes a typed API. The bridge handles the async loading boundary and the
memory contract between the engine and the host page.

A set of **TypeScript adapters** that wire the engine into specific editor
surfaces: `contenteditable`, native `<textarea>`, and chat-input patterns. Each
adapter handles the surface-specific weirdness like caret preservation, IME
guards, snapshot/revert, and overlay rendering, so the engine does not have to.

The engine does not know about the DOM. The adapters do not know about C++.
The bridge is the only place those two worlds meet, and it is deliberately
narrow. New surfaces such as React, ProseMirror, CodeMirror, and Monaco are new
adapters, not engine changes.

## The pipeline

Every completed-token check runs through the same path:

1. The adapter observes the input event and extracts the affected token.
2. The engine receives that token through the Wasm bridge.
3. The engine returns one of three results: a deterministic correction to apply,
   a list of edit-distance suggestions to surface, or nothing.
4. The adapter applies the result: autocorrection happens inline; suggestions
   render as marks, red for unresolved and blue for applied.
5. The adapter records the transaction so revert is exact.

The engine is the rule set. Today the rule set is a hard-coded common-typo map
and an edit-distance candidate generator. Tomorrow it could be a user dictionary,
a domain glossary, a project-specific style guide, or a learned correction set.
The surface stays the same.

## What the system gives you

The thing that is interesting about a fully in-page deterministic engine is not
the typo correction itself. It is the properties that fall out of doing it this
way:

**Zero data leaves the page.** The user's text never reaches a server. This is
useful for editors handling sensitive content: medical, legal, financial,
internal tooling, and code.

**Deterministic latency.** No network round-trip means no tail latency. The
current browser benchmark smoke run reported 1.0-2.6 ms p95 across
Chromium and Firefox contenteditable/textarea paths. Real-time behavior is
bounded.

**Embedder controls everything.** The host application decides what gets
corrected, what gets marked, what gets ignored, and what stays untouched:
protected tokens for URLs, emails, paths, identifiers, CVEs, and code snippets.
A code editor and a chat input can route the same engine through different rule
sets.

**No installation, no extension.** The user does not have to install anything.
They just type in your editor and the corrections happen.
Browser-extension-based spellcheckers cannot reach into web app text fields
cleanly; Typai is already inside the field.

**Predictable revert.** Every applied correction is recorded as a transaction.
The user can undo the autocorrection exactly, with caret and selection
preserved.

## What is pluggable

The architecture is deliberately open at the rule-set boundary. A reader
familiar with the embedded-engine pattern will already see where the slots are:

- **Rule sets.** Common-typo map today. Could be domain dictionaries, learned
  rules, project-specific style guides, and terminology enforcement.
- **Suggestion sources.** Edit-distance today. Could be SymSpell,
  keyboard-adjacency, contextual ranking, or anything that returns ranked
  candidates.
- **Adapters.** Three today: `contenteditable`, `textarea`, and chat input.
  Could be React, ProseMirror, CodeMirror, Monaco, or custom editor frameworks.
- **Mark renderers.** Red/blue overlay marks today. Could be inline tooltips,
  margin annotations, accessibility-tree announcements, or custom UI per
  surface.
- **Storage.** In-memory and IndexedDB today for the personal dictionary. Could
  be backed by the embedding application's own user state.

What is not pluggable, intentionally, is the engine's deterministic contract.
Typai will not call out to LLMs, remote APIs, or local services. That constraint
is what makes the latency and privacy properties hold. If a use case needs
probabilistic correction, route to a different system at the application layer.

## What ships today

**User-facing:**

- Common-typo autocorrection, such as `teh` -> `the`
- Red marks for unresolved spelling issues
- Blue marks for words Typai changed
- Exact revert for any applied correction
- Suggestion popovers for unresolved words
- Per-word controls: always-correct, never-correct, ignore once, add to
  dictionary

**Developer-facing:**

- Three adapters: `@typai/core`, `@typai/contenteditable`, `@typai/textarea`
- Overlay mirror engine for safe rendering over native `<textarea>`
- Protected-token guards for URLs, emails, paths, identifiers, and CVEs
- Snapshot/version-locked transactions; stale writes are blocked
- Personal dictionary with import/export/reset
- IME-safe input handling
- Caret and selection preservation across corrections
- E2E tested on Chromium and Firefox

`textarea.value` remains the source of truth for textarea and chat-input usage.
The overlay mirror is visual only and never inserts markup into the textarea.

## What is deliberately out of scope

Typai will not add:

- LLM or remote model calls
- Server, daemon, or localhost API
- Browser extension
- Grammar, style, tone, or clarity checking
- Edit-distance autocorrect; edit-distance is suggestions only
- Next-edit logging
- React/ProseMirror/CodeMirror/Monaco adapters yet; these are future adapter
  work, not engine work

The scope is held tight because the value proposition depends on it. A
deterministic, in-page, serverless correction layer is interesting precisely
because it does not drift into being a general writing assistant. If you need
those things, route to a different system at the application layer.

## Quick start

Install dependencies and run the demo:

```sh
pnpm install
pnpm --filter simple-demo-editor dev
```

Attach to a textarea:

```ts
import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

const typai = await createTypaiCore();
const detach = attachTextarea({ textarea, typai });
```

Attach to a contenteditable element:

```ts
import { createTypaiCore } from "@typai/core";
import { attachContenteditable } from "@typai/contenteditable";

const typai = await createTypaiCore();
const detach = attachContenteditable({ element, typai });
```

## Run checks

```sh
pnpm test
pnpm test:e2e
pnpm build
pnpm lint
pnpm pack:dry
pnpm smoke:install
pnpm bench:browser
```

Browser benchmark gates warn above 20 ms p95 and fail above 100 ms p95. WebKit
is intentionally skipped for this phase.

## Docs

- [docs/AGENT_BRIEF.md](./docs/AGENT_BRIEF.md) — canonical brief for future agents
- [docs/textarea-adapter-foundation-complete.md](./docs/textarea-adapter-foundation-complete.md) — textarea completion audit
- [docs/package-readiness.md](./docs/package-readiness.md) — local pack and smoke install details
- [docs/examples.md](./docs/examples.md) — demo behavior and manual checks

## License

License not selected yet.
