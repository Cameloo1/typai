# Completion

Completion is optional and separate from local correction.

`@typai/completion-remote` provides:

- completion request context extraction
- provider interfaces
- mock providers
- endpoint providers
- scheduling, debounce, abort, stale response handling, and metrics

Completion sends bounded context only when an embedder configures the optional
package. Returned text is rendered as ghost text first. Editor content changes
only after explicit user acceptance, and accepted completion remains revertible.

Tests, demos, and CI use mock providers by default. Real provider checks are
manual and env-gated.
