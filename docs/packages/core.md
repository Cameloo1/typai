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
- delete-index/edit-distance candidates are suggestions-only unless the token is
  explicitly listed in the audited common-typo table
- valid words and protected tokens are never autocorrected

Quickstart:

```ts
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore();
const result = typai.checkCompletedToken({ token: "Teh," });
// auto_correct: "The,"
```
