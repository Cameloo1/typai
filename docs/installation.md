# Installation

Typai is not published to npm yet. Use workspace packages or local packed
tarballs during public-beta readiness.

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

## After Publish

Registry install commands will be documented only after an actual publish. Until
then, avoid copying hypothetical package-manager commands into consumer docs.
