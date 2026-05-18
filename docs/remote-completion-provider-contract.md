# Remote Completion Provider Contract

Status date: 2026-05-18.

This document defines the V4 endpoint provider contract for
`@typai/completion-remote`.

## Boundary

The browser package calls an embedder-controlled endpoint. The embedder endpoint
calls OpenAI Responses API or another provider from server-side code.

Private provider keys must remain server-side. Do not put private provider keys
in browser JavaScript, browser examples, static config, or Typai package
options. The endpoint provider accepts endpoint headers for the embedder
endpoint only; it is not a direct browser provider-key path.

`@typai/completion-remote` does not include an OpenAI SDK dependency and does
not call OpenAI directly from the browser.

## Browser Request

The endpoint provider sends a `POST` request to the configured endpoint:

```json
{
  "request": {
    "id": "request-1",
    "mode": "prompt",
    "contextBefore": "Write a concise release note",
    "contextAfter": "",
    "currentLine": "Write a concise release note",
    "cursorOffset": 28,
    "maxCompletionChars": 220,
    "stopSequences": [],
    "instruction": {
      "task": "continue",
      "style": "same_voice",
      "output": "continuation_only",
      "constraints": [
        "Return only text that should be inserted at the cursor."
      ]
    }
  }
}
```

## Endpoint Response

The endpoint must return JSON with a completion string:

```json
{
  "text": " for the V4 remote completion prototype.",
  "model": "gpt-5.2",
  "usage": {
    "inputTokens": 120,
    "outputTokens": 12
  },
  "finishReason": "stop"
}
```

`text` is required. `model`, `usage`, and `finishReason` are optional.

## Backend Pseudo-Code

The backend shape is intentionally host-owned. This is pseudo-code only, not a
Typai server implementation:

```ts
app.post("/api/typai/complete", async (req, res) => {
  const { request } = req.body;

  const response = await provider.responses.create({
    model: "gpt-5.2",
    instructions: "Continue the user's text. Return only the continuation.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: request.contextBefore,
          },
        ],
      },
    ],
  });

  res.json({
    text: response.output_text ?? "",
    model: "gpt-5.2",
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    },
    finishReason: response.status,
  });
});
```

OpenAI Responses API is the recommended OpenAI path for new direct model
requests. The Typai browser package still talks only to the embedder endpoint;
the OpenAI call belongs behind that endpoint.

## V4.0 Behavior

- Non-streaming only.
- `fetch` with `POST`.
- AbortSignal cancellation.
- Timeout enforcement.
- Runtime response validation.
- Safe typed provider errors.
- No auto-retry.
- No streaming.
- No ghost text renderer.
- No next-edit logging.

Streaming is future optional work and is not implemented yet.
