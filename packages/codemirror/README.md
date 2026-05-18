# @typai/codemirror

CodeMirror 6 adapter package for typai.

This package is part of Rich Editor Adapter Foundation. The initial version is
focused on local deterministic correction: it marks unresolved spelling issues
with CodeMirror decorations and applies common-typo corrections through
range-verified CodeMirror transactions.

## Scope

- CodeMirror 6 only.
- Red unresolved spelling decorations use `typai-cm-red-spelling`.
- Blue applied-correction decorations use `typai-cm-blue-corrected`.
- Common typo autocorrections are applied through CodeMirror transactions after
  stale range, document length, cursor, and token-text verification.
- Revert commands restore the exact original token from blue marks.
- Edit-distance suggestions remain red marks only and are not autocorrected.
- Blue correction popovers support revert, always-correct, never-correct, and
  add-original-to-dictionary actions.
- Red spelling popovers support suggestion application, ignore once,
  add-to-dictionary, and disable-autocorrect actions.
- Popover mutations verify the current CodeMirror range before dispatching.
- Plain text mode works without a language extension.
- Markdown mode uses CodeMirror syntax trees when available.
- Fenced code blocks, inline code, Markdown link destinations, command-looking
  lines, URLs, emails, paths, identifiers, acronyms, and CVEs are protected.
- If no syntax tree is available, conservative Markdown heuristics still protect
  common code, link, and shell-command contexts.
- No CodeMirror 5 support.
- No V4 remote completion.
- No ghost text completion.
- No OpenAI/provider endpoint.

## Dependency Policy

`@codemirror/state`, `@codemirror/view`, and `@codemirror/language` are peer
dependencies so host applications keep one CodeMirror 6 runtime. They are also
dev dependencies in this package so the adapter can build and test inside the
workspace.

`@codemirror/lang-markdown` is a dev dependency for tests and examples. Host
applications that want Markdown syntax-tree protection should install and add
their own Markdown extension to the editor state.

`@typai/ui` is an internal workspace dependency used for the current popover
DOM utilities. It is not a stable public UI API.

## Usage

```ts
import { createTypaiCore } from "@typai/core";
import { createTypaiCodeMirrorExtension } from "@typai/codemirror";

const typai = await createTypaiCore();
const extension = createTypaiCodeMirrorExtension({
  typai,
  autocorrect: true,
  spellcheck: true,
});
```

Add `extension` to a CodeMirror 6 editor state. Typing an unresolved word such
as `zzzzword ` creates a red spelling decoration. Typing a common typo such as
`teh ` dispatches a CodeMirror transaction that changes it to `the ` and adds a
blue applied-correction decoration.

For Markdown-aware protection, add CodeMirror's Markdown extension in the same
editor state:

```ts
import { markdown } from "@codemirror/lang-markdown";

const extensions = [
  markdown(),
  createTypaiCodeMirrorExtension({
    typai,
    autocorrect: true,
    spellcheck: true,
  }),
];
```

With a syntax tree, typai skips inline code, fenced code blocks, and Markdown
link destinations. Without a syntax tree, it falls back to conservative text
heuristics for fences, inline code, link destinations, and command-looking
lines such as `npm install zzzzword`.

## Popovers And Controls

Hosts can open popovers from commands or rely on keyboard/click interaction on
typai mark decorations:

```ts
import {
  openFirstTypaiCodeMirrorBluePopover,
  openFirstTypaiCodeMirrorRedPopover,
  revertFirstTypaiCodeMirrorCorrection,
} from "@typai/codemirror";

openFirstTypaiCodeMirrorBluePopover(view);
openFirstTypaiCodeMirrorRedPopover(view);
revertFirstTypaiCodeMirrorCorrection(view);
```

Popover actions use CodeMirror transactions for text changes. Revert and
suggestion application verify that the current range still contains the expected
replacement or original token before dispatching. Adding the original word from
a blue popover adds it to typai memory, reverts the current correction, and
removes the blue mark because the user has declared the original token valid.
Never-correct stores a typai memory rule and reverts the current correction.
Disable autocorrect stores adapter runtime state for the current editor view;
spellcheck can remain enabled and can show a red mark with the suppressed
replacement as a suggestion.

Popover positioning first asks CodeMirror for coordinates at the mark range. If
that geometry is unavailable, such as in jsdom or unusual embedded layouts, the
adapter falls back to the decoration DOM element rectangle and then the editor
rectangle. The fallback is intentionally stable rather than pixel-perfect.
