![typai title image](./docs/typai-title.png)

# typai

typai is a local deterministic correction layer for browser writing surfaces,
with optional remote completion kept in a separate package and routed through
embedder-owned endpoints.

Status: V4.2 public-beta readiness and Intelligence Quality Foundation are
complete. Packages are local-ready and tested from this workspace, but they
have not been published to npm.

## Current Phase

Intelligence Quality Foundation completed after V4.2 Provider + Public Beta
Readiness.

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
- [Common typo table](./docs/common-typo-table.md)
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
