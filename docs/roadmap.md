# Roadmap

Current phase: public beta published at `0.0.0-beta.0` with registry smoke
complete.

Completed readiness scope:

- consumer examples
- public-beta docs
- provider proxy contract and examples
- server-side OpenAI Responses example path, disabled by default
- release dry-runs and smoke checks
- security, privacy, and API stability documentation
- production language asset blocker documentation
- local tarball audit documentation
- npm beta package publish
- registry smoke from public npm packages

Current release boundary:

- npm beta packages are available under the `beta` dist-tag
- the `latest` dist-tag also points at `0.0.0-beta.0` because these were first
  publishes; do not move tags without an explicit release decision
- public docs may show beta install guidance
- post-publish remediation should use beta patch, deprecation, or dist-tag
  changes rather than rewriting public history
- production language assets remain blocked and host-provided only

Out of scope for the beta:

- production dictionary asset
- Codex adapter
- local model inference
- next-edit logging
- grammar, style, tone, or clarity features
- ProseMirror or Monaco adapters
- direct browser-to-provider calls

Future work should preserve the local correction boundary and add advanced
capabilities as explicit opt-in packages or later phases.
