# Beta Rollback Guidance

Status date: 2026-05-20.

This guidance applies to the published `0.0.0-beta.0` package set. No public Git
tag exists for this beta.

## Principles

- Do not rewrite public package history.
- Do not silently replace package contents.
- Prefer a corrected beta patch over destructive registry actions.
- Keep original publish, smoke, and failure evidence.
- Move dist-tags only through an explicit release decision.
- Keep production language assets blocked until the asset gate is approved.

## Bad Package Version

Use this when a package is broken after publish.

1. Identify affected package names and versions.
2. Confirm whether `beta` or `latest` points at the bad version.
3. Deprecate the bad version if npm policy and timing allow it.
4. Publish a corrected beta patch, for example `0.0.0-beta.1`.
5. Run registry smoke from public npm packages.
6. Move `beta` to the replacement only after smoke passes.
7. Document the remediation in changelog and release docs.

Do not unpublish automatically. npm unpublish policy is time-limited and can
break consumers.

## Dist-Tag Issue

Current state: both `beta` and `latest` point at `0.0.0-beta.0`.

If policy decides `latest` should not point at the beta:

1. Record the decision and operator approval.
2. Confirm all package tags with `npm view <package> dist-tags`.
3. Remove or move `latest` only if the registry state and npm policy make that
   safe.
4. Re-check all dist-tags after the change.
5. Update public docs with the exact final state.

Do not make dist-tag changes inside unrelated docs or smoke prompts.

## Production Asset Issue

If a blocked production dictionary, frequency table, or raw language source file
is found in a package:

1. Treat it as a release blocker.
2. Identify affected packages and versions.
3. Publish a beta patch that removes the asset path.
4. Re-run package secret scan, package size report, tarball audit, install
   smoke, public beta smoke, and registry smoke.
5. Keep package behavior host-provided-only until the asset approval gate
   passes.
6. Document which version is unsafe and which replacement is safe.

## Provider Boundary Issue

If browser code exposes provider credentials or calls a provider directly:

1. Stop recommending the affected path.
2. Document the affected package/example.
3. Patch back to endpoint-only browser behavior.
4. Keep real provider calls behind server-side manual gates.
5. Re-run completion smoke and provider-boundary checks.

## User Communication Checklist

Every remediation note should say:

- affected package names
- affected versions
- whether users should pin, upgrade, or avoid a version
- whether `beta` moved
- whether `latest` moved
- smoke result for the replacement
- remaining known limitations
