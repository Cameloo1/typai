# Release Checklist

Typai is not published to npm yet. This checklist is the manual release gate for
future public beta packaging.

## Required State

- Git status is clean before starting release work.
- Version dry-run has been reviewed.
- Changelog or release notes exist for any breaking public API change.
- Public API stability labels are current.
- Package metadata audit passes.
- Package secret scan passes.
- Package tarball inspection passes.
- Generated artifacts are not tracked.
- No provider credentials are committed.
- No real provider calls run in CI.
- Manual publish approval is recorded before any registry action.

## Required Commands

```sh
pnpm test
pnpm build
pnpm lint
pnpm test:e2e
pnpm bench:browser
pnpm pack:dry
pnpm smoke:install
pnpm scan:package-secrets
pnpm release:check
pnpm release:version:dry
pnpm release:publish:dry
```

## Package Set

Public beta candidates:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`, because `@typai/react` and `@typai/codemirror` currently depend
  on it. It remains internal and unstable even when packed for release.

Internal packages and examples stay private unless a later prompt explicitly
changes the package boundary.

## Deferred Gates

- Public beta smoke matrix, once added later.
- CI release-readiness workflow, once added later.
- Real npm publish, only after explicit manual approval.
