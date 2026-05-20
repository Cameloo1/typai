# Beta Publish Result

Status date: 2026-05-20T14:17:20.4940464-05:00

## Result

- published: false
- publishAttemptStatus: failed-before-first-package
- version: 0.0.0-beta.0
- distTag: beta
- npmUsername: camelo1
- branch: codex/fix
- commit: 60df679
- gitTag: v0.0.0-beta.0
- gitTagStatus: none

## Packages Attempted

1. @typai/ui

The publish attempt stopped at the first package. No later package publish commands were run.

## Packages Published

None.

Post-failure registry availability checks confirmed that these exact package versions remain unpublished:

- @typai/ui@0.0.0-beta.0
- @typai/core@0.0.0-beta.0
- @typai/completion-remote@0.0.0-beta.0
- @typai/contenteditable@0.0.0-beta.0
- @typai/textarea@0.0.0-beta.0
- @typai/react@0.0.0-beta.0
- @typai/codemirror@0.0.0-beta.0

## Failure

- failedPackage: @typai/ui
- failedCommand: npm publish .pack\typai-ui-0.0.0-beta.0.tgz --tag beta --access public
- npmErrorCode: E403
- npmErrorSummary: Two-factor authentication or a granular access token with bypass 2FA enabled is required to publish packages.

No unpublish or dist-tag mutation was attempted.

## Dist-Tag Results

No beta dist-tags were created because no package was published.

No latest dist-tags were created or modified.

## Asset And Provider Status

- Production language asset status: blocked / host-provided only.
- No production dictionary binary was bundled.
- No production frequency table was bundled.
- No raw ESDB, SCOWL, Hunspell, or Google Books Ngram source files were bundled.
- No browser API-key path was added.
- No real provider calls occurred.

## Next Step

Configure npm publishing with one of the approved npm release authentication paths, then rerun the guarded Prompt 126 publish flow:

- use an interactive npm publish flow that can satisfy the account 2FA challenge, or
- use a granular npm access token that is allowed to publish the `@typai` packages and is configured with the required 2FA bypass policy.

After authentication is corrected, rerun the same gated publish checks before any publish attempt. Do not move to registry smoke until a later `docs/beta-publish-result.md` records `published: true`.
