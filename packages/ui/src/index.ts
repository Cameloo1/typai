export {
  createEscapeKeyHandler,
  focusFirstAction,
  restoreFocus,
} from "./accessibility/focus";
export {
  createTypaiLiveRegion,
  type TypaiLiveRegion,
  type TypaiLiveRegionOptions,
} from "./accessibility/liveRegion";
export {
  type CreateDebugTableOptions,
  createDebugTable,
} from "./debug/createDebugTable";
export type {
  TypaiDebugTableHandle,
  TypaiUiDebugData,
  TypaiUiDebugEvent,
} from "./debug/types";
export {
  type CorrectionPopoverOptions,
  createCorrectionPopover,
} from "./popovers/correctionPopover";
export {
  type CreatePopoverOptions,
  createPopover,
} from "./popovers/createPopover";
export {
  createSpellingPopover,
  type SpellingPopoverOptions,
} from "./popovers/spellingPopover";
export type {
  CorrectionPopoverActions,
  CorrectionPopoverData,
  SpellingPopoverActions,
  SpellingPopoverData,
  TypaiPopoverHandle,
  TypaiSuggestionAction,
  TypaiUiAction,
  TypaiUiActionResult,
} from "./popovers/types";
export {
  type CreateSettingsPanelOptions,
  createSettingsPanel,
} from "./settings/createSettingsPanel";
export type {
  TypaiSettingsPanelHandle,
  TypaiUiSettings,
  TypaiUiSettingsChange,
} from "./settings/types";
export {
  createTypaiUiStyleElement,
  ensureTypaiUiStyles,
  typaiUiStyles,
} from "./styles/typaiUiStyles";
