# @typai/adapter-testkit

Internal adapter conformance harness for Typai editor adapters.

This package is private and not a public stable API. It exists so every adapter
can prove the same correction, mark, revert, protected-span, IME, stale-write,
source-text, and completion invariants without duplicating the whole test
suite.

## Purpose

Adapters own editor-specific range mapping, version checks, mutation behavior,
marks, transactions, popover wiring, ghost rendering, and accepted-completion
application. The testkit defines the small shared contracts those adapters must
expose to tests, then runs the same behavioral cases against each
implementation.

## Correction Driver Contract

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

## Completion Driver Contract

Completion tests implement a `CompletionConformanceDriver` with methods for
setup, teardown, reset, typing, reading source text, reading ghost text,
waiting for mocked provider output, accepting with Tab, dismissing with Escape,
reading accepted-completion transactions, and optionally reading local metrics.

The completion driver is intentionally editor-shaped instead of provider-shaped.
`@typai/completion-remote` owns provider behavior and scheduling; adapters own
surface-specific ghost rendering, explicit acceptance, transaction application,
and exact revert.

Optional completion capabilities are enabled through
`runCompletionConformanceSuite()` options:

- `exactRevert`: driver can revert the last accepted completion.
- `selectionChangeDismiss`: driver can simulate selection changes.
- `compositionDismiss`: driver can simulate `compositionstart`.
- `staleResponseDrop`: driver can force a stale mocked provider response.
- `providerError`: driver can force a mocked provider error.
- `blueCorrectionMarkCheck`: driver exposes correction mark inspection so
  accepted completion can be proven not to create a blue correction mark.
- `correctionTransactionDismiss`: driver can trigger a correction transaction
  while ghost text is visible.
- `metricsPrivacy`: driver exposes default completion metrics.

Drivers should pass `skipReasons` for unsupported optional capabilities. The
suite includes a dedicated reporting test so every skipped behavior has an
explicit explanation.

## Current Adapter Matrix

- `@typai/contenteditable`: common typo, exact revert, red unresolved marks,
  red suggestion application, protected token no-op, IME guard, stale-write
  simulation, no correction-time completion dependency, and contenteditable
  remote completion conformance through a mocked provider.
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

The shared correction suite covers:

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

The shared completion suite covers:

- Ghost text appears after debounce and mocked provider response.
- Ghost text is not included in source text before accept.
- Tab accepts ghost text.
- Accepted completion text becomes source text.
- Accepted completion creates a completion transaction.
- Exact revert removes the accepted completion where supported.
- Escape dismisses ghost text.
- Continued typing dismisses ghost text.
- Selection changes dismiss ghost text where supported.
- `compositionstart` dismisses or suppresses ghost text where supported.
- Stale provider responses are dropped where supported.
- Provider errors do not mutate source text.
- Accepted completion does not create a blue correction mark where mark
  inspection is available.
- Correction transactions dismiss ghost text where supported.
- Default metrics do not include raw prompt context where metrics are exposed.

Future adapters can add adapter-specific tests beside this suite. The shared
suite is a floor, not a replacement for editor-specific coverage.
