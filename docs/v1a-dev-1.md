# Typai V1A-dev-1

Typai V1A-dev-1 is a deterministic typo-correction scaffold. It uses a tiny
hard-coded dictionary plus a common typo map, exposed through the C++ engine,
Rust Wasm bridge, TypeScript core wrapper, and a thin contenteditable adapter.

## What Works

- `@typai/core` initializes Wasm asynchronously with `createTypaiCore()`.
- `checkCompletedToken()` is synchronous after initialization.
- `suggestToken()` is synchronous after initialization and returns C++-generated
  edit-distance suggestions through Rust/Wasm.
- Common typos currently covered: `teh`, `adn`, `recieve`, `becuase`, `thier`.
- Known valid words such as `form`, `lead`, `to`, and `its` are not corrected.
- Unknown lowercase alphabetic non-words such as `zzzzword` return unresolved.
- Protected-looking tokens such as emails, URLs, paths, snake_case identifiers,
  and CVE-style tokens are skipped before writes.
- `@typai/contenteditable` supports a simple text-first contenteditable surface
  with document-version safety, token range matching, IME composition guard,
  in-memory correction transactions, and mark callbacks.
- `simple-demo-editor` shows red squiggly unresolved marks, blue dotted applied
  correction marks, direct click-to-revert, latency, and counters.
- Alpha Foundation now includes a C++ `typai_suggest_token` ABI that can return
  edit-distance spelling suggestions for unresolved lowercase non-words.
- `checkCompletedToken()` includes those suggestions in `mark_unresolved`
  decisions, while keeping fuzzy candidates out of autocorrection.
- Alpha Foundation also includes `TypaiStorage`, ephemeral in-memory storage,
  and an IndexedDB browser storage backend. Stored user state is loaded into
  in-memory sets/maps during `createTypaiCore()` initialization, so
  `checkCompletedToken()` does not read storage in the typing hot path.

## Intentional Non-Goals

V1A-dev-1 does not include localStorage, SQLite, a server, localhost API,
daemon, browser extension, native helper process, remote model calls, LLM calls,
project dictionaries, background paragraph scans, SymSpell, delete indexes,
keyboard adjacency scoring, grammar, style, tone, clarity, sentence rewriting,
real-word/context correction, or valid-word autocorrection.

Edit-distance candidates are suggestions only in the Alpha Foundation. They are
not a source of autocorrection; the common typo map remains the only automatic
edit source.

It also does not include React, ProseMirror, CodeMirror, Monaco, textarea
overlay, or Codex adapters. The demo is contenteditable-first. Native textarea
inline marks are not implemented.

The native bridge does not use Emscripten or Embind. C++ does not expose classes
to JavaScript, does not return `std::string` across FFI, does not allocate memory
that JavaScript or Rust must free, and does not receive full document text.

## C ABI

The C++ engine boundary remains:

```cpp
extern "C" int typai_check_token(
  const char* token,
  unsigned int token_len,
  char* replacement_out,
  unsigned int replacement_cap,
  double* confidence_out,
  unsigned int* reason_flags_out
);
```

The Alpha Foundation suggestion boundary is:

```cpp
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

## Build

```sh
pnpm build
```

## Tests

```sh
pnpm test
pnpm --filter @typai/core test
pnpm --filter @typai/contenteditable test
pnpm --filter golden-corpus test
```

## Demo

```sh
pnpm --filter simple-demo-editor dev
```

Open `http://127.0.0.1:5173`.

Manual scenarios:

- Type `teh ` and it becomes `the ` with a blue dotted underline.
- Click `the` and it reverts to `teh`.
- Type `zzzzword ` and it gets a red squiggly underline.
- Type `form ` and it is not corrected.
- Type `user@example.com ` and it is not corrected.
- Type `/etc/passwd ` and it is not corrected.
- Type `snake_case_identifier ` and it is not corrected.

## Benchmark

```sh
pnpm --filter @typai/core bench
pnpm bench:browser
```

The core benchmark measures direct `@typai/core` `checkCompletedToken()` calls.
The browser benchmark measures the simple demo/editor path around on-space
handling, including token extraction, protected-span checks, Wasm calls when
needed, safety checks, correction transactions, and mark rendering.

Both benchmark paths loop over common typo, valid word, protected-token, and
unresolved non-word cases. They report count, mean, p50, p95, and p99; the
browser benchmark also reports max. The product target is p95 below 20 ms.
Browser timing is a smoke measurement rather than a hard CI gate: it warns when
p95 exceeds 20 ms, but only fails for broken/non-finite instrumentation or
wildly high timing.
