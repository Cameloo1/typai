# Protected Spans

Protected spans keep Typai from changing text that should remain exact.

Examples include:

- URLs
- email addresses
- file paths
- identifiers
- code-like tokens
- CVE-style identifiers

The core exposes token helpers, and adapters use them before applying
corrections. Protected tokens can be reported to the embedder through adapter
callbacks, but they are not rewritten by deterministic correction.
