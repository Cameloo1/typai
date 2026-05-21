# Current Release And Production Asset State

Status date: 2026-05-21.

This record reconciles the repo, npm registry, dist-tags, Git tags, and
production language asset state after the beta publish and Production Asset
Unblock work. It supersedes older checkpoint assumptions that said publish
approval was still pending or that no registry publish had occurred.

No npm publish, npm dist-tag mutation, Git tag creation, package version change,
or production asset generation was performed for this reconciliation.

## Source Control State

- Branch: `codex/fix`
- Remote: `origin https://github.com/Cameloo1/typai.git`
- Latest local commit at audit start: `1359347 fix: sync spell quality workspace lockfile`
- Local `v*` tags: none
- Dirty files at audit start: none

The absence of a local `v0.0.0-beta.0` tag is intentional for this checkpoint:
the public registry has `0.0.0-beta.0`, but tarball provenance is not strong
enough to create a release tag in this prompt.

## Local Package Versions

Release packages are locally versioned at `0.0.0-beta.0`:

| Package | Local version | Publishable package |
| --- | ---: | --- |
| `@typai/ui` | `0.0.0-beta.0` | yes |
| `@typai/core` | `0.0.0-beta.0` | yes |
| `@typai/completion-remote` | `0.0.0-beta.0` | yes |
| `@typai/contenteditable` | `0.0.0-beta.0` | yes |
| `@typai/textarea` | `0.0.0-beta.0` | yes |
| `@typai/react` | `0.0.0-beta.0` | yes |
| `@typai/codemirror` | `0.0.0-beta.0` | yes |

Root, examples, testkits, and provider proxy helper packages remain private or
internal and are still `0.0.0-dev`.

Source package manifests still use workspace dependencies where appropriate.
Release packaging and smoke tooling are responsible for proving packed consumer
installability.

## npm Registry State

Registry audit result: all seven release packages exist publicly at
`0.0.0-beta.0`.

| Package | `npm view <pkg> version` | `npm view <pkg>@0.0.0-beta.0 version` | `npm view <pkg>@beta version` |
| --- | ---: | ---: | ---: |
| `@typai/ui` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |
| `@typai/core` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |
| `@typai/completion-remote` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |
| `@typai/contenteditable` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |
| `@typai/textarea` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |
| `@typai/react` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |
| `@typai/codemirror` | `0.0.0-beta.0` | `0.0.0-beta.0` | `0.0.0-beta.0` |

## npm Dist-Tags

For every release package:

- `beta`: `0.0.0-beta.0`
- `latest`: `0.0.0-beta.0`

`latest` points at the beta because these were first publishes. No dist-tag
change was made here. Any future decision to move `latest` away from beta must
be an explicit registry operation with its own approval gate.

## Publish Provenance

Observed publish evidence from `docs/beta-publish-result.md`:

- Publish method: manual npm tarball publish observed on the public registry.
- Trusted Publishing workflow dispatched: no.
- npm user: `camelo1`.
- Recorded publish branch: `codex/fix`.
- Recorded publish commit: `198feab`.
- Git tag status: none.

Registry publish times:

| Package | Published at UTC |
| --- | --- |
| `@typai/ui` | `2026-05-20T20:42:08.000Z` |
| `@typai/core` | `2026-05-20T20:42:10.549Z` |
| `@typai/completion-remote` | `2026-05-20T20:42:38.278Z` |
| `@typai/contenteditable` | `2026-05-20T20:42:58.624Z` |
| `@typai/textarea` | `2026-05-20T20:43:03.378Z` |
| `@typai/react` | `2026-05-20T20:43:09.720Z` |
| `@typai/codemirror` | `2026-05-20T20:43:33.312Z` |

Local dry-run tarball hashes from the current HEAD do not match registry
integrity values for the already-published tarballs, which is expected once the
repository has moved after the manual publish. This prompt does not have enough
cryptographic provenance to create `v0.0.0-beta.0`. A future beta hygiene prompt
should either prove the exact publish commit and tarball set or publish a
corrected beta patch such as `0.0.0-beta.1`.

## Trusted Publishing Status

`.github/workflows/npm-beta-publish.yml` exists and includes:

- `workflow_dispatch`.
- `id-token: write`.
- ordered package publish steps.
- `--tag beta`.
- dry-run support when publish input is false.
- no `NPM_TOKEN` or `NODE_AUTH_TOKEN` path in the workflow.

Open workflow hygiene:

- The workflow was not used for the observed `0.0.0-beta.0` publish.
- The workflow does not currently show an explicit `registry-url:
  https://registry.npmjs.org` setting.
- The workflow rejects publishing an already-existing package version, so it
  should not be rerun for `0.0.0-beta.0`.
- Future use should target a new version and keep Trusted Publishing evidence
  separate from the manual beta publish record.

## Production Asset State

Final asset state: production asset still blocked / host-provided only.

Manifest state from `packages/core/assets/production/MANIFEST.json`:

- `review.status`: `blocked`
- dictionary source: ESDB/SCOWL generated Hunspell en_US
  `hunspell-en_US-2026.02.25.zip`
- dictionary source hash:
  `ac8e73310e951d88c52c2cf2ba54ceaca34f8486a81630ac8a75dc5f931179f9`
- frequency source: Google Books Ngram Viewer American English 2019 1-grams
- frequency `totalcounts-1` hash:
  `6ce99984774743b7142e2f7e95fc33bd676ea4485038081881e61e4456804d8a`
- generated output hash: none
- generated word count: none
- generated byte size: none
- output asset path: empty
- output package inclusion: `blocked`

Missing blockers:

- 14 Google Ngram gzip partition SHA-256 values.
- External pinned local source paths.
- Generated output hash.
- Generated word count.
- Generated byte size.
- Final package-visible license and attribution notices for the generated asset.
- Spell-quality evidence against a generated production asset.
- Package dry-run proof for an included production asset.
- Final review signoff.

Runtime state:

- `dictionary.mode: "production"` is unavailable while the manifest is blocked.
- Host-provided Typai Dictionary Blob v1 bytes remain supported at
  `createTypaiCore()` initialization time.
- No raw ESDB/SCOWL/Hunspell or Google Books Ngram source files are present in
  the production asset directory.
- No generated production dictionary binary is present.
- Scaled mock and fixture assets remain mock/test assets, not production data.

## Safety And Boundary State

- `@typai/core` remains local deterministic correction only.
- `@typai/core` does not import `@typai/completion-remote`.
- Completion remains optional.
- Mock provider behavior remains default.
- No browser API-key path is documented or implemented.
- No real provider calls are part of tests, demos, E2E, smoke, or CI.
- No production language asset was generated or bundled for this prompt.

## Selected Next Route

Selected route: **B. Release hygiene closure + asset parked**.

Reason:

- Release state is no longer publish-pending: beta packages exist on npm and
  registry smoke has passed.
- Release hygiene still needs a future patch/tag/provenance decision because the
  beta was manual, `latest` points at beta, and no `v0.0.0-beta.0` Git tag
  exists.
- Production asset blockers remain real and should stay parked behind the
  manifest gate.
- App work can continue after the app-continuation gate passes, with production
  dictionary coverage explicitly parked as host-provided only.

## Prompt 141 Release Hygiene Result

Release hygiene result: **release-hygiene-parked with app work allowed**.

Closed repo-side hygiene:

- future Trusted Publishing workflow added at
  `.github/workflows/npm-trusted-publish.yml`
- Trusted Publishing setup documented in `docs/trusted-publishing-setup.md`
- registry npm smoke command added as `pnpm smoke:registry-beta`
- registry smoke re-run from public npm `@beta` packages

Parked external registry/tag decisions:

- dist-tag remediation is parked in `docs/dist-tag-remediation.md`
- Git tag recovery is blocked because `0.0.0-beta.0` tarball provenance cannot
  be proven strongly enough to create `v0.0.0-beta.0` here
- beta patch through Trusted Publishing is recommended if clean provenance is
  required

No npm publish, dist-tag mutation, Git tag creation, package version change, or
production asset generation occurred in Prompt 141.

## Validation

Prompt 140 validation results:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test` | passed | Turbo reported 34 successful tasks. |
| `pnpm test:e2e` | passed | Chromium and Firefox suites passed after sandbox retry; the first sandbox run failed because Vite/esbuild could not read config paths. |
| `pnpm build` | passed | Turbo build completed; Vite emitted existing large chunk warnings for demo/consumer bundles. |
| `pnpm lint` | passed | Biome checked 280 files with no fixes. |
| `pnpm docs:check` | passed | 40 required docs and consumer examples verified. |
| `pnpm pack:dry` | passed | Elevated retry passed after sandbox prepack access failure; no production asset or raw source files included. |
| `pnpm smoke:install` | passed | Local tarball consumer smoke passed. |
| `pnpm smoke:public-beta` | passed | Elevated retry passed after sandbox prepack access failure; public beta matrix passed with mock-only provider mode. |
| `pnpm scan:package-secrets` | passed | Elevated retry passed after sandbox prepack access failure; 7 release packages scanned clean. |
| `pnpm dictionary:check-production` | passed | Correct blocked-mode output: no production dictionary/frequency asset is bundled. |
| `pnpm package:size-report` | passed | Elevated retry passed after sandbox prepack access failure; `@typai/core` packed size 49.11 KiB, no production binary/raw sources. |
| `pnpm release:check` | passed | Elevated retry passed after sandbox prepack access failure; 6 public packages plus support package `@typai/ui`. |

The sandbox failures were execution-environment permission failures during
prepack or dev-server startup, not product gate failures. Each affected command
was rerun successfully outside the sandbox. No registry, tag, version, or asset
mutation was performed by those reruns.
