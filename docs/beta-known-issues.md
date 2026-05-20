# Beta Known Issues

Status date: 2026-05-20.

Typai `0.0.0-beta.0` is published on npm and registry smoke passed. This page
lists limitations users should know before adopting the beta.

## Package And Release State

- Install with `@beta` or exact `0.0.0-beta.0`.
- npm `latest` currently points at `0.0.0-beta.0` because these were first
  publishes. Treat that as registry mechanics, not a stable-release promise.
- No public Git tag exists for the beta.
- The observed publish was manual npm tarball publish, not trusted
  publishing/OIDC.
- `@typai/ui` is published because public packages depend on it; it is not a
  stable independent design system.

## Language Quality

- Production dictionary/frequency assets are not bundled.
- Spell coverage is intentionally conservative.
- The common typo table autocorrects only reviewed non-word typos.
- Delete-index candidates are suggestions unless explicitly promoted.
- Valid-word and real-word/context autocorrection are not implemented.
- English scope is currently the supported correction path.

Concrete examples:

- `teh` can autocorrect to `the`.
- `form` must not autocorrect.
- URLs, emails, paths, identifiers, and code-like spans should be protected.

## Provider And Completion Limits

- Completion is optional and separate from `@typai/core`.
- Real provider calls are manual and server-side only.
- Browser packages accept endpoint configuration, not provider credentials.
- Tests, demos, CI, public-beta smoke, and registry smoke use mock provider
  paths unless a manual real-provider gate is explicitly opened.
- Provider proxy examples are examples, not hosted infrastructure.

## Editor/Product Limits

- Textarea marks use an overlay because native textareas cannot render inline
  spans.
- CodeMirror protection behavior is conservative around code and Markdown.
- WebKit is not part of the current readiness claim when local E2E skips it.
- There is no real Codex adapter.
- There is no grammar/style/tone/clarity layer.
- There is no local model inference.
- There is no next-edit logging.
- There is no browser extension.
- There are no ProseMirror or Monaco adapters.

## What To Do If This Blocks Adoption

- Need better spelling coverage: prioritize Production Asset Unblock.
- Need dogfooding or flagship integration: prioritize Real Codex Adapter.
- Need writing-assistant breadth: prioritize a separate grammar/style phase.
- Need install-anywhere coverage: prioritize browser extension after privacy
  and provider boundaries are hardened.
