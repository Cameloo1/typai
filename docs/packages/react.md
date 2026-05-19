# @typai/react

`@typai/react` wraps Typai correction for React apps.

Use it for:

- `TypaiProvider`
- `useTypaiCore`
- `useTypaiTextarea`
- `useTypaiContenteditable`
- `TypaiTextarea`
- `TypaiContenteditable`

Quickstart:

```tsx
import { createTypaiCore } from "@typai/core";
import { TypaiProvider, TypaiTextarea } from "@typai/react";

export function Editor() {
  return (
    <TypaiProvider createCore={createTypaiCore}>
      <TypaiTextarea defaultValue="Type here." />
    </TypaiProvider>
  );
}
```

Completion controllers can be passed as props or through provider context, but
provider credentials must stay out of React client code.
