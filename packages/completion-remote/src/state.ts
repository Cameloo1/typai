import type { CompletionProviderErrorKind } from "./provider";

export type CompletionState =
  | { status: "idle" }
  | { status: "scheduled"; requestId: string }
  | { status: "requesting"; requestId: string }
  | { status: "showing"; requestId: string; text: string }
  | { status: "accepted"; requestId: string }
  | { status: "dismissed"; requestId: string; reason: string }
  | { status: "stale"; requestId: string }
  | {
      status: "error";
      requestId: string;
      error: string;
      providerErrorKind?: CompletionProviderErrorKind;
    };

export const idleCompletionState: CompletionState = { status: "idle" };

export function isActiveCompletionState(state: CompletionState): boolean {
  return (
    state.status === "scheduled" || state.status === "requesting" || state.status === "showing"
  );
}
