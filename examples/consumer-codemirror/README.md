# Consumer: CodeMirror

This example shows the smallest CodeMirror 6 integration for Typai's local
deterministic correction.

## Run

```sh
pnpm --filter consumer-codemirror build
pnpm --filter consumer-codemirror dev
```

## Demonstrates

- `createTypaiCore()`
- `createTypaiCodeMirrorExtension()`
- local correction in a CodeMirror editor
- red/blue mark callbacks

## Does Not Demonstrate

- provider-backed completion
- provider credentials in browser code
- npm registry installation
