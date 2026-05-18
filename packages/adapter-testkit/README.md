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

- `redSuggestionApply`: driver can apply the first red suggestion.
- `compositionGuard`: driver supports explicit IME composition simulation.
- `staleWriteSimulation`: driver can simulate a stale write attempt.
- `plainSourceText`: driver source text must stay markup-free.
- `codeBlockProtection`: driver models Markdown fenced-code protection.
- `completionSurfaceCheck`: driver can assert that no ghost text or remote
  completion path exists.

Drivers should also pass `skipReasons` for unsupported optional capabilities so
skips are intentional and visible in the suite configuration.

## Current Adapter Matrix

- `@typai/contenteditable`: common typo, exact revert, red unresolved marks,
  red suggestion application, protected token no-op, IME guard, stale-write
  simulation, and no completion surface.
- `@typai/textarea`: common typo, exact revert, red unresolved marks,
  protected token no-op, IME guard, stale-write simulation, plain source text,
  and no completion surface. The minimal unit driver does not expose popover
  DOM for red suggestion application.
- `@typai/react` textarea: React lifecycle coverage for the textarea adapter,
  including attach/detach, common typo, exact revert, red unresolved marks,
  protected token no-op, IME guard, stale-write simulation, plain source text,
  and no completion surface. The conformance driver uses the normal hook path
  without overlay popover DOM, so red suggestion application is skipped there.
- `@typai/react` contenteditable: React lifecycle coverage for the
  contenteditable adapter, including common typo, exact revert, red unresolved
  marks, red suggestion application, protected token no-op, IME guard,
  stale-write simulation, and no completion surface.
- `@typai/codemirror`: CodeMirror 6 document coverage for common typo, exact
  revert, red unresolved marks, red suggestion application, protected token
  no-op, stale-write simulation, fenced-code protection, and no completion
  surface. IME composition is skipped because CodeMirror composition state is
  not directly writable in jsdom tests.

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
- Red suggestions can be applied when the driver exposes that action.
- Textarea-like source text remains plain text without inserted markup.
- CodeMirror fenced code blocks are hard protected contexts.
- Ghost text completion and remote completion paths are absent where the driver
  can introspect them.

Future adapters can add adapter-specific tests beside this suite. The shared
suite is a floor, not a replacement for editor-specific coverage.
