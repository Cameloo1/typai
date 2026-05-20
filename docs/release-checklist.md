# Release Checklist

Typai is not published to npm yet. This checklist is the manual release gate for
future public beta packaging.

## Required State

- Git status is clean before starting release work.
- Version dry-run has been reviewed.
- `docs/beta-release-candidate-plan.md` has been reviewed.
- `CHANGELOG.md` has been reviewed.
- `docs/production-language-asset-rc-complete.md` has been reviewed.
- Changelog or release notes exist for any breaking public API change.
- Public API stability labels are current.
- Package metadata audit passes.
- Package secret scan passes.
- Package tarball inspection passes.
- Package size report passes.
- Language asset benchmark passes.
- Public beta smoke matrix passes from packed tarballs.
- Public beta readiness CI is green.
- Production language assets remain blocked and absent from tarballs unless the
  production manifest is approved with package-visible license and attribution.
- V4.2 hardening checkpoint has been reviewed when releasing from the V4.2
  baseline.
- Intelligence Quality Foundation checkpoint has been reviewed when releasing
  with the current spell-quality gates.
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
pnpm bench:spell-quality
pnpm bench:language-asset
pnpm bench:browser
pnpm pack:dry
pnpm package:size-report
pnpm smoke:install
pnpm smoke:public-beta
pnpm scan:package-secrets
pnpm release:check
pnpm release:version:dry
pnpm release:pack
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

- Real npm publish, only after explicit manual approval.

## Public Beta Readiness CI

`.github/workflows/public-beta-readiness.yml` is the CI gate for beta
packaging. It uses frozen installs, builds, lint, unit tests, Chromium and
Firefox E2E, axe/accessibility specs, deterministic correction benchmarks,
language asset benchmarks, browser completion benchmarks, package dry-runs,
package size reports, install smoke, `pnpm smoke:public-beta`, release
dry-runs, package secret scan, and provider proxy contract tests.

The workflow intentionally does not run WebKit, does not require provider
secrets, does not run the manual real-provider smoke, and does not publish.

## V4.2 Checkpoint

The completed V4.2 audit is recorded in
`docs/v4-2-provider-public-beta-readiness-complete.md`. Review it before the
first public beta publish so package boundaries, provider security defaults,
manual real-provider gates, and preserved non-goals are still accurate.

## Intelligence Quality Foundation Checkpoint

The completed intelligence quality audit is recorded in
`docs/intelligence-quality-foundation-complete.md`. Review it before publishing
from the current branch so dictionary asset status, spell-quality gates,
surface parity, completion boundaries, and preserved non-goals are still
accurate.

## Production Language Asset RC Checkpoint

Before public beta packaging, review
`docs/production-language-asset-rc.md` and
`docs/production-language-asset-rc-complete.md` plus
`docs/dictionary-production-approval.md`. The current release candidate keeps
production language assets host-provided only while manifest review is blocked;
packed tarballs must not include raw source files, generated production
dictionary binaries, frequency tables, or blocked production attribution files.
