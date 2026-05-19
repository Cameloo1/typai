# Deterministic Correction

Deterministic correction is Typai's local path. It runs in `@typai/core` and
does not call a server, daemon, provider, extension, localhost service, or model.

The editor adapter extracts a completed token. The core returns one of:

- an automatic correction
- suggestions for an unresolved token
- no action

Adapters apply the result in the editor surface and record transactions for
exact revert.

Current correction behavior is intentionally narrow:

- common-typo autocorrection
- edit-distance suggestions
- personal dictionary APIs
- protected-token guards

Grammar, style, tone, clarity, local inference, and next-edit logging are not
part of this path.
