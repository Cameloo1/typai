export {
  attachTextarea,
  getCompletedTokenBeforeSelection,
  isTextareaDelimiterInput,
  TYPAI_TEXTAREA_VERSION,
} from "./attachTextarea";
export {
  clampTextareaRange,
  getTextareaRangeText,
  rangeStillMatches,
} from "./internals/textareaRanges";
export { getTextareaSnapshot } from "./internals/textareaSnapshot";
export type {
  AttachTextareaOptions,
  DetachTextarea,
  TextareaAdapterSettings,
  TextareaCompletionAcceptResult,
  TextareaCompletionController,
  TextareaCompletionDismissEvent,
  TextareaCompletionEvent,
  TextareaCompletionMode,
  TextareaCompletionRenderMetadata,
  TextareaCompletionRevertResult,
  TextareaCompletionSnapshot,
  TextareaCompletionTransaction,
  TextareaCorrectionEvent,
  TextareaCorrectionRevertResult,
  TextareaCorrectionTransaction,
  TextareaDecisionEvent,
  TextareaGhostTextClearReason,
  TextareaMark,
  TextareaMarkEvent,
  TextareaMarkRemovedEvent,
  TextareaOverlayMode,
  TextareaPopoverActionResult,
  TextareaProtectedSkipEvent,
  TextareaRange,
  TextareaSnapshot,
} from "./types";
