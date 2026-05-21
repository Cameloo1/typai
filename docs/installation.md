# Installation

Typai `0.0.0-beta.0` is published on npm under the `beta` dist-tag. The public
registry smoke passed by installing from npm, importing every beta package, and
building vanilla, React, and CodeMirror consumers.

Because this was the first publish for the package names, npm `latest` also
currently points at `0.0.0-beta.0`. Use `@beta` or the exact version in docs,
examples, and reproducible checks until a later release explicitly changes
dist-tags.

## Package Matrix

| Package | Install directly when | Notes |
| --- | --- | --- |
| `@typai/core` | always | local deterministic correction engine |
| `@typai/contenteditable` | using a DOM `contenteditable` surface | depends on core |
| `@typai/textarea` | using native textareas | depends on core |
| `@typai/react` | using React wrappers/hooks | depends on core, contenteditable, textarea, and `@typai/ui` |
| `@typai/codemirror` | using CodeMirror 6 | depends on core and `@typai/ui`; requires CodeMirror peer packages |
| `@typai/completion-remote` | using optional endpoint-backed completion | does not belong to `@typai/core` |
| `@typai/ui` | building against the support UI package directly | support-grade; not stable as an independent design system |

## npm Beta Installs

Pick one adapter:

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
```

Optional completion package:

```sh
npm install @typai/completion-remote@beta
```

Exact version pin:

```sh
npm install @typai/core@0.0.0-beta.0 @typai/textarea@0.0.0-beta.0
```

## Peer Dependencies

React consumers provide React and React DOM:

```sh
npm install react react-dom
```

CodeMirror consumers provide the CodeMirror 6 peer packages used by their app:

```sh
npm install @codemirror/state @codemirror/view @codemirror/language
```

## Local Checkout

Repository examples use workspace dependencies. From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter consumer-react dev
```

If plain `pnpm` is unavailable in a Windows shell, use the repo package manager
through Corepack:

```sh
corepack pnpm build
```

## Package Smoke Paths

Local artifact smoke:

```sh
pnpm pack:dry
pnpm smoke:install
pnpm smoke:public-beta
```

Public registry smoke is recorded in [Beta registry smoke](./beta-registry-smoke.md).
It installed npm `@beta` packages only, with no workspace symlinks or local
tarballs.

Release hygiene note: the first beta was a manual tarball publish. Future
publishes should use [Trusted Publishing setup](./trusted-publishing-setup.md).
The current `latest` dist-tag and missing beta Git tag are parked in
[Release hygiene parked](./release-hygiene-parked.md).

## Important Boundaries

- Production dictionary/frequency assets are not bundled.
- `dictionary.mode: "production"` is unavailable while the asset gate is
  blocked.
- Host-provided Typai Dictionary Blob v1 bytes are the supported external asset
  path.
- Deterministic correction does not require a server.
- Completion is optional and must use mock providers or a server-owned endpoint.
- Browser code must not receive provider credentials.
