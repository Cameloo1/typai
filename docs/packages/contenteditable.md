# @typai/contenteditable

`@typai/contenteditable` attaches Typai correction to a `contenteditable`
element.

Use it for:

- local correction in editable HTML elements
- red unresolved marks
- blue correction marks
- popover actions
- exact correction revert
- optional completion controller support

Quickstart:

```ts
import { attachContenteditable } from "@typai/contenteditable";
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
const detach = attachContenteditable({ element, typai });
```
