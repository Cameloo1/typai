# @typai/react

React adapter package for Typai.

This package is a real React integration layer, not a thin re-export wrapper.
It owns React lifecycle, refs, provider state, settings surfaces, debug
rendering, and component ergonomics around `@typai/textarea` and
`@typai/contenteditable`.

## Status

This package is part of the Rich Editor Adapter Foundation phase.

- Prompt 51: provider, context, refs, exports, and scaffold components.
- Prompt 52: textarea/contenteditable hook attachment behavior, provider
  fallback, direct `typai` overrides, stable callback forwarding, and cleanup.
- Prompt 53: React components for textarea, contenteditable, settings, and
  local debug display.
- Prompt 83 / V4.1-6: optional completion controller integration for React
  textarea and contenteditable hooks/components.

## Runtime Boundary

Typai's deterministic correction core remains under `@typai/core`, backed by
the C++ engine and Rust/Wasm bridge. React is a peer dependency of this package
only. React is not added to `@typai/core` or to non-React adapter packages.

No server, model call, LLM, local service, browser extension, production
dictionary asset, ghost text completion, or remote completion provider is
required for deterministic correction. Completion is optional and explicit:
React hooks/components accept a structural completion controller from the
embedder, but `@typai/react` does not construct remote providers and does not
need provider API keys in browser code. Use `@typai/completion-remote` only from
an embedder-owned path, such as a mock provider for tests/demos or an endpoint
provider routed through the embedder's backend.

## Install

During the alpha workspace phase this package is consumed through the monorepo
workspace. Once packed, an app will install React as the peer dependency and use
Typai packages together:

```sh
pnpm add @typai/core @typai/react react react-dom
```

## Provider Example

```tsx
import { createTypaiCore } from "@typai/core";
import { TypaiProvider, TypaiTextarea } from "@typai/react";

export function Editor() {
  return (
    <TypaiProvider createCore={() => createTypaiCore()}>
      <TypaiTextarea textareaProps={{ placeholder: "Write..." }} />
    </TypaiProvider>
  );
}
```

`TypaiProvider` also accepts an existing initialized core:

```tsx
<TypaiProvider typai={typai}>
  <TypaiTextarea />
</TypaiProvider>
```

## Hook Example

```tsx
import { useTypaiTextarea } from "@typai/react";

export function PromptBox({ typai }) {
  const textarea = useTypaiTextarea({
    typai,
    autocorrect: true,
    spellcheck: true,
    onCorrection(event) {
      console.log(event.transaction.id);
    },
  });

  return <textarea ref={textarea.ref} />;
}
```

`useTypaiCore()` returns `{ typai, status, error }` with status values
`"idle"`, `"loading"`, `"ready"`, and `"error"`. `useTypaiTextarea()` and
`useTypaiContenteditable()` return a React ref, adapter status, attached adapter
handle, local debug counters, settings, and `updateSettings()`.

## Optional Completion

Completion is not enabled by default. Pass a controller explicitly:

```tsx
<TypaiTextarea
  typai={typai}
  completion={textareaCompletion}
  textareaProps={{ placeholder: "Write..." }}
/>

<TypaiContenteditable
  typai={typai}
  completion={contenteditableCompletion}
  completionMode="prompt"
/>
```

Hooks accept the same option:

```tsx
const textarea = useTypaiTextarea({
  typai,
  completion: textareaCompletion,
});
```

`TypaiProvider` may also provide optional surface-specific controllers:

```tsx
<TypaiProvider
  typai={typai}
  completion={{
    textarea: textareaCompletion,
    contenteditable: contenteditableCompletion,
  }}
>
  <TypaiTextarea />
</TypaiProvider>
```

Completion controllers are structural objects. React forwards editor snapshots
to them and, when they expose `connectEditor(editor)`, connects the attached
adapter so the controller can render ghost text through adapter-owned APIs.
Textarea completion enables the textarea overlay by default only when a
completion controller is present; correction-only components keep the overlay
opt-in behavior.

Examples must use deterministic mock providers or an embedder endpoint. Do not
put private provider keys in React components, browser bundles, or public demos.

## Component Example

```tsx
<TypaiTextarea
  typai={typai}
  autocorrect
  spellcheck
  settings={{ keepCorrectionMarksVisible: true }}
  textareaProps={{ placeholder: "Write..." }}
  onCorrection={(event) => {
    console.log(event.transaction.replacement);
  }}
/>
```

```tsx
<TypaiContenteditable
  typai={typai}
  contenteditableProps={{
    role: "textbox",
    "aria-label": "Editor",
  }}
/>
```

Direct native props and `textareaProps`/`contenteditableProps` are both
supported. Direct props win when the same native prop is supplied in both
places. Components use provider context when `typai` is omitted; an explicit
`typai` prop overrides provider context.

## Settings And Debug

```tsx
<TypaiSettingsPanel
  settings={settings}
  onChange={setSettings}
/>

<TypaiDebugTable
  data={{
    correctionCount: 2,
    unresolvedCount: 1,
    revertCount: 0,
    protectedSkipCount: 3,
    recentEvents: [],
    latenciesMs: [],
  }}
/>
```

Settings cover deterministic local correction only: autocorrect, spellcheck,
correction-mark visibility, and personal dictionary use. The debug table renders
caller-supplied local event summaries and counts. It does not collect or render
full document text, next-edit logs, completion metrics, provider metrics, or
remote-completion state.

## Known Limitations

- `TypaiTextarea` is intended for native textarea ownership where
  `@typai/textarea` may update `textarea.value` directly. Fully controlled React
  `value` rerenders can overwrite native adapter edits unless the parent mirrors
  the corrected value.
- Textarea overlay DOM is opt-in from React hooks/components so React keeps
  ownership of its rendered textarea tree by default.
- `TypaiContenteditable` renders a single contenteditable `div`; richer editor
  integrations come later through CodeMirror and planning-only ProseMirror or
  Monaco work.
- No production dictionary asset is bundled in this phase.
