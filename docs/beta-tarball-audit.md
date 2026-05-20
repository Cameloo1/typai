# Beta Tarball Audit

Status date: 2026-05-20.

This audit records the final tarball and dependency-boundary inspection for the
current Typai beta candidate artifacts. No package was published and no Git tag
was created during this audit.

## Publish Readiness

Publish readiness status: **blocked**.

Blocking reason: manual beta approval is still pending in
`release/beta-approval.json`, and release packages remain at `0.0.0-dev`.

- Approval status: `pending`
- Approved version: not filled
- Target version from approval record: `0.0.0-beta.0`
- Audited artifact version: `0.0.0-dev`
- Target npm dist-tag from approval record: `beta`
- Target Git tag from approval record: `v0.0.0-beta.0`

The artifact content, asset exclusion, secret scan, dependency-boundary, and
smoke-install checks passed for the current `0.0.0-dev` tarballs. They must be
rerun after manual approval and version bump before any publish prompt.

## Tarballs

Fresh tarballs were created under `.pack/`.

| Package | Tarball | Packed Size | Files |
| --- | --- | ---: | ---: |
| `@typai/core` | `typai-core-0.0.0-dev.tgz` | 48.05 KiB | 10 |
| `@typai/contenteditable` | `typai-contenteditable-0.0.0-dev.tgz` | 21.76 KiB | 5 |
| `@typai/textarea` | `typai-textarea-0.0.0-dev.tgz` | 39.73 KiB | 5 |
| `@typai/ui` | `typai-ui-0.0.0-dev.tgz` | 11.77 KiB | 5 |
| `@typai/react` | `typai-react-0.0.0-dev.tgz` | 14.18 KiB | 5 |
| `@typai/codemirror` | `typai-codemirror-0.0.0-dev.tgz` | 29.24 KiB | 5 |
| `@typai/completion-remote` | `typai-completion-remote-0.0.0-dev.tgz` | 33.72 KiB | 5 |

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
currently includes a separate `LICENSE` file.

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
- `server/`
- `routes/`
- `.env`
- `.env.*`
- debug dumps
- local smoke secrets
- SQLite, WAL, SHM, and local database files
- raw dictionary or frequency source files
- blocked production dictionary or frequency assets

Result: passed for the current tarballs.

## Asset Status

Production language asset status remains **blocked / host-provided only**.

- No production dictionary binary is packed.
- No production frequency table is packed.
- No raw ESDB/SCOWL source files are packed.
- No Hunspell source files are packed.
- No Google Books Ngram source files are packed.
- No raw or generated production language asset is packed.
- `dictionary.mode: "production"` remains unavailable while review status is
  blocked.
- Host-provided Typai Dictionary Blob v1 bytes may be loaded at
  `createTypaiCore()` initialization.

The package size report found `production/raw asset files: none` for all seven
release tarballs. The production manifest check reported:

- status: `blocked`
- package inclusion: `blocked`
- bundled production dictionary/frequency asset: none

## Secret Scan Result

`pnpm scan:package-secrets` passed for all seven release packages.

Additional tarball code scanning found no forbidden runtime occurrences of:

- `OPENAI_API_KEY`
- `api.openai.com`
- browser key escape hatches
- private key blocks
- provider credential-looking values

Documentation may mention environment variable names, but server-side proxy
examples are not included in the library tarballs.

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
  `@typai/codemirror` are install-smoked without requiring completion to be
  configured.
- `@typai/ui` is included as a required support package because public
  packages depend on it; it remains unstable as an independent design-system
  API.
- Private testkit packages and examples are not in the release tarball set.

## Smoke Results

Passed:

- `pnpm release:pack`
- `pnpm pack:dry`
- manual tarball file-list inspection
- manual tarball code secret and runtime dependency-boundary scan
- `pnpm scan:package-secrets`
- `pnpm smoke:install`
- `pnpm smoke:public-beta`
- `pnpm release:check`
- `pnpm package:size-report`
- `pnpm dictionary:check-production`
- `pnpm build`
- `pnpm lint`

One parallel execution of `pnpm release:check` failed while another pack-based
scan was cleaning and rewriting package `dist/` output. The check passed when
rerun sequentially, so pack-based release checks should be run sequentially.

## Known Limitations

- Manual beta approval is not complete.
- Package versions are still `0.0.0-dev`.
- No package has been published to npm.
- No Git tag has been created.
- The production dictionary/frequency asset is not bundled.
- Production language assets remain host-provided only.
- Provider completion remains proxy-owned and mock-only in package smoke.
