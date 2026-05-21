# Typai Docs

Typai is currently a public beta package set for local deterministic writing
correction and optional endpoint-backed completion. The published beta is
`0.0.0-beta.0` on npm under the `beta` dist-tag. Registry smoke passed from
public npm packages.

Current boundaries:

- correction runs locally through `@typai/core` and editor adapters
- optional completion lives in `@typai/completion-remote`
- completion credentials belong on an embedder-owned server endpoint
- production language assets are blocked / host-provided only
- final Production Asset Unblock audit is complete for that blocked state
- no real Codex adapter, grammar/style layer, local inference, or next-edit
  logging is included

Release caveat: because these were first publishes, npm `latest` currently also
points at `0.0.0-beta.0`. Treat `beta` or the exact version as the intended
install target until a later release decision changes dist-tags.

## Start Here

| Goal | Doc |
| --- | --- |
| Install from npm beta | [Installation](./installation.md) |
| Try the smallest working examples | [Getting started](./getting-started.md) |
| Pick a repo example | [Examples](./examples.md) |
| Run the optional provider proxy path | [Real-provider demo](./real-provider-demo.md) |
| Debug install/runtime issues | [Troubleshooting](./troubleshooting.md) |
| See what changed in the beta | [Changelog](../CHANGELOG.md) |

## Product Concepts

| Topic | Doc |
| --- | --- |
| Local correction model | [Deterministic correction](./concepts/deterministic-correction.md) |
| URL/email/path/code protection | [Protected spans](./concepts/protected-spans.md) |
| Red unresolved marks and blue correction marks | [Red and blue marks](./concepts/red-blue-marks.md) |
| Optional ghost completion | [Completion](./concepts/completion.md) |
| Personal dictionary and rules | [Storage and memory](./concepts/storage-memory.md) |
| Server-owned completion boundary | [Provider proxy](./concepts/provider-proxy.md) |

## Package Docs

| Package | Purpose |
| --- | --- |
| [Core](./packages/core.md) | deterministic correction, suggestions, memory, dictionary loading |
| [Contenteditable](./packages/contenteditable.md) | DOM `contenteditable` adapter |
| [Textarea](./packages/textarea.md) | native textarea adapter with overlay marks |
| [React](./packages/react.md) | provider, hooks, textarea/contenteditable components |
| [CodeMirror](./packages/codemirror.md) | CodeMirror 6 extension |
| [Completion remote](./packages/completion-remote.md) | mock/noop/endpoint completion helpers |

## Release And Safety State

| Topic | Doc |
| --- | --- |
| Current beta checkpoint | [Beta publish complete](./beta-publish-complete.md) |
| Registry publish evidence | [Beta publish result](./beta-publish-result.md) |
| Public npm install smoke | [Beta registry smoke](./beta-registry-smoke.md) |
| Release candidate history | [Beta release candidate plan](./beta-release-candidate-plan.md) |
| Known beta limitations | [Beta known issues](./beta-known-issues.md) |
| Rollback/remediation playbook | [Beta rollback guidance](./beta-rollback-guidance.md) |
| Security boundary | [Security](./security.md) |
| Privacy boundary | [Privacy](./privacy.md) |
| API maturity | [API stability](./api-stability.md) |
| Roadmap | [Roadmap](./roadmap.md) |
| Spell quality gates | [Spell quality report](./spell-quality-report.md) |

## Language Assets

| Topic | Doc |
| --- | --- |
| Production Asset Unblock | [Production asset unblock](./production-asset-unblock.md) |
| Production Asset Unblock final audit | [Production asset unblock complete](./production-asset-unblock-complete.md) |
| Production asset remediation loop | [Production asset unblock remediation](./production-asset-unblock-remediation.md) |
| Current asset status report | [Production asset status report](./production-asset-status-report.md) |
| Transform pipeline design | [Production asset transform design](./production-asset-transform-design.md) |
| Latest spell-quality run | [Latest spell-quality report](../reports/spell-quality/latest.md) |
| Current production-asset gate | [Production asset gate recap](./production-asset-gate-recap.md) |
| Autocorrect table | [Common typo table](./common-typo-table.md) |
| Approved source direction | [Dictionary source selection](./dictionary-source-selection.md) |
| Production approval checklist | [Dictionary production approval](./dictionary-production-approval.md) |
| Package asset policy | [Dictionary asset policy](./dictionary-asset-policy.md) |
| Asset delivery policy | [Language asset delivery policy](./language-asset-delivery-policy.md) |
| Remaining asset blockers | [Dictionary asset blockers](./dictionary-asset-blockers.md) |
