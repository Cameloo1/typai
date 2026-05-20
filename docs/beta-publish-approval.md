# Beta Publish Approval Record

Current date: 2026-05-20.
Current commit hash: `dc9e681ae913f4a9fb473d324dbd5967c902b0f0`.

This record prepares the Typai beta publish approval gate. It does not approve
publishing, change package versions, create a Git tag, or bundle production
language assets.

Structured approval sidecar: `release/beta-approval.json`.

## Release Target

- Target version: `0.0.0-beta.0`
- Target npm dist-tag: `beta`
- Target Git tag: `v0.0.0-beta.0`
- Current workspace package version: `0.0.0-dev`
- Go/no-go status: **NO-GO until manual approval is completed and the worktree
  is clean**

## Source-Control Preflight

Required commands were run at approval-record creation:

- `git status --short`
- `git log --oneline -15`
- `git branch --show-current`

Current branch: `codex/fix`.

Pre-existing dirty files were observed before this approval gate was created.
They are classified as release-related documentation or release-gate cleanup
from the beta candidate boundary, not unrelated feature work:

- `README.md`: release-related public docs link boundary cleanup
- `docs/README.md`: release-related public docs link boundary cleanup
- `docs/beta-release-candidate-plan.md`: release-related beta RC reference
  cleanup
- `docs/production-asset-gate-recap.md`: release-related production asset
  recap cleanup
- `scripts/check-docs.mjs`: release-related docs gate cleanup
- `scripts/dictionary-gate-status.mjs`: release-related dictionary gate cleanup

No unrelated dirty files were identified during this preflight. The beta publish
must remain blocked until a fresh `git status --short` is clean after these
pre-existing edits and this approval-gate commit are resolved.

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

1. `@typai/core`
2. `@typai/contenteditable`
3. `@typai/textarea`
4. `@typai/ui`
5. `@typai/react`
6. `@typai/codemirror`
7. `@typai/completion-remote`

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

The following fields must be filled manually before any version bump, Git tag,
or npm publish. Default approval status is pending.

```yaml
approvedBy:
approvedAt:
approvedVersion:
approvedDistTag:
approvedGitTag:
approvedPackageSet:
approvedPublishOrder:
approvedAssetStatus:
approvedRollbackPlan:
approvalStatus: pending
```

Allowed approval statuses:

- `pending`
- `approved`
- `rejected`
