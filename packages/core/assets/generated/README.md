# Generated Dictionary Assets

This directory is for generated local dictionary fixtures.

Prompt 101 uses it for a scaled mock asset that stress-tests dictionary loading.
Generated binaries and metadata in this folder are ignored by Git. They are not
production language assets and must not be bundled, packed, or published as
production dictionaries.

Generate the scaled mock with:

```sh
pnpm --filter @typai/core build:dictionary
```

Validate the generated mock with:

```sh
pnpm --filter @typai/core validate:dictionary
```
