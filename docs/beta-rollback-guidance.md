# Beta Rollback Guidance

Status date: 2026-05-20.

This guidance applies after a future beta publish. In the current repository
state, no npm package has been published and no public Git tag has been created,
so there is no registry rollback action to take.

## If A Published Beta Is Bad

- Deprecate the affected package version when npm policy allows it.
- Publish a corrected beta patch, such as the next beta prerelease, when users
  need a replacement artifact.
- Adjust the beta dist-tag only after confirming the replacement package set and
  smoke result.
- Do not rewrite public Git history.
- Do not silently move package contents without a changelog or release note.

## Asset Issue Response

- If a blocked language asset is found in a published package, treat it as a
  release blocker.
- Return the package boundary to host-provided-only language assets.
- Publish a beta patch that removes the asset path and rerun package secret,
  package size, tarball, install-smoke, and registry-smoke checks.
- Document which package versions are affected and which version is safe.

## Provider Proxy Issue Response

- Disable or document the unsafe provider path immediately.
- Keep provider credentials on server-owned infrastructure.
- Prefer a beta patch that restores mock/default-safe behavior over weakening
  provider-boundary checks.
- Re-run completion consumer smoke after any proxy package change.

## User Communication Checklist

- State the affected package names and versions.
- State whether users should pin, upgrade, or avoid a beta version.
- State whether the beta dist-tag moved.
- Link the replacement version, smoke status, and known limitations.
- Keep the original release evidence intact for auditability.
