# @typai/core

Local deterministic correction engine for Typai.

This package owns token checks, suggestions, protected-span helpers, storage
interfaces, memory APIs, dictionary APIs, and the generated Wasm engine output.
It does not import `@typai/completion-remote`, call provider APIs, or require a
server.

Spell suggestions use the local C++ delete-index path when dictionary data is
loaded. Delete-index candidates are suggestions only unless the token is also
present in Typai's audited common-typo table. Autocorrect remains limited to
explicit common typos and user always-correct rules, with valid words and
protected tokens blocked from automatic correction.

Current safe spelling behavior includes casing and trailing-punctuation
preservation for approved autocorrections, plus conservative contraction and
plural-ambiguity suggestions that remain red unresolved marks.

Dictionary assets load only during `createTypaiCore()` initialization. After
initialization, `checkCompletedToken()` and `suggestToken()` stay synchronous
and do not fetch assets or touch the network.

Supported dictionary modes:

- `built-in`: default tiny deterministic engine vocabulary; no dynamic asset is
  loaded.
- `host-provided`: load Typai Dictionary Blob v1 bytes through `bytes`, `load`,
  or `url` during initialization.
- `production`: reserved for a future approved packaged language asset. It
  currently throws a clear unavailable error because no production dictionary or
  frequency asset is bundled.
- `fixture` and `scaled-mock`: explicit test/stress modes for repo-local
  fixture bytes. They still require `bytes`, `load`, or `url` and are not
  production coverage.

Current package policy: production language assets are excluded from
`@typai/core`. Host-provided assets and repo-local mock fixtures are the only
available asset paths until manifest, hash, license, attribution, size, quality,
and review gates pass. `pnpm pack:dry`, `pnpm package:size-report`,
`pnpm scan:package-secrets`, `pnpm smoke:install`, and
`pnpm smoke:public-beta` enforce that blocked production binaries and raw
language source files do not ship.

Host-provided assets are embedder-owned. They are loaded once during
initialization and then held by the local deterministic engine:

```ts
import { createTypaiCore } from "@typai/core";

const typai = await createTypaiCore({
  dictionary: {
    bytes: new Uint8Array(dictionaryBlobBytes),
  },
});
```

Embedders can also provide an initialization-time loader:

```ts
const typai = await createTypaiCore({
  dictionary: {
    load: async () => new Uint8Array(await readBlobBytes()),
  },
});
```

The host-provided blob must already be Typai Dictionary Blob v1 and must pass
the normal loader validation. It is separate from personal/project dictionary
memory. It does not enable valid-word autocorrect, protected-token writes, or
delete-index-only autocorrect.

Failed host-provided, fixture, scaled-mock, or blocked production loads fail
without replacing the currently loaded C++ dictionary/delete-index state.
`built-in` mode or a default `createTypaiCore()` call clears the dynamic
dictionary and returns to the tiny deterministic built-in vocabulary.

Runtime asset stats are exposed as primitive synchronous diagnostics:

```ts
typai.getLoadedDictionaryWordCount();
typai.getLoadedDictionaryByteSize();
typai.getDeleteIndexEntryCount();
typai.getDeleteIndexMemoryEstimateBytes();
```

Production transform commands:

- `pnpm --filter @typai/core build:dictionary:fixture` validates the full
  deterministic transform against repo-local fixtures.
- `pnpm --filter @typai/core build:dictionary:production` fails closed until
  the production manifest is approved and all source/license/hash gates pass.
- `pnpm --filter @typai/core validate:dictionary:production` accepts the
  blocked state only when no generated production output is present.
- `pnpm --filter @typai/core inspect:dictionary` prints generated fixture or
  production asset metadata when an ignored generated output exists.

Scaled mock output is mock-only. It can stress the loader and delete-index, but
its metadata is `mockOnly: true`, `production: false`, and
`packageInclusionPolicy: "not bundled"`.

The package metadata uses `UNLICENSED` until the project license is selected.
No npm publish has occurred.
