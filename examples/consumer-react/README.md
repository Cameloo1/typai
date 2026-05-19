# Consumer: React

This example shows the smallest React integration for Typai's local correction
components.

## Run

```sh
pnpm --filter consumer-react build
pnpm --filter consumer-react dev
```

## Demonstrates

- `TypaiProvider`
- `TypaiTextarea`
- `TypaiContenteditable`
- local deterministic correction through React lifecycle hooks

## Does Not Demonstrate

- provider-backed completion
- provider credentials in browser code
- npm registry installation

The React components accept completion controller props, but this example keeps
completion off so the correction boundary is easy to inspect.
