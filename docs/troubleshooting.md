# Troubleshooting

## Nothing Corrects

Check that the core has loaded and the adapter is attached. For textarea,
verify the textarea is not disabled or read-only.

## Textarea Marks Look Offset

The textarea overlay is visual. Keep textarea font, padding, line-height, and
box sizing stable. Call the adapter's resync method after layout changes.

## Completion Does Not Appear

Completion is optional. Confirm that:

- a completion controller is configured
- the prefix is long enough
- the endpoint is reachable
- the proxy is running in mock mode for local examples
- the request was not dismissed by typing, blur, selection change, or Escape

## Provider Proxy Returns Errors

Proxy errors are intentionally safe and terse. Inspect server-side redacted logs
for request ID, status, provider mode, context length, completion length, and
latency. Do not log full context by default.

## Package Imports Fail

These examples use workspace packages. Run `pnpm install` and `pnpm build` from
the repository root before running a consumer example.
