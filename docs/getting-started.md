# Getting Started

Typai beta is installable from npm today. Use the `beta` dist-tag or pin
`0.0.0-beta.0` for reproducible evaluation. The core correction path is local:
it does not require a server, account, API key, or provider.

What you get in the beta:

- deterministic typo correction through `@typai/core`
- contenteditable, textarea, React, and CodeMirror adapters
- optional ghost completion through an endpoint-backed package
- mock and server-proxy completion examples
- package smoke and registry smoke already passed for the public beta

What you do not get yet:

- bundled production dictionary/frequency assets
- real Codex adapter
- grammar, style, tone, or clarity features
- local model inference
- next-edit logging
- browser-side provider credential entry

## Install One Surface

Install the core package plus the adapter for the surface you are testing.

```sh
npm install @typai/core@beta @typai/textarea@beta
```

Other supported beta combinations:

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
npm install @typai/completion-remote@beta
```

Install `@typai/ui@beta` directly only if you are intentionally building
against the support package. Normal React and CodeMirror consumers receive it
transitively.

## Minimal Core Smoke

```ts
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();

typai.checkCompletedToken({ token: "teh" });
// action: "auto_correct", replacement: "the"

typai.checkCompletedToken({ token: "form" });
// action: "do_nothing"
```

`form` is an intentional valid-word trap. The beta must not rewrite it.

## Contenteditable

```ts
import { attachContenteditable } from "@typai/contenteditable";
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
const detach = attachContenteditable({
  element: document.querySelector("[contenteditable]") as HTMLElement,
  typai,
});
```

The adapter owns DOM range mapping, correction marks, popovers, and stale-write
checks for that element. Call `detach()` when the host editor unmounts.

## Textarea

```ts
import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

const typai = await createTypaiCore();
const detach = attachTextarea({
  textarea: document.querySelector("textarea") as HTMLTextAreaElement,
  typai,
  overlay: { enabled: true },
});
```

Textarea marks are rendered with an overlay because native textareas cannot draw
inline spans inside the control.

## React

```tsx
import { createTypaiCore } from "@typai/core";
import { TypaiProvider, TypaiTextarea } from "@typai/react";

export function Editor() {
  return (
    <TypaiProvider createCore={createTypaiCore}>
      <TypaiTextarea defaultValue="teh message" />
    </TypaiProvider>
  );
}
```

The React package also exports `TypaiContenteditable`, hooks, a settings panel,
and a debug table.

## CodeMirror

```ts
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createTypaiCodeMirrorExtension } from "@typai/codemirror";
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();

new EditorView({
  parent,
  state: EditorState.create({
    doc: "Please fix teh typo.",
    extensions: [createTypaiCodeMirrorExtension({ typai })],
  }),
});
```

The CodeMirror adapter keeps code/Markdown protection rules separate from prose
correction behavior.

## Optional Completion

```ts
import {
  createEndpointCompletionProvider,
  createRemoteCompletion,
} from "@typai/completion-remote";

const completion = createRemoteCompletion({
  provider: createEndpointCompletionProvider({
    endpoint: "/api/typai/completion",
  }),
});
```

The browser package talks to your endpoint. The endpoint, not the browser,
owns provider credentials and real provider calls.

## Local Repo Examples

From this checkout:

```sh
pnpm install
pnpm build
pnpm --filter consumer-vanilla-textarea dev
```

Best starting examples:

- `consumer-vanilla-contenteditable`
- `consumer-vanilla-textarea`
- `consumer-react`
- `consumer-codemirror`
- `consumer-completion-with-proxy`

Use [Examples](./examples.md) for the full map.
