# Getting Started

Use the consumer examples when evaluating Typai from this checkout. They are
small on purpose and avoid the full demo app.

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
