# Consumer: Vanilla Textarea

This example shows the smallest browser integration for local deterministic
correction on a native `<textarea>`.

## Run

```sh
pnpm --filter consumer-vanilla-textarea build
pnpm --filter consumer-vanilla-textarea dev
```

## Demonstrates

- `createTypaiCore()`
- `attachTextarea()`
- textarea overlay rendering
- local correction and mark events

## Does Not Demonstrate

- remote completion
- provider proxies
- provider credentials in browser code
- npm registry installation
