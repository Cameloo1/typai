# Roadmap

Current phase: prepublish public beta documentation and guarded release
readiness.

Completed readiness scope:

- consumer examples
- public-beta docs
- provider proxy contract and examples
- server-side OpenAI Responses example path, disabled by default
- release dry-runs and smoke checks
- security, privacy, and API stability documentation
- production language asset blocker documentation
- local tarball audit documentation

Current release boundary:

- no npm publish has occurred
- no registry smoke has run
- public docs must not claim public registry availability
- guarded publish remains the next step after manual approval and a clean gate
- production language assets remain blocked and host-provided only

Out of scope for the beta:

- npm publish
- production dictionary asset
- Codex adapter
- local model inference
- next-edit logging
- grammar, style, tone, or clarity features
- ProseMirror or Monaco adapters
- direct browser-to-provider calls

Future work should preserve the local correction boundary and add advanced
capabilities as explicit opt-in packages or later phases.
