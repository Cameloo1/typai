# Typai Alpha Foundation

Alpha Foundation is the current completed checkpoint after V1A-dev-1. It keeps
Typai small and deterministic while adding the first real browser-demo safety,
latency, suggestion, storage, and control surfaces.

## What Alpha Foundation Added

- `@typai/core` public TypeScript API backed by Rust/Wasm and the C++ engine.
- C++ deterministic token checks with a tiny dictionary and common typo map.
- C++ edit-distance candidate generation for suggestions only.
- Rust-owned Wasm bridge using `wasm-bindgen`, with no Emscripten or Embind.
- TypeScript wrapper with synchronous hot-path checks after async
  initialization.
- Protected-token and tokenization helpers.
- Async `TypaiStorage` interface with in-memory and IndexedDB implementations.
- Personal dictionary, always-correct, and never-correct TypeScript intercepts.
- `@typai/contenteditable` adapter with document-version and token-text safety.
- V1B blue/red popovers and controls in the contenteditable path.
- `examples/simple-demo-editor` Vite demo with red/blue marks, latency, settings,
  IndexedDB persistence, and debug counters.
- Vitest unit and golden-corpus tests.
- Playwright E2E tests for the demo and V1B controls.
- Direct core latency benchmark and browser-path latency smoke benchmark.

## Current Architecture

- C++ owns deterministic correction and suggestion generation.
- Rust owns the Wasm module and calls C++ through a narrow C ABI.
- TypeScript owns the public wrapper, storage state, and editor adapters.
- C++ never exposes classes to JavaScript.
- C++ never returns `std::string` across FFI.
- C++ does not allocate memory that JavaScript or Rust must free.
- C++ token APIs use caller-owned buffers.
- Full document text is not passed into C++ for token checks.

The current C ABI surface is:

```cpp
extern "C" int typai_check_token(
  const char* token,
  unsigned int token_len,
  char* replacement_out,
  unsigned int replacement_cap,
  double* confidence_out,
  unsigned int* reason_flags_out
);

extern "C" unsigned int typai_suggest_token(
  const char* token,
  unsigned int token_len,
  char* suggestions_out,
  unsigned int suggestions_out_cap,
  unsigned int max_suggestions,
  unsigned int suggestion_slot_cap,
  double* scores_out,
  unsigned int scores_cap,
  unsigned int* reason_flags_out
);
```

## Current Supported Behavior

- Common typo autocorrections:
  - `teh` -> `the`
  - `adn` -> `and`
  - `recieve` -> `receive`
  - `becuase` -> `because`
  - `thier` -> `their`
- Valid words return `do_nothing`.
- Protected-looking tokens return `do_nothing`.
- Unknown alphabetic non-words return red unresolved decisions.
- Edit-distance suggestions can appear on unresolved decisions, for example
  `reciept` suggesting `receipt`.
- Edit-distance suggestions are not autocorrected.
- Blue means Typai changed a word.
- Red means unresolved spelling issue.
- Blue popovers can revert, always-correct, never-correct, or add the original
  token to the dictionary.
- Red popovers can apply suggestions, ignore once, add to dictionary, or disable
  autocorrect for the adapter session.
- IndexedDB persistence is available only behind `TypaiStorage`.

## Current Non-Goals

- No SymSpell/delete index.
- No keyboard adjacency scoring.
- No automatic correction of edit-distance candidates.
- No automatic correction of valid words.
- No grammar, style, tone, clarity, or sentence rewriting.
- No LLM/model calls.
- No server, daemon, localhost API, browser extension, or native helper.
- No React, ProseMirror, CodeMirror, Monaco, textarea, or Codex adapter.
- No background paragraph scan.
- No real dictionary asset yet.
- No C++ dynamic user dictionary.
- No `localStorage`.

## How To Run

Install:

```sh
pnpm install
```

Build:

```sh
pnpm build
```

All unit and package tests:

```sh
pnpm test
```

Focused tests:

```sh
pnpm --filter @typai/core test
pnpm --filter @typai/contenteditable test
pnpm --filter golden-corpus test
```

Playwright E2E:

```sh
pnpm test:e2e
```

Direct core benchmark:

```sh
pnpm --filter @typai/core bench
```

Browser-path benchmark:

```sh
pnpm bench:browser
```

Demo:

```sh
pnpm --filter simple-demo-editor dev
```

## Known Limitations

- The contenteditable adapter is text-first. Public Alpha hardening improves
  caret preservation, range mapping, stale mark cleanup, and plain-text paste,
  but it is not a full rich-text editor adapter.
- Arbitrary nested rich-text DOM safety is not complete.
- Pasted content is normalized to plain text; incoming HTML formatting is not
  preserved.
- Native textarea inline marks are not implemented.
- The dictionary is intentionally tiny.
- There is no real dictionary asset.
- There is no SymSpell/delete index.
- There is no model/LLM path.
- There is no grammar/style layer.
- There is no Codex integration.

## Benchmarks

The core benchmark measures direct `@typai/core` token checks after
initialization. The browser benchmark measures the demo/editor path, including
delimiter handling, token extraction, protected-token checks, core calls, safety
checks, transactions, and mark rendering hooks.

The product target is p95 below 20 ms. The browser benchmark is currently a smoke
measurement and warns above 20 ms; it is not a hard 20 ms CI gate.

## Next Recommended Phase

The next phase should choose one product direction before expanding scope:

- V1B polish: harden popover UX, settings persistence behavior, mark lifecycle,
  rich-text boundaries, and demo clarity.
- Dictionary expansion: add a real dictionary asset and a scalable suggestion
  strategy while keeping autocorrection conservative.

Do not add new adapters, LLM/model calls, background scans, or valid-word
autocorrection as part of Alpha Foundation maintenance.
