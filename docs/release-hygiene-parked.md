# Release Hygiene Parked

Status date: 2026-05-21.

Release hygiene status: **release-hygiene-parked with app work allowed**.

Prompt 141 closed the repo-side release hygiene that can be closed safely now:

- added a future Trusted Publishing workflow:
  `.github/workflows/npm-trusted-publish.yml`
- updated Trusted Publishing setup docs
- added a repeatable registry beta smoke command:
  `pnpm smoke:registry-beta`
- documented dist-tag remediation as parked
- documented Git tag recovery as blocked
- preserved the production asset state as blocked / host-provided only

No npm publish, npm dist-tag mutation, Git tag creation, Git tag push, package
version change, or production asset generation occurred.

## Remaining Blockers

### Dist-Tag Remediation

Current state:

- `beta`: `0.0.0-beta.0`
- `latest`: `0.0.0-beta.0`

Blockers:

- no explicit approval to mutate npm dist-tags
- `TYPAI_ALLOW_NPM_DIST_TAG_MUTATION=1` was not set
- no stable version exists as a replacement `latest`
- npm package ownership/access for mutation was not re-proven in this prompt

Resume from `docs/dist-tag-remediation.md`.

### Git Tag Recovery

Current state:

- npm has `0.0.0-beta.0`
- local `v*` Git tags: none
- no `v0.0.0-beta.0` tag was created

Blockers:

- registry tarballs cannot be cryptographically matched to the current HEAD
- the recorded manual publish commit is historical evidence, not enough by
  itself to create a release tag here
- no explicit approval to create a tag
- `TYPAI_ALLOW_GIT_TAG_PUSH=1` was not set

Recommended recovery if a clean provenance marker is required:

1. publish a new beta patch through Trusted Publishing, such as
   `0.0.0-beta.1`
2. run registry smoke from npm packages
3. create a tag only after publish provenance is exact and documented
4. push a tag only from a prompt with explicit tag-push approval and
   `TYPAI_ALLOW_GIT_TAG_PUSH=1`

### Trusted Publishing Setup

Repo workflow exists, but external setup is not proven:

- npm trusted publisher configuration must be verified for all seven packages
- GitHub `npm-beta` environment approval rules should be checked
- future package version and release approval must be created before dispatch

Resume from `docs/trusted-publishing-setup.md`.

## App Continuation

App work can continue because:

- registry state is documented
- production asset state is documented and parked
- package install/smoke gates pass
- no hidden dirty files should remain after this commit
- unresolved release hygiene items are explicit external registry/tag decisions

Do not start app feature work inside the release hygiene prompt itself.
