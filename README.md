![typai title image](./docs/typai-title.png)

# typai

typai is a local deterministic correction layer for browser writing surfaces,
with optional remote completion kept in a separate package and routed through
embedder-owned endpoints. The C++ core compiled to Wasm runs in browsers today;
the same engine compiles natively for editor plugins, desktop applications, and
other host environments.

**Status:** V4.2 public-beta readiness, Intelligence Quality Foundation, and
the Production Language Asset + Beta Release Candidate checkpoint are complete.
The `0.0.0-beta.0` package set is published on npm under the `beta` dist-tag
and has passed registry smoke from public npm packages.

## What this is, structurally

typai is built as three layers:

A **C++ correction engine** that owns the hot path. Deterministic,
sub-millisecond on typical inputs, no allocations during steady-state
correction. The engine holds rules, dictionaries, and the matching logic.

A **Rust/Wasm bridge** that compiles the C++ to a browser-safe binary and
exposes a typed API. The bridge handles the async loading boundary and the
memory contract between the engine and the host page.

A set of **TypeScript adapters** that wire the engine into specific editor
surfaces: contenteditable, native `<textarea>`, React components/hooks,
CodeMirror 6 decorations, and chat-input patterns. Each adapter handles the
surface-specific behavior like caret preservation, IME guards, snapshot/revert,
and overlay rendering, so the engine does not have to.

The engine does not know about the DOM. The adapters do not know about C++.
The bridge is the only place those two worlds meet, and it is deliberately
narrow. New surfaces such as ProseMirror and Monaco are new adapters, not
engine changes.

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
and an edit-distance candidate generator. Later phases may add user
dictionaries, domain glossaries, project-specific style guides, or learned
correction sets. The surface contract stays the same.

## What the system gives you

The interesting part of a fully in-page deterministic engine is not typo
correction by itself. It is the properties that fall out of doing it this way:

**Zero data leaves the page for local correction.** The user's text does not
need to reach a Typai service for deterministic correction. This is useful for
editors handling sensitive content: medical, legal, financial, internal tooling,
and code.

**Deterministic latency.** No network round-trip means no tail latency for local
correction. Real-time behavior is bounded.

**Embedder controls everything.** The host application decides what gets
corrected, what gets marked, what gets ignored, and what stays untouched:
protected tokens for URLs, emails, paths, identifiers, CVEs, and code snippets.
A code editor and a chat input can route the same engine through different rule
sets.

**No user extension requirement.** The user does not have to install a browser
extension for host-app integration. The host app can wire Typai into its own
editor surface.

**Predictable revert.** Every applied correction is recorded as a transaction.
The user can undo the autocorrection exactly, with caret and selection
preserved.

## What is pluggable

The architecture is deliberately open at the rule-set boundary:

- **Rule sets.** Common-typo map today. Later phases could add domain
  dictionaries, learned rules, project-specific style guides, and terminology
  enforcement.
- **Suggestion sources.** Edit-distance today. Later phases could add SymSpell,
  keyboard-adjacency, contextual ranking, or another ranked candidate source.
- **Adapters.** Contenteditable, textarea, React, chat input, and CodeMirror 6
  exist today. ProseMirror and Monaco would be new adapters, not engine changes.
- **Mark renderers.** Red/blue overlay marks today. Host apps can use inline
  tooltips, margin annotations, accessibility-tree announcements, or custom UI
  per surface.
- **Storage.** In-memory and IndexedDB today for the personal dictionary. Host
  apps can back user state with their own storage later.

What is not pluggable, intentionally, is the deterministic correction contract.
`@typai/core` and the correction adapters are local deterministic packages.
Advanced capabilities are separate, explicit, opt-in packages or later phases.

## Current Phase

Production Language Asset + Beta Release Candidate is complete in the current
blocked-production-asset state.

- deterministic correction remains local through `@typai/core`
- completion is optional through `@typai/completion-remote`
- provider examples keep credentials server-side
- automated tests and demos use mock providers
- the full demo has an optional local proxy completion mode for manual
  real-provider checks
- no direct browser-to-provider credential path is supported
- no production dictionary asset, Codex adapter, next-edit logging, or local
  model inference is included
- current local spell coverage includes delete-index suggestions and an audited
  common-typo autocorrect gate, but it is still not production dictionary
  coverage until an approved production asset lands
- spell-quality benchmark gates and cross-surface E2E guard the current safety
  baseline
- production language asset RC gates are complete, but no production
  dictionary/frequency asset is bundled until the remaining source, hash,
  generated output, size, quality, and review blockers are closed
- the deterministic production transform pipeline exists, but package inclusion
  is currently host-provided only while the production manifest is blocked
- npm beta publish completed for the seven approved packages
- registry smoke passed from public npm `@beta` packages
- the `latest` dist-tag currently also points at `0.0.0-beta.0` because these
  were first publishes; move it only through an explicit release decision
- the next release step is selecting the next phase or beta patch/remediation

## Packages

- `@typai/core` - deterministic correction engine and storage APIs
- `@typai/contenteditable` - contenteditable adapter
- `@typai/textarea` - native textarea adapter and overlay
- `@typai/react` - React provider, hooks, and components
- `@typai/codemirror` - CodeMirror 6 extension
- `@typai/completion-remote` - optional completion scheduler and providers
- `@typai/ui` - required support package for public packages; unstable as an
  independent design-system API

## Quick Start

Install the package pair for your surface:

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
npm install @typai/completion-remote@beta
```

`@typai/ui` is installed transitively by packages that need it. Install
`@typai/ui@beta` directly only when intentionally using the support package; it
is not a stable independent design-system API.

Run workspace examples from this checkout:

```sh
pnpm install
pnpm build
pnpm --filter consumer-vanilla-textarea dev
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

## Verification

```sh
pnpm build
pnpm test
pnpm lint
pnpm bench:spell-quality
pnpm bench:language-asset
pnpm docs:check
pnpm pack:dry
pnpm smoke:install
pnpm smoke:public-beta
pnpm scan:package-secrets
pnpm package:size-report
pnpm release:check
```

The public beta smoke matrix installs packed local tarballs into temporary
consumer apps and uses mock provider paths only. The registry smoke documented
in `docs/beta-registry-smoke.md` installs public npm `@beta` packages without
workspace symlinks or local tarballs.

## Docs

- [Docs index](https://github.com/Cameloo1/typai/blob/fix/docs/README.md)
- [Getting started](https://github.com/Cameloo1/typai/blob/fix/docs/getting-started.md)
- [Installation](https://github.com/Cameloo1/typai/blob/fix/docs/installation.md)
- [Examples](https://github.com/Cameloo1/typai/blob/fix/docs/examples.md)
- [Real-provider demo](https://github.com/Cameloo1/typai/blob/fix/docs/real-provider-demo.md)
- [Security](https://github.com/Cameloo1/typai/blob/fix/docs/security.md)
- [Privacy](https://github.com/Cameloo1/typai/blob/fix/docs/privacy.md)
- [Troubleshooting](https://github.com/Cameloo1/typai/blob/fix/docs/troubleshooting.md)
- [Roadmap](https://github.com/Cameloo1/typai/blob/fix/docs/roadmap.md)
- [Changelog](https://github.com/Cameloo1/typai/blob/fix/CHANGELOG.md)
- [Beta release candidate plan](https://github.com/Cameloo1/typai/blob/fix/docs/beta-release-candidate-plan.md)
- [Beta known issues](https://github.com/Cameloo1/typai/blob/fix/docs/beta-known-issues.md)
- [Beta rollback guidance](https://github.com/Cameloo1/typai/blob/fix/docs/beta-rollback-guidance.md)
- [Production asset gate recap](https://github.com/Cameloo1/typai/blob/fix/docs/production-asset-gate-recap.md)
- [Common typo table](https://github.com/Cameloo1/typai/blob/fix/docs/common-typo-table.md)
- [Dictionary source selection](https://github.com/Cameloo1/typai/blob/fix/docs/dictionary-source-selection.md)
- [Dictionary production approval](https://github.com/Cameloo1/typai/blob/fix/docs/dictionary-production-approval.md)

## License

License not selected yet.
