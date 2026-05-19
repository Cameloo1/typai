![typai title image](./docs/typai-title.png)

# typai

typai is a local deterministic correction layer for browser writing surfaces,
with optional remote completion kept in a separate package and routed through
embedder-owned endpoints.

Status: V4.2 public-beta readiness is complete. The current phase is
Intelligence Quality Foundation. Packages are local-ready and tested from this
workspace, but they have not been published to npm.

## Current Phase

Intelligence Quality Foundation has started after V4.2 Provider + Public Beta
Readiness.

- deterministic correction remains local through `@typai/core`
- completion is optional through `@typai/completion-remote`
- provider examples keep credentials server-side
- automated tests and demos use mock providers
- no direct browser-to-provider path is supported
- no production dictionary asset, Codex adapter, next-edit logging, or local
  model inference is included
- current local spell coverage is narrow until the approved production
  dictionary/SymSpell-quality candidate path lands

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
- [Security](./docs/security.md)
- [Privacy](./docs/privacy.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Roadmap](./docs/roadmap.md)
- [V4.2 completion checkpoint](./docs/v4-2-provider-public-beta-readiness-complete.md)
- [Intelligence Quality Foundation](./docs/intelligence-quality-foundation.md)
- [Spell quality baseline](./docs/spell-quality-baseline.md)
- [Dictionary source selection](./docs/dictionary-source-selection.md)
- [Dictionary production approval](./docs/dictionary-production-approval.md)

## Verification

```sh
pnpm build
pnpm test
pnpm lint
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
