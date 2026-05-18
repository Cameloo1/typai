# @typai/completion-remote

Optional remote completion scaffold for Typai.

This package is separate from the deterministic correction core. Installing
`@typai/core`, `@typai/contenteditable`, `@typai/textarea`, `@typai/react`, or
`@typai/codemirror` does not install, import, configure, or enable remote
completion.

V4 includes provider interfaces, request/response types, state-machine types,
local/session metrics, context helpers, sanitization helpers, test-only mock
providers, and a structural contenteditable controller. The ghost text renderer
lives in `@typai/contenteditable`; this package does not make existing
correction adapters depend on remote completion.

V4.1 hardens the provider layer before additional surfaces depend on it. The
endpoint provider now classifies network failures, timeouts, aborts, rate
limits, invalid responses, server errors, and client errors as typed provider
errors. Scheduler request budgets can cap requests per minute, keep the default
one in-flight request per controller/surface, and start a cooldown after rate
limits.

Do not put private provider keys in browser code. Browser integrations should
call an embedder-controlled endpoint, and that endpoint should call the
provider with server-side credentials.

V4 is non-streaming first. Streaming support is represented as an optional
provider method for future phases, but no streaming provider is implemented
here.

## Current API

```ts
import {
  createMockCompletionProvider,
  createRemoteCompletion,
} from "@typai/completion-remote";

const provider = createMockCompletionProvider(" world");
const completion = createRemoteCompletion({ provider });

completion.subscribe((event) => {
  if (event.type === "ghost_shown") {
    console.log(completion.getState());
  }
});

completion.subscribeMetrics((event) => {
  console.log(event.type, event.latencyMs);
});

completion.schedule({
  mode: "prompt",
  contextBefore: "Write the release note",
  contextAfter: "",
  currentLine: "Write the release note",
  cursorOffset: "Write the release note".length,
});
```

The scheduler debounces input, aborts stale in-flight requests, drops stale
responses, and emits local events without including raw editor context in event
payloads by default. It does not render ghost text or integrate with an editor
surface yet.

Provider failures do not render ghost text, do not mutate editor source text,
and do not create completion transactions. There is no automatic retry by
default.

Request budget example:

```ts
const completion = createRemoteCompletion({
  provider,
  requestBudget: {
    maxRequestsPerMinute: 30,
    maxConcurrentRequests: 1,
    cooldownAfterRateLimitMs: 30_000,
  },
});
```

Endpoint provider:

```ts
import { createEndpointCompletionProvider } from "@typai/completion-remote";

const provider = createEndpointCompletionProvider({
  endpoint: "/api/typai/complete",
});
```

The endpoint provider calls only the embedder endpoint. It does not call model
providers directly from the browser and does not expose a browser provider-key
option.

Endpoint response classification:

- HTTP 429: `rate_limited`.
- HTTP 5xx: `server_error`.
- HTTP 4xx: `client_error`.
- Timeout: `timeout`.
- Abort: `abort`.
- Malformed JSON or response shape: `invalid_response`.

This package includes no OpenAI SDK, React, CodeMirror, server, or local-model
runtime dependency.
