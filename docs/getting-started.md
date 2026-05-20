# Getting Started

Use the consumer examples when evaluating Typai from this checkout, or install
the published beta packages from npm. The beta version is `0.0.0-beta.0` under
the `beta` dist-tag.

## npm Beta Install

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
npm install @typai/completion-remote@beta
```

Install `@typai/ui@beta` directly only when intentionally using the support
package. It is support-grade and unstable as an independent design-system API.

## Local Checkout

```sh
pnpm install
pnpm build
pnpm --filter consumer-vanilla-contenteditable dev
```

Try these examples:

- `consumer-vanilla-contenteditable`
- `consumer-vanilla-textarea`
- `consumer-react`
- `consumer-codemirror`
- `consumer-completion-with-proxy`

## Contenteditable Quickstart

```ts
import { attachContenteditable } from "@typai/contenteditable";
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
const detach = attachContenteditable({ element, typai });
```

## Textarea Quickstart

```ts
import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

const typai = await createTypaiCore();
const detach = attachTextarea({
  textarea,
  typai,
  overlay: { enabled: true },
});
```

## React Quickstart

```tsx
import { createTypaiCore } from "@typai/core";
import { TypaiProvider, TypaiTextarea } from "@typai/react";

export function Editor() {
  return (
    <TypaiProvider createCore={createTypaiCore}>
      <TypaiTextarea defaultValue="Type here." />
    </TypaiProvider>
  );
}
```

## CodeMirror Quickstart

```ts
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createTypaiCodeMirrorExtension } from "@typai/codemirror";
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
const view = new EditorView({
  parent,
  state: EditorState.create({
    doc: "Type here.",
    extensions: [createTypaiCodeMirrorExtension({ typai })],
  }),
});
```

## Completion With Proxy Quickstart

```ts
import {
  createEndpointCompletionProvider,
  createRemoteCompletion,
} from "@typai/completion-remote";

const remote = createRemoteCompletion({
  provider: createEndpointCompletionProvider({
    endpoint: "http://localhost:8787/api/typai/completion",
  }),
});
```

Point the endpoint at a server-side proxy running in mock mode. Do not put
provider credentials in browser code.

## Current Beta Limits

- production dictionary and frequency assets are not bundled
- deterministic correction does not require a server
- completion provider credentials must stay on the server side
- no real Codex adapter, grammar/style, local inference, or next-edit logging is
  included
