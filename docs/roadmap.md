# Roadmap

Current phase: public beta `0.0.0-beta.0` is published on npm, and registry
smoke passed from public npm packages.

## What Is Done

- Local deterministic correction core.
- Contenteditable, textarea, React, and CodeMirror adapters.
- Optional remote completion package separate from core.
- Mock-first provider proxy examples.
- Public npm beta packages.
- Package dry-run, tarball audit, package secret scan, install smoke, public
  beta smoke, and registry smoke.
- Security, privacy, API stability, rollback, known-issues, and production
  asset gate docs.

## Current Release Boundary

- Use npm `beta` or exact `0.0.0-beta.0` for installs.
- npm `latest` also points at `0.0.0-beta.0` because these were first
  publishes; moving it requires a separate release decision.
- Production language assets remain blocked / host-provided only.
- `@typai/core` remains local and does not import completion.
- Real provider completion is server-side and manual.
- No public Git tag exists for the beta.

## Not In The Beta

- Bundled production dictionary/frequency asset.
- Real Codex adapter.
- Grammar/style/tone/clarity layer.
- Local model inference.
- Next-edit logging.
- Browser extension.
- ProseMirror or Monaco adapters.
- Direct browser-to-provider calls.

## Candidate Next Phases

These are options, not commitments:

- **Production Asset Unblock**: finish source hashes, transform output evidence,
  size evidence, quality gates, attribution, and review signoff for a production
  language asset.
- **Real Codex Adapter**: connect Typai to a real Codex-facing integration while
  keeping the reusable product architecture independent.
- **Apple-style personalization**: improve user-specific correction behavior
  through local memory and explicit rules.
- **Grammar/style async editor**: add a separate assistant layer without
  weakening deterministic correction.
- **Path B local completion research**: investigate local completion
  intelligence without claiming model inference exists today.
- **ProseMirror/Monaco adapters**: expand editor ecosystem coverage.
- **Browser extension**: package Typai for install-anywhere web usage after
  stronger product and privacy boundaries.

Recommended rule: if no urgent beta defect appears, choose either Real Codex
Adapter for dogfooding or Production Asset Unblock for spell coverage.
