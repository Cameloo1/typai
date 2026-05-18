# Package Readiness

Status date: 2026-05-18.

Typai package readiness covers local dry-run packaging, local tarball install
smoke tests, CI build/test coverage, and browser benchmark smoke tests. No npm
publish step is part of this readiness gate.

V4 Remote Completion Prototype package readiness is complete for V4.0. The
hardening checkpoint is recorded in `docs/v4-remote-completion-complete.md`.

## Packages

Readiness currently covers:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- internal `@typai/ui`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

`@typai/completion-remote` is optional. It is not imported by `@typai/core`,
and deterministic correction packages must keep working without it installed or
configured.

## Remote Completion Package Surface

`@typai/completion-remote` publishes:

- `dist/index.js`
- `dist/index.d.ts`
- `README.md`

The package does not ship tests, reports, examples, browser E2E artifacts, or
raw source files in the dry-run tarball. It has no OpenAI SDK dependency and no
browser provider-key configuration.

The endpoint provider calls an embedder-owned backend endpoint. Private provider
keys must stay server-side; browser examples and tests use only mocked provider
behavior.

The V4 hardening audit confirms this package remains optional, has no OpenAI SDK
dependency, has no browser API-key path, and is not imported by `@typai/core` or
required by deterministic correction adapters.

## Local Gates

Package dry-run:

```sh
pnpm pack:dry
```

The dry-run validates tarball contents and includes
`@typai/completion-remote`.

Smoke install:

```sh
pnpm smoke:install
```

The smoke app installs packed tarballs, imports
`createRemoteCompletion`, `createMockCompletionProvider`, and
`createEndpointCompletionProvider`, runs a deterministic mocked completion, and
verifies `@typai/core` still imports without depending on
`@typai/completion-remote`.

Browser benchmark smoke:

```sh
pnpm bench:browser
```

Deterministic correction and V4 remote completion use separate latency gates.
Correction benchmarks keep the existing p95 warning target of 20 ms and hard
failure threshold of 100 ms. The V4 mocked remote completion benchmark warns
above 800 ms p95 typing-pause-to-ghost-visible latency and fails above 2000 ms.

## CI

CI builds and tests the workspace, explicitly runs
`@typai/completion-remote` build/test, runs package dry-run and smoke install,
runs Chromium and Firefox Playwright E2E, and runs the browser benchmark smoke.
WebKit is skipped. CI does not publish to npm and does not require real provider
credentials.
