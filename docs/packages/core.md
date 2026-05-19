# @typai/core

`@typai/core` owns deterministic correction.

Use it for:

- creating the Typai core object
- completed-token checks
- token suggestions
- personal dictionary APIs
- correction rule APIs
- storage adapters
- protected-token helpers

Boundary:

- no remote completion dependency
- no provider calls
- no network calls
- no local model inference

Quickstart:

```ts
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
const result = typai.checkCompletedToken({ text: "teh" });
```
