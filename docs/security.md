# Security

Typai's core security boundary is simple: deterministic correction is local,
and provider credentials stay server-side.

Important rules:

- `@typai/core` has no remote completion dependency
- browser packages call embedder endpoints, not provider APIs
- provider proxy examples default to mock mode
- real provider paths are manual and env-gated
- raw context is not logged by default
- safe errors must not echo secrets or raw context

See also:

- [Provider proxy security contract](./provider-proxy-security-contract.md)
- [Security threat model](./security-threat-model.md)
