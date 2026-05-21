# Consumer: Vanilla Contenteditable

This example shows the smallest browser integration for local deterministic
correction on a `contenteditable` element.

## Run

```sh
pnpm --filter consumer-vanilla-contenteditable build
pnpm --filter consumer-vanilla-contenteditable dev
```

## Demonstrates

- `createTypaiCore()`
- `attachContenteditable()`
- local autocorrection and red/blue mark events
- protected-token skips

## Does Not Demonstrate

- remote completion
- provider proxies
- provider credentials in browser code
- npm registry installation
