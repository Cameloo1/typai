# Dist-Tag Remediation

Status date: 2026-05-21.

Current npm state:

- `beta`: `0.0.0-beta.0`
- `latest`: `0.0.0-beta.0`

This applies to all seven published Typai beta packages:

- `@typai/ui`
- `@typai/core`
- `@typai/completion-remote`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`

## Decision

Selected option: **E. Park dist-tag remediation until package
ownership/access and operator approval are confirmed.**

Reason:

- `latest` points at `0.0.0-beta.0` because these were first publishes.
- No explicit approval exists in this prompt to mutate npm dist-tags.
- `TYPAI_ALLOW_NPM_DIST_TAG_MUTATION=1` was not set.
- There is no stable non-beta version available to move `latest` to.
- Removing or changing `latest` is a registry mutation that should have its own
  approval record and operator checklist.

No npm dist-tag mutation was performed.

## Resume Plan

Before changing dist-tags:

1. Verify npm ownership/access for all seven packages.
2. Record an explicit release approval document.
3. Decide the exact policy:
   - leave `latest` on beta intentionally,
   - remove `latest` if npm permits,
   - move `latest` to a stable version if one exists,
   - or publish a beta patch and correct tags afterward.
4. Print the exact command list before execution.
5. Set `TYPAI_ALLOW_NPM_DIST_TAG_MUTATION=1` in the operator shell.
6. Run `npm view <package> dist-tags` before and after each change.
7. Re-run registry smoke and update public docs.

Recommended command shape if a future approval chooses removal:

```sh
npm dist-tag rm @typai/core latest
```

Repeat only for explicitly approved packages. Do not run this command from an
unapproved prompt.
