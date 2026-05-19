![typai title image](./docs/typai-title.png)

# typai

typai is a local deterministic correction layer for browser writing surfaces,
with optional remote completion kept in a separate package and routed through
embedder-owned endpoints.

Status: V4.2 public-beta readiness and Intelligence Quality Foundation are
complete. Production Language Asset + Beta Release Candidate work is active.
Packages are local-ready and tested from this workspace, but they have not been
published to npm.

## Current Phase

Production Language Asset + Beta Release Candidate follows the completed
Intelligence Quality Foundation.

- deterministic correction remains local through `@typai/core`
- completion is optional through `@typai/completion-remote`
- provider examples keep credentials server-side
- automated tests and demos use mock providers
- the full demo has an optional local proxy completion mode for manual
  real-provider checks
- no direct browser-to-provider path is supported
- no production dictionary asset, Codex adapter, next-edit logging, or local
  model inference is included
- current local spell coverage now includes delete-index suggestions and an
  audited common-typo autocorrect gate, but it is still not production
  dictionary coverage until an approved production asset lands
- spell-quality benchmark gates and cross-surface E2E now guard the current
  safety baseline
- production language asset RC work is next, but no production
  dictionary/frequency asset is bundled until source, license, attribution,
  manifest, hash, transform, size, quality, and review gates pass
- the deterministic production transform pipeline exists, but package inclusion
  is currently host-provided only while the production manifest is blocked
- npm publish has not happened

## Packages

- `@typai/core` - deterministic correction engine and storage APIs
- `@typai/contenteditable` - contenteditable adapter
- `@typai/textarea` - native textarea adapter and overlay
- `@typai/react` - React provider, hooks, and components
- `@typai/codemirror` - CodeMirror 6 extension
- `@typai/completion-remote` - optional completion scheduler and providers

## Quick Start

```sh
pnpm install
pnpm build
pnpm --filter consumer-vanilla-textarea dev
```

The consumer examples use workspace packages. Registry install instructions
will be added after a real npm publish.

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
- [V4.2 completion checkpoint](./docs/v4-2-provider-public-beta-readiness-complete.md)
- [Production Language Asset RC](./docs/production-language-asset-rc.md)
- [Production asset gate recap](./docs/production-asset-gate-recap.md)
- [Intelligence Quality Foundation](./docs/intelligence-quality-foundation.md)
- [Intelligence Quality Foundation checkpoint](./docs/intelligence-quality-foundation-complete.md)
- [Spell quality baseline](./docs/spell-quality-baseline.md)
- [Spell quality report](./docs/spell-quality-report.md)
- [Common typo table](./docs/common-typo-table.md)
- [Spell false-positive review](./docs/spell-false-positive-review.md)
- [Dictionary source selection](./docs/dictionary-source-selection.md)
- [Dictionary production approval](./docs/dictionary-production-approval.md)

## Verification

```sh
pnpm build
pnpm test
pnpm lint
pnpm bench:spell-quality
pnpm docs:check
pnpm pack:dry
pnpm smoke:install
pnpm smoke:public-beta
pnpm scan:package-secrets
pnpm release:check
```

The public beta smoke matrix installs packed local tarballs into temporary
consumer apps and uses mock provider paths only.

## License

License not selected yet.
