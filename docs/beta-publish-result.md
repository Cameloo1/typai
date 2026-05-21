# Beta Publish Result

Status date: 2026-05-20T15:52:50.4588811-05:00.

## Result

- published: true
- method: manual npm tarball publish observed on the public registry
- trustedPublishingWorkflowDispatched: false
- workflow filename: `.github/workflows/npm-beta-publish.yml`
- workflow run URL: none
- version: `0.0.0-beta.0`
- distTag: `beta`
- npm username observed locally: `camelo1`
- GitHub branch: `codex/fix`
- GitHub commit: `198feab`
- Git tag status: none

The GitHub Actions trusted-publishing workflow was prepared and pushed, but it
was not dispatched for this publish. The publish result below records the actual
public npm registry state. Do not claim this publish used OIDC or npm Trusted
Publishing.

## Packages Published

Approved package set:

1. `@typai/ui@0.0.0-beta.0`
2. `@typai/core@0.0.0-beta.0`
3. `@typai/completion-remote@0.0.0-beta.0`
4. `@typai/contenteditable@0.0.0-beta.0`
5. `@typai/textarea@0.0.0-beta.0`
6. `@typai/react@0.0.0-beta.0`
7. `@typai/codemirror@0.0.0-beta.0`

Observed npm publish times:

- `@typai/ui`: `2026-05-20T20:42:08.000Z`
- `@typai/core`: `2026-05-20T20:42:10.549Z`
- `@typai/completion-remote`: `2026-05-20T20:42:38.278Z`
- `@typai/contenteditable`: `2026-05-20T20:42:58.624Z`
- `@typai/textarea`: `2026-05-20T20:43:03.378Z`
- `@typai/react`: `2026-05-20T20:43:09.720Z`
- `@typai/codemirror`: `2026-05-20T20:43:33.312Z`

## Dist-Tag Results

Each package resolves through `beta` to `0.0.0-beta.0`.

The `latest` dist-tag also points to `0.0.0-beta.0` for every package because
these were first publishes. No dist-tag mutation was attempted in this prompt.
If policy requires `latest` not to point at beta, make that a separate explicit
release decision and document the registry change.

## Asset And Provider Status

- Production language asset status: blocked / host-provided only.
- No production dictionary binary is bundled.
- No production frequency table is bundled.
- No raw ESDB, SCOWL, Hunspell, or Google Books Ngram source files are bundled.
- No browser API-key path was added.
- No real provider calls occurred in repo validation or registry smoke.
- No `NPM_TOKEN` or `NODE_AUTH_TOKEN` is referenced by the trusted-publishing
  workflow.

## Next Step

Run and record public registry smoke, update public docs with npm beta install
guidance, and decide the next phase explicitly.
