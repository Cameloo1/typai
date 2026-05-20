# Beta Tarball Audit

Status date: 2026-05-20.

This audit records the final approved-version tarball and dependency-boundary
inspection for the Typai beta publish candidate. No package was published and
no Git tag was created during this audit.

## Publish Readiness

Publish readiness status: **ready**.

The approved beta package set has been packed and dry-run validated at
`0.0.0-beta.0` with npm dist-tag `beta`.

- Approval status: `approved`
- Approved version: `0.0.0-beta.0`
- Approved npm dist-tag: `beta`
- Approved Git tag: `v0.0.0-beta.0`
- Production language asset status: `blocked / host-provided only`
- npm publish status: not published
- Git tag status: not created

## Tarballs

Fresh tarballs were created under `.pack/`.

| Package | Version | Tarball | Packed Size | Files |
| --- | --- | --- | ---: | ---: |
| `@typai/ui` | `0.0.0-beta.0` | `typai-ui-0.0.0-beta.0.tgz` | 11.81 KiB | 5 |
| `@typai/core` | `0.0.0-beta.0` | `typai-core-0.0.0-beta.0.tgz` | 48.16 KiB | 10 |
| `@typai/completion-remote` | `0.0.0-beta.0` | `typai-completion-remote-0.0.0-beta.0.tgz` | 33.90 KiB | 5 |
| `@typai/contenteditable` | `0.0.0-beta.0` | `typai-contenteditable-0.0.0-beta.0.tgz` | 21.85 KiB | 5 |
| `@typai/textarea` | `0.0.0-beta.0` | `typai-textarea-0.0.0-beta.0.tgz` | 39.98 KiB | 5 |
| `@typai/react` | `0.0.0-beta.0` | `typai-react-0.0.0-beta.0.tgz` | 14.24 KiB | 5 |
| `@typai/codemirror` | `0.0.0-beta.0` | `typai-codemirror-0.0.0-beta.0.tgz` | 29.45 KiB | 5 |

## Package Contents Summary

`@typai/core` includes:

- `README.md`
- `package.json`
- `dist/index.js`
- `dist/index.js.map`
- `dist/index.d.ts`
- `pkg/package.json`
- `pkg/typai_wasm.js`
- `pkg/typai_wasm.d.ts`
- `pkg/typai_wasm_bg.wasm`
- `pkg/typai_wasm_bg.wasm.d.ts`

Each adapter/support package includes:

- `README.md`
- `package.json`
- `dist/index.js`
- `dist/index.js.map`
- `dist/index.d.ts`

Source maps are included because the current package file policy includes
`dist/`, and `pnpm release:check` accepts the current packed output. No package
currently includes a separate `LICENSE` file; package manifests carry the
current `UNLICENSED` license field.

The packed package metadata was inspected. Workspace dependency references are
normalized to exact `0.0.0-beta.0` versions in tarball `package.json` files.

## Exclusion Audit

The tarball file lists were inspected for forbidden development and local
artifacts.

Excluded from all release tarballs:

- `tests/`
- `test/`
- `test-results/`
- `playwright-report/`
- `coverage/`
- `examples/`
- provider proxy examples
- consumer examples
- server proxy example code
- `.env`
- `.env.*`
- debug dumps
- local provider smoke secrets
- SQLite, WAL, SHM, and local database files
- raw dictionary or frequency source files
- blocked production dictionary or frequency assets

Result: passed for all approved `0.0.0-beta.0` tarballs.

## Asset Status

Production language asset status remains **blocked / host-provided only**.

- No production dictionary binary is packed.
- No production frequency table is packed.
- No raw ESDB/SCOWL source files are packed.
- No Hunspell source files are packed.
- No Google Books Ngram source files are packed.
- No raw or generated production language asset is packed.
- No scaled mock dictionary asset is packed in the release tarballs.
- `dictionary.mode: "production"` remains unavailable while review status is
  blocked.
- Host-provided Typai Dictionary Blob v1 bytes may be loaded at
  `createTypaiCore()` initialization.

`pnpm dictionary:check-production` reported:

- status: `blocked`
- package inclusion: `blocked`
- bundled production dictionary/frequency asset: none

## Secret Scan Result

`pnpm scan:package-secrets` passed for all seven release packages.

Additional tarball text scanning found no forbidden runtime occurrences of:

- `OPENAI_API_KEY`
- `api.openai.com`
- private key blocks
- `.env`
- local smoke secrets
- provider credentials
- credential-looking provider values

A generic string search found a negative README sentence in
`@typai/contenteditable` stating that provider credentials are not included; it
was reviewed as boundary documentation, not a secret.

## Dependency Boundary Result

Dependency boundary result: passed.

Confirmed boundaries:

- `@typai/core` does not depend on `@typai/completion-remote`.
- `@typai/core` does not depend on React, CodeMirror, `@typai/ui`, provider
  packages, or server proxy examples.
- `@typai/core` runtime JS does not import the optional completion package, UI
  package, React, CodeMirror, server proxy code, or provider credential paths.
- `@typai/completion-remote` runtime JS does not expose browser API keys,
  direct OpenAI endpoints, or provider secrets.
- `@typai/contenteditable`, `@typai/textarea`, `@typai/react`, and
  `@typai/codemirror` are install-smoked without completion configured.
- `@typai/ui` is included as a required support package because public packages
  depend on it; it remains unstable as an independent design-system API.
- `@typai/adapter-testkit`, private testkit packages, provider proxy examples,
  consumer examples, and test packages are not in the release tarball set.

## Publish Dry-Run Result

`pnpm release:publish:dry` passed and executed no publish command.

The dry-run now validates the approved version, approved dist-tag, approved
publish order, non-private package set, and blocked/host-provided asset
acknowledgement before printing the exact dry-run commands:

1. `npm publish packages/ui --tag beta --access public --dry-run`
2. `npm publish packages/core --tag beta --access public --dry-run`
3. `npm publish packages/completion-remote --tag beta --access public --dry-run`
4. `npm publish packages/contenteditable --tag beta --access public --dry-run`
5. `npm publish packages/textarea --tag beta --access public --dry-run`
6. `npm publish packages/react --tag beta --access public --dry-run`
7. `npm publish packages/codemirror --tag beta --access public --dry-run`

No command uses the `latest` dist-tag, and no private workspace package is
included.

## Smoke Results

Passed:

- `pnpm release:pack`
- `pnpm pack:dry`
- manual tarball file-list inspection
- manual packed metadata inspection
- manual tarball code secret and runtime dependency-boundary scan
- `pnpm scan:package-secrets`
- `pnpm release:publish:dry`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm release:check`
- `pnpm dictionary:check-production`
- `pnpm build`
- `pnpm lint`

The smoke install paths use local tarballs rather than workspace symlinks where
possible. Public beta smoke completed the runtime package matrix, vanilla Vite
consumer, React Vite consumer, CodeMirror consumer, and mock provider proxy
consumer. Provider mode remained mock-only; no real provider calls were made.

## Audit Issue And Resolution

Issue found: the existing `pnpm release:publish:dry` output confirmed package
order but did not print the approved dist-tag or exact dry-run publish commands.

Resolution: `scripts/release-publish-dry.mjs` now reads the approved beta
approval record, rejects `latest`, verifies package versions and approved order,
rejects private packages in the publish set, verifies blocked/host-provided
asset acknowledgement, and prints the exact `--tag beta --dry-run` commands.

## Known Limitations

- No package has been published to npm.
- No Git tag has been created.
- The production dictionary/frequency asset is not bundled.
- Production language assets remain host-provided only.
- Provider completion remains proxy-owned and mock-only in package smoke.
- Registry smoke cannot run until the guarded publish prompt actually publishes
  the beta packages.
