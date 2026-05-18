# @typai/adapter-testkit

Internal adapter conformance harness for Typai editor adapters.

This package is private and not a public stable API. It exists so every adapter
can prove the same correction, mark, revert, protected-span, IME, stale-write,
and source-text invariants without duplicating the whole test suite.

## Purpose

Adapters own editor-specific range mapping, version checks, mutation behavior,
marks, transactions, and popover wiring. The testkit defines the small shared
contract those adapters must expose to tests, then runs the same behavioral
cases against each implementation.

## Driver Contract

Adapter tests implement an `AdapterConformanceDriver` with methods for setup,
teardown, reset, typing, reading source text, reading marks, and reading
correction transactions.

Optional capabilities are enabled through `runAdapterConformanceSuite()`
options:

- `compositionGuard`: driver supports explicit IME composition simulation.
- `staleWriteSimulation`: driver can simulate a stale write attempt.
- `plainSourceText`: driver source text must stay markup-free.

## Conformance Cases

The shared suite covers:

- Common typo correction creates text `the ` and a blue mark.
- Blue correction revert restores exact original text `teh `.
- Unknown non-word creates a red mark without changing source text.
- Valid word `form` is not corrected.
- Email, path, identifier, and CVE protected tokens are not corrected.
- IME composition blocks correction when supported.
- Stale range/write simulation does not mutate into a correction when supported.
- Edit-distance suggestions remain red suggestions and are not autocorrected.
- Textarea-like source text remains plain text without inserted markup.

Future adapters can add adapter-specific tests beside this suite. The shared
suite is a floor, not a replacement for editor-specific coverage.
