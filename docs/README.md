# Typai Docs

Typai has two deliberately separate layers:

- local deterministic correction in `@typai/core` and editor adapters
- optional remote completion in `@typai/completion-remote`

Correction does not need a server. Completion can call an endpoint, but private
provider credentials stay on the embedder's server.

## Start Here

- [Getting started](./getting-started.md)
- [Installation](./installation.md)
- [Examples](./examples.md)
- [Changelog](../CHANGELOG.md)
- [Real-provider demo](./real-provider-demo.md)
- [Troubleshooting](./troubleshooting.md)

## Concepts

- [Deterministic correction](./concepts/deterministic-correction.md)
- [Protected spans](./concepts/protected-spans.md)
- [Red and blue marks](./concepts/red-blue-marks.md)
- [Completion](./concepts/completion.md)
- [Storage and memory](./concepts/storage-memory.md)
- [Provider proxy](./concepts/provider-proxy.md)

## Packages

- [Core](./packages/core.md)
- [Contenteditable](./packages/contenteditable.md)
- [Textarea](./packages/textarea.md)
- [React](./packages/react.md)
- [CodeMirror](./packages/codemirror.md)
- [Completion remote](./packages/completion-remote.md)

## Safety And Readiness

- [Security](./security.md)
- [Privacy](./privacy.md)
- [API stability](./api-stability.md)
- [Beta release candidate plan](./beta-release-candidate-plan.md)
- [Roadmap](./roadmap.md)
- [Production asset gate recap](./production-asset-gate-recap.md)
- [Common typo table](./common-typo-table.md)
- [Dictionary source selection](./dictionary-source-selection.md)
- [Dictionary asset policy](./dictionary-asset-policy.md)
- [Dictionary production approval](./dictionary-production-approval.md)
- [Dictionary asset blockers](./dictionary-asset-blockers.md)
