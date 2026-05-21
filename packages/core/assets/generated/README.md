# Generated Dictionary Assets

This directory is for generated local dictionary fixtures and transform
validation output.

Prompt 101 uses it for a scaled mock asset that stress-tests dictionary loading.
Generated binaries and metadata in this folder are ignored by Git. They are not
production language assets and must not be bundled, packed, or published as
production dictionaries.

Scaled mock output is deliberately synthetic. Its metadata must keep
`mockOnly: true`, `production: false`, and `packageInclusionPolicy:
"not bundled"`. It can stress initialization, Blob v1 validation, dynamic word
loading, and delete-index construction, but it is not language coverage.

Prompt 131 and later use the `production-transform-fixture*` subdirectories for
ignored fixture outputs that prove the deterministic transform pipeline while
the production manifest is blocked. Those fixture outputs are not generated
production assets.

Generate the scaled mock with:

```sh
pnpm --filter @typai/core build:dictionary
```

Validate the generated mock with:

```sh
pnpm --filter @typai/core validate:dictionary
```
