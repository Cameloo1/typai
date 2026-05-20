# Beta Known Issues

Status date: 2026-05-20.

Typai is still in prepublish beta readiness. No package has been published to
the public npm registry, and registry smoke has not run.

## Package Availability

- Public registry install guidance is intentionally absent until a publish
  result and registry-smoke document exist.
- Current evaluation should use workspace packages or local packed tarball smoke
  checks.
- `@typai/ui` is a required support package for public packages, but it is
  unstable as an independent design-system API.

## Language Assets

- The production language asset is not bundled.
- No production dictionary binary is packed.
- No production frequency table is packed.
- No raw ESDB/SCOWL, Hunspell, or Google Books Ngram source files are packed.
- Production spell coverage depends on a later approved production asset or
  host-provided Typai Dictionary Blob v1 bytes.
- The current local correction baseline is useful for deterministic correction
  and common typo coverage, but it is not production dictionary coverage.

## Completion And Providers

- Real provider paths are manual and server-side only.
- Provider credentials must stay on the embedder-owned server path.
- Package tests and demos default to mock provider behavior.
- There is no direct browser-to-provider credential path.

## Editor And Product Scope

- WebKit browser coverage remains outside the current readiness claim when the
  local E2E matrix skips it.
- There is no real Codex adapter.
- There are no grammar, style, tone, or clarity features.
- There is no local inference.
- There is no next-edit logging.
