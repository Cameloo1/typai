# @typai/ui

Internal framework-free UI utilities for Typai adapters.

This package is private and unstable. It is not a public UI API promise yet.
It exists to reduce repeated popover, settings, debug, accessibility, and style
logic across Typai adapters as React and CodeMirror work begins.

## Scope

- DOM utilities only.
- No React dependency.
- No CodeMirror dependency.
- No adapter-specific dependency.
- No remote completion UI.
- No ghost text UI.
- No next-edit logging.

## Utilities

- Correction popover for blue applied corrections.
- Spelling popover for red unresolved spelling issues.
- Settings panel for local deterministic correction settings.
- Debug table for local event summaries and aggregate counts.
- Polite live region helper.
- Focus and Escape-key helpers.
- Shared `typai-*` CSS string and style injection helpers.

Adapters can use these utilities when migration is safe. Existing adapter
behavior remains the source of truth until each adapter opts in.
