# Beta Publish Approval Record

Current date: 2026-05-20.
Current commit hash: `9dd130dbbf345c15c282c1c067c33955e554618a`.

Remote `fix` base verified before approval update:
`50cb71e981ef6c2aba7f42fb7abfc80861a7be1b`.

This record approves the Typai beta publish plan for later release prompts. It
does not publish packages, change package versions, create a Git tag, or bundle
production language assets.

Structured approval sidecar: `release/beta-approval.json`.

## Release Target

- Target version: `0.0.0-beta.0`
- Target npm dist-tag: `beta`
- Target Git tag: `v0.0.0-beta.0`
- Current workspace package version: `0.0.0-dev`
- Approval status: **approved**
- Go/no-go status: **GO for the later approved beta version-bump and guarded
  publish path; NO-GO for npm publish, Git tag creation, or version bump in
  this prompt**

## Source-Control Preflight

Required commands were run at approval-record creation:

- `git status --short`
- `git log --oneline -15`
- `git branch --show-current`

Current branch: `codex/fix`.

Prompt 122 source-control preflight found dirty files limited to release
approval and docs-gate records:

- `docs/beta-publish-approval.md`: release-related manual beta approval record
- `release/beta-approval.json`: release-related structured beta approval record
- `scripts/check-docs.mjs`: release-related docs gate state observed before
  approval update

No unrelated dirty files were identified during this preflight. The local branch
history is intentionally not treated as directly pushable because earlier work
remains unsquashed locally. Any remote update must use the reviewed squash
commit SHA prepared from the current `origin/fix` base.

The beta publish remains blocked until later publish gates pass and a fresh
`git status --short` is clean.

## Package Publish Set

Public beta package candidates:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

Required support package:

- `@typai/ui`

`@typai/ui` is included because public packages depend on it. It remains a
required support package and is unstable as an independent design-system API.

## Package Publish Order

1. `@typai/ui`
2. `@typai/core`
3. `@typai/completion-remote`
4. `@typai/contenteditable`
5. `@typai/textarea`
6. `@typai/react`
7. `@typai/codemirror`

## Private Package Exclusions

Private workspace packages, examples, and testkit packages are excluded from
the beta publish set unless explicitly approved in a later release prompt:

- root workspace package `typai`
- `@typai/adapter-testkit`
- `@typai/provider-proxy-testkit`
- `@typai/provider-proxy-example-utils`
- `simple-demo-editor`
- `provider-proxy-express`
- `provider-proxy-next`
- `provider-proxy-cloudflare-worker`
- `consumer-vanilla-contenteditable`
- `consumer-vanilla-textarea`
- `consumer-react`
- `consumer-codemirror`
- `consumer-completion-with-proxy`
- `golden-corpus`

## Production Language Asset Status

Production language asset status: **blocked / host-provided only**.

- No production dictionary binary is committed or packed.
- No production frequency table is committed or packed.
- No raw ESDB/SCOWL, Hunspell, or Google Books Ngram source files are committed
  or packed.
- `dictionary.mode: "production"` remains reserved and unavailable while review
  status is blocked.
- Host-provided Typai Dictionary Blob v1 bytes may be loaded during
  `createTypaiCore()` initialization.

Explicit limitation: the production dictionary/frequency asset is not bundled.

## Rollback Plan

If a manually approved beta publish fails after registry release:

- Stop additional package publishing immediately.
- Use npm deprecation for affected beta versions when npm policy allows it.
- Publish a corrected beta patch such as `0.0.0-beta.1` when deprecation is not
  sufficient or unpublish policy no longer applies.
- Keep Git tag and commit evidence intact; do not rewrite public release
  history.
- Re-run package smoke, public beta smoke, package secret scan, package size
  report, release dry-runs, docs check, production dictionary check, build, and
  lint before any replacement publish.
- If a production asset inclusion issue is found, remove the asset path and
  return to host-provided-only behavior before the next beta.

## Manual Approval Checklist

The following fields have been manually approved for the beta publish path.
This approval does not run a version bump, create a Git tag, or publish to npm.

```yaml
approvedBy: wasif
approvedAt: 2026-05-20T11:58:34.8823642-05:00
approvedVersion: 0.0.0-beta.0
approvedDistTag: beta
approvedGitTag: v0.0.0-beta.0
approvedPackageSet:
  - @typai/core
  - @typai/contenteditable
  - @typai/textarea
  - @typai/react
  - @typai/codemirror
  - @typai/completion-remote
  - @typai/ui
approvedPublishOrder:
  - @typai/ui
  - @typai/core
  - @typai/completion-remote
  - @typai/contenteditable
  - @typai/textarea
  - @typai/react
  - @typai/codemirror
approvedAssetStatus: production language asset blocked / host-provided only
approvedRollbackPlan: Use beta dist-tag remediation, deprecate bad beta if needed, publish a corrected beta patch such as 0.0.0-beta.1, never rewrite public release history, and keep production asset blocked until gates pass.
approvalStatus: approved
```

Allowed approval statuses:

- `pending`
- `approved`
- `rejected`
