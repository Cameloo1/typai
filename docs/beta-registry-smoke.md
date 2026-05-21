# Beta Registry Smoke

Status date: 2026-05-21.

## Result

- result: passed
- registry source: public npm registry
- package source: `@beta` dist-tag
- local tarballs used: no
- workspace symlinks used: no
- temp consumer: disposable directory outside the repository
- command: `pnpm smoke:registry-beta`

## Package Versions Installed

- `@typai/ui@0.0.0-beta.0`
- `@typai/core@0.0.0-beta.0`
- `@typai/completion-remote@0.0.0-beta.0`
- `@typai/contenteditable@0.0.0-beta.0`
- `@typai/textarea@0.0.0-beta.0`
- `@typai/react@0.0.0-beta.0`
- `@typai/codemirror@0.0.0-beta.0`

Observed dist-tags for all seven packages:

- `beta`: `0.0.0-beta.0`
- `latest`: `0.0.0-beta.0`

The `latest` tag points at the beta because these packages were first
published at `0.0.0-beta.0`. No tag change was made during registry smoke.

## Scenarios

Core:

- imported `createTypaiCore`
- initialized the core
- verified `teh` autocorrects to `the`
- verified valid word `form` does not autocorrect

Adapters:

- imported `attachContenteditable`
- imported `attachTextarea`
- imported `TypaiProvider`
- imported `TypaiTextarea`
- imported `TypaiContenteditable`
- imported `createTypaiCodeMirrorExtension`

Completion:

- imported `createRemoteCompletion`
- imported `createMockCompletionProvider`
- imported `createEndpointCompletionProvider`
- created a mock provider and controller
- created an endpoint provider object without making a network/provider call

Build consumers:

- registry-installed runtime package matrix: passed
- host-provided dictionary bytes: passed
- blocked production dictionary mode: passed
- endpoint completion against local mock proxy: passed

Boundary checks:

- `@typai/core` installed without a direct dependency on
  `@typai/completion-remote`
- no production language asset directory was present in registry-installed
  `@typai/core`
- no browser provider API-key path was exercised
- no real provider calls occurred

## Known Limitations

- Production language asset remains blocked / host-provided only.
- The production dictionary/frequency asset is not bundled.
- Spell coverage is not production dictionary coverage.
- `@typai/ui` is support-grade and unstable as an independent design-system API.
- Real provider completion remains manual and server-side only.
- There is no real Codex adapter.
- There are no grammar, style, tone, or clarity features.
- There is no local inference.
- There is no next-edit logging.

## Rollback Recommendation

If a registry issue is found after this smoke:

- deprecate affected `0.0.0-beta.0` packages when appropriate
- publish a corrected beta patch, such as `0.0.0-beta.1`
- move `beta` only after replacement package smoke passes
- adjust `latest` only through an explicit release decision
- do not rewrite public Git history
