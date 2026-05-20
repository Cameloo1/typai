![typai title image](./docs/typai-title.png)

# typai

typai is a local deterministic correction layer for browser writing surfaces,
with optional remote completion kept in a separate package and routed through
embedder-owned endpoints.

Status: V4.2 public-beta readiness, Intelligence Quality Foundation, and the
Production Language Asset + Beta Release Candidate checkpoint are complete.
The `0.0.0-beta.0` package set is published on npm under the `beta` dist-tag
and has passed registry smoke from public npm packages.

## Current Phase

Production Language Asset + Beta Release Candidate is complete in the current
blocked-production-asset state.

- deterministic correction remains local through `@typai/core`
- completion is optional through `@typai/completion-remote`
- provider examples keep credentials server-side
- automated tests and demos use mock providers
- the full demo has an optional local proxy completion mode for manual
  real-provider checks
- no direct browser-to-provider credential path is supported
- no production dictionary asset, Codex adapter, next-edit logging, or local
  model inference is included
- current local spell coverage now includes delete-index suggestions and an
  audited common-typo autocorrect gate, but it is still not production
  dictionary coverage until an approved production asset lands
- spell-quality benchmark gates and cross-surface E2E now guard the current
  safety baseline
- production language asset RC gates are complete, but no production
  dictionary/frequency asset is bundled until the remaining source, hash,
  generated output, size, quality, and review blockers are closed
- the deterministic production transform pipeline exists, but package inclusion
  is currently host-provided only while the production manifest is blocked
- beta release candidate docs and release dry-run scripts are in place
- npm beta publish completed for the seven approved packages
- registry smoke passed from public npm `@beta` packages
- the `latest` dist-tag currently also points at `0.0.0-beta.0` because these
  were first publishes; move it only through an explicit release decision
- the next release step is selecting the next phase or beta patch/remediation

## Packages

- `@typai/core` - deterministic correction engine and storage APIs
- `@typai/contenteditable` - contenteditable adapter
- `@typai/textarea` - native textarea adapter and overlay
- `@typai/react` - React provider, hooks, and components
- `@typai/codemirror` - CodeMirror 6 extension
- `@typai/completion-remote` - optional completion scheduler and providers
- `@typai/ui` - required support package for public packages; unstable as an
  independent design-system API

## Quick Start

```sh
npm install @typai/core@beta @typai/textarea@beta
```

Use the package pair for your surface:

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
npm install @typai/completion-remote@beta
```

`@typai/ui` is installed transitively by packages that need it. Install
`@typai/ui@beta` directly only when intentionally using the support package; it
is not a stable independent design-system API.

## Docs

- [Docs index](./docs/README.md)
- [Getting started](./docs/getting-started.md)
- [Installation](./docs/installation.md)
- [Examples](./docs/examples.md)
- [Real-provider demo](./docs/real-provider-demo.md)
- [Security](./docs/security.md)
- [Privacy](./docs/privacy.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Roadmap](./docs/roadmap.md)
- [Changelog](./CHANGELOG.md)
- [Beta release candidate plan](./docs/beta-release-candidate-plan.md)
- [Beta known issues](./docs/beta-known-issues.md)
- [Beta rollback guidance](./docs/beta-rollback-guidance.md)
- [Production asset gate recap](./docs/production-asset-gate-recap.md)
- [Common typo table](./docs/common-typo-table.md)
- [Dictionary source selection](./docs/dictionary-source-selection.md)
- [Dictionary production approval](./docs/dictionary-production-approval.md)

## Verification

```sh
pnpm build
pnpm test
pnpm lint
pnpm bench:spell-quality
pnpm bench:language-asset
pnpm docs:check
pnpm pack:dry
pnpm smoke:install
pnpm smoke:public-beta
pnpm scan:package-secrets
pnpm package:size-report
pnpm release:check
```

The public beta smoke matrix installs packed local tarballs into temporary
consumer apps and uses mock provider paths only. The registry smoke documented
in `docs/beta-registry-smoke.md` installs public npm `@beta` packages without
workspace symlinks or local tarballs.

## License

License not selected yet.
