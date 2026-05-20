# Installation

Typai `0.0.0-beta.0` is available on npm under the `beta` dist-tag. Install the
core package plus the editor adapter you need.

## npm Beta Packages

```sh
npm install @typai/core@beta @typai/contenteditable@beta
npm install @typai/core@beta @typai/textarea@beta
npm install @typai/core@beta @typai/react@beta
npm install @typai/core@beta @typai/codemirror@beta
npm install @typai/completion-remote@beta
```

`@typai/ui` is a required support package for packages that depend on it and is
installed transitively. Install `@typai/ui@beta` directly only if you are
intentionally using the support package; it is unstable as an independent
design-system API.

Pin the exact beta version when reproducibility matters:

```sh
npm install @typai/core@0.0.0-beta.0 @typai/textarea@0.0.0-beta.0
```

## Workspace Examples

From this checkout:

```sh
pnpm install
pnpm build
pnpm --filter consumer-react dev
```

Each consumer example declares `workspace:*` dependencies on the Typai packages
it uses.

## Local Package Smoke

Use the release-readiness smoke checks before treating the packages as
installable artifacts:

```sh
pnpm pack:dry
pnpm smoke:install
```

These checks verify package contents, import surfaces, and local package
installation without publishing.

The smoke checks install local package artifacts, not registry packages. They
also keep production language assets blocked and completion providers in mock or
server-owned paths.

## Registry Smoke

The post-publish registry smoke installs public npm `@beta` packages into a
temporary consumer outside the repo. It does not use workspace symlinks or local
tarballs.

The production dictionary/frequency asset is not bundled. Deterministic
correction works locally without a server, and optional completion must use a
server-owned provider proxy. Do not place provider API keys in browser code.
