# @typai/core

Local deterministic correction engine for Typai.

This package owns token checks, suggestions, protected-span helpers, storage
interfaces, memory APIs, dictionary APIs, and the generated Wasm engine output.
It does not import `@typai/completion-remote`, call provider APIs, or require a
server.

Spell suggestions use the local C++ delete-index path when dictionary data is
loaded. Delete-index candidates are suggestions only unless the token is also
present in Typai's audited common-typo table. Autocorrect remains limited to
explicit common typos and user always-correct rules, with valid words and
protected tokens blocked from automatic correction.

Current safe spelling behavior includes casing and trailing-punctuation
preservation for approved autocorrections, plus conservative contraction and
plural-ambiguity suggestions that remain red unresolved marks.

Dictionary assets load only during `createTypaiCore()` initialization. After
initialization, `checkCompletedToken()` and `suggestToken()` stay synchronous
and do not fetch assets or touch the network.

Supported dictionary modes:

- `built-in`: default tiny deterministic engine vocabulary; no dynamic asset is
  loaded.
- `host-provided`: load Typai Dictionary Blob v1 bytes through `bytes`, `load`,
  or `url` during initialization.
- `production`: reserved for a future approved packaged language asset. It
  currently throws a clear unavailable error because no production dictionary or
  frequency asset is bundled.

Current package policy: production language assets are excluded from
`@typai/core`. Host-provided assets and repo-local mock fixtures are the only
available asset paths until manifest, hash, license, attribution, size, quality,
and review gates pass.

The package metadata uses `UNLICENSED` until the project license is selected.
No npm publish has occurred.
