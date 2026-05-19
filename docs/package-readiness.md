# Package Readiness

Status date: 2026-05-19.

Typai package readiness covers local dry-run packaging, local tarball install
smoke tests, CI build/test coverage, and browser benchmark smoke tests. No npm
publish step is part of this readiness gate.

V4 Remote Completion Prototype package readiness is complete for V4.0. V4.1
readiness now covers contenteditable, textarea, React, and CodeMirror
completion surfaces. The hardening checkpoint is recorded in
`docs/v4-remote-completion-complete.md`, and the V4.1 checkpoint is recorded in
`docs/v4-1-completion-surface-expansion-complete.md`.

## Packages

Readiness currently covers:

- `@typai/core`
- `@typai/contenteditable`
- `@typai/textarea`
- `@typai/react`
- `@typai/codemirror`
- `@typai/completion-remote`

`@typai/ui` is a required support package because `@typai/react` and
`@typai/codemirror` currently depend on it. It remains internal and unstable;
packing it does not make its exports a consumer API promise.

`@typai/completion-remote` is optional. It is not imported by `@typai/core`,
and deterministic correction packages must keep working without it installed or
configured. V4.1 smoke and E2E coverage verify that existing adapters still
work without completion controllers/options.

## Remote Completion Package Surface

`@typai/completion-remote` publishes:

- `dist/index.js`
- `dist/index.d.ts`
- `README.md`

The package does not ship tests, reports, examples, browser E2E artifacts,
server routes, demo files, or raw source files in the dry-run tarball. The
dry-run gate also checks package metadata and inspectable packed code for
provider secret-like values. It has no OpenAI SDK dependency and no browser
provider-key configuration.

The endpoint provider calls an embedder-owned backend endpoint. Private provider
keys must stay server-side; browser examples and tests use only mocked provider
behavior.

The V4 hardening audit confirms this package remains optional, has no OpenAI SDK
dependency, has no browser API-key path, and is not imported by `@typai/core` or
required by deterministic correction adapters. The V4.1 hardening audit extends
that boundary across contenteditable, textarea, React, and CodeMirror
completion surfaces.

## Local Gates

Package dry-run:

```sh
pnpm pack:dry
```

The dry-run validates tarball contents and includes
`@typai/completion-remote`.

Release metadata and package-boundary audit:

```sh
pnpm release:check
```

The release check verifies package metadata, public/support package boundaries,
workspace dependency boundaries, required Readmes, generated Wasm output for
`@typai/core`, and dry-run tarball contents.

Package secret scan:

```sh
pnpm scan:package-secrets
```

The scan inspects packed package output for provider secrets, direct provider
domains, `.env` files, reports, raw debug dump names, private-key-like strings,
and server example files that should not ship in browser/runtime packages.

Smoke install:

```sh
pnpm smoke:install
```

The smoke app installs packed tarballs, imports
`createRemoteCompletion`, `createMockCompletionProvider`, and
`createEndpointCompletionProvider`, verifies mocked streaming provider exports,
runs a deterministic mocked completion, and verifies `@typai/core` still
imports without depending on `@typai/completion-remote`.

The smoke app also verifies V4.1 structural completion entrypoints:

- `@typai/contenteditable` publishes a structural completion option.
- `@typai/textarea` accepts a structural completion controller.
- `@typai/react` components accept explicit completion props.
- `@typai/codemirror` accepts a structural completion option.

Browser benchmark smoke:

```sh
pnpm bench:browser
```

Deterministic correction and V4.1 mocked remote completion use separate latency
gates. Correction benchmarks keep the existing p95 warning target of 20 ms and
hard failure threshold of 100 ms. The mocked remote completion benchmarks warn
above 800 ms p95 typing-pause-to-ghost-visible latency and fail above 2000 ms.

Browser benchmark surfaces now cover:

- Deterministic contenteditable correction.
- Deterministic textarea correction.
- Deterministic CodeMirror correction.
- Contenteditable completion.
- Textarea completion.
- React textarea completion.
- CodeMirror completion.

Benchmark summaries report count, mean, p50, p95, p99, and max.

## CI

CI builds and tests the workspace, explicitly runs
`@typai/completion-remote` build/test including mocked streaming tests, runs
package dry-run and smoke install, runs Chromium and Firefox Playwright E2E for
V4.1 completion surfaces, and runs the browser benchmark smoke. WebKit is
skipped. CI does not publish to npm and does not require real provider
credentials.

The V4.1 audit confirms there is no real provider call path in demos, tests,
E2E, or benchmarks; endpoint provider usage is routed through an
embedder-controlled endpoint.
