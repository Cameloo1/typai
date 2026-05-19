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

The package metadata uses `UNLICENSED` until the project license is selected.
No npm publish has occurred.
