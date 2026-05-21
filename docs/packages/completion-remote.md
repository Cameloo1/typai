# @typai/completion-remote

`@typai/completion-remote` is optional. It is not imported by `@typai/core`.

Use it for:

- `createRemoteCompletion()`
- `createMockCompletionProvider()`
- `createEndpointCompletionProvider()`
- contenteditable completion controller wiring
- completion metrics
- abort, timeout, stale response, and rate-limit handling

Endpoint quickstart:

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

The endpoint should be an embedder-owned server route. Mock providers remain the
default for tests and demos.
