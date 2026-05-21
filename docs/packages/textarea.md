# @typai/textarea

`@typai/textarea` attaches Typai correction to a native `<textarea>`.

The textarea value remains the source of truth. Overlay rendering is visual and
does not insert markup into the textarea.

Use it for:

- local correction in textarea fields
- overlay red/blue marks
- protected-token skips
- exact correction revert
- optional completion controller support

Quickstart:

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
