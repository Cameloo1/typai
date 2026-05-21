# @typai/codemirror

`@typai/codemirror` provides a CodeMirror 6 extension.

Use it for:

- deterministic correction in CodeMirror
- red unresolved spelling decorations
- blue applied-correction decorations
- correction transactions
- optional ghost completion decorations

Quickstart:

```ts
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createTypaiCodeMirrorExtension } from "@typai/codemirror";
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
new EditorView({
  parent,
  state: EditorState.create({
    doc: "Type here.",
    extensions: [createTypaiCodeMirrorExtension({ typai })],
  }),
});
```
