# Installation

Typai is not published to npm yet. Use workspace packages or local packed
tarballs during public-beta readiness.

No public registry install command is documented for the current state. The next
release step is the guarded publish prompt after manual approval, followed by
registry smoke from the beta dist-tag.

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

## After Publish

Registry install commands will be documented only after an actual publish. Until
then, avoid copying hypothetical package-manager commands into consumer docs.
