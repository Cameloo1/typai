import type {
  AttachContenteditableOptions,
  TypaiSettings as ContenteditableSettings,
  DetachContenteditable,
} from "@typai/contenteditable";
import type { TypaiCore } from "@typai/core";
import type {
  AttachTextareaOptions,
  DetachTextarea,
  TextareaAdapterSettings,
} from "@typai/textarea";
import type { TypaiUiDebugData, TypaiUiSettings } from "@typai/ui";
import type { HTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";

export type { TypaiUiDebugData, TypaiUiSettings } from "@typai/ui";

export type TypaiCoreFactory = () => Promise<TypaiCore>;

export type TypaiProviderProps = {
  children: ReactNode;
  typai?: TypaiCore;
  core?: TypaiCore;
  createCore?: TypaiCoreFactory;
};

export type TypaiCoreStatus = "idle" | "loading" | "ready" | "error";

export type TypaiCoreContextValue = {
  typai: TypaiCore | null;
  status: TypaiCoreStatus;
  error: unknown;
  /**
   * Deprecated alias kept during the staged React adapter rollout.
   * Use `typai` instead.
   */
  core: TypaiCore | null;
  /**
   * Deprecated alias kept during the staged React adapter rollout.
   * Use `status === "loading"` instead.
   */
  loading: boolean;
};

export type TypaiAdapterHookStatus = "idle" | "waiting_for_core" | "attached" | "error";

export type TypaiAdapterDebugState = {
  attachCount: number;
  detachCount: number;
  hasElement: boolean;
  coreStatus: TypaiCoreStatus;
  lastError: unknown;
};

export type TypaiTextareaHookOptions = Omit<AttachTextareaOptions, "textarea" | "typai"> & {
  typai?: TypaiCore;
  textareaRef?: Ref<HTMLTextAreaElement>;
  disabled?: boolean;
  readOnly?: boolean;
};

export type TypaiTextareaHookResult = {
  ref: Ref<HTMLTextAreaElement>;
  status: TypaiAdapterHookStatus;
  adapter: DetachTextarea | null;
  debug: TypaiAdapterDebugState;
  settings: TextareaAdapterSettings;
  updateSettings(settings: Partial<TextareaAdapterSettings>): void;
  typai: TypaiCore | null;
  error: unknown;
};

export type TypaiContenteditableHookOptions = Omit<
  AttachContenteditableOptions,
  "element" | "typai"
> & {
  typai?: TypaiCore;
  elementRef?: Ref<HTMLElement>;
};

export type TypaiContenteditableHookResult = {
  ref: Ref<HTMLElement>;
  status: TypaiAdapterHookStatus;
  adapter: DetachContenteditable | null;
  debug: TypaiAdapterDebugState;
  settings: ContenteditableSettings;
  updateSettings(settings: Partial<ContenteditableSettings>): void;
  typai: TypaiCore | null;
  error: unknown;
};

export type TypaiNativeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "ref">;

export type TypaiTextareaProps = TypaiNativeTextareaProps &
  TypaiTextareaHookOptions & {
    textareaProps?: TypaiNativeTextareaProps;
  };

export type TypaiNativeContenteditableProps = Omit<HTMLAttributes<HTMLDivElement>, "ref">;

export type TypaiContenteditableProps = TypaiNativeContenteditableProps &
  TypaiContenteditableHookOptions & {
    contenteditableProps?: TypaiNativeContenteditableProps;
  };

export type TypaiSettingsPanelProps = {
  settings: TypaiUiSettings;
  onSettingsChange?(settings: TypaiUiSettings): void;
  onChange?(settings: TypaiUiSettings): void;
  label?: string;
};

export type TypaiDebugTableProps = {
  data?: Partial<TypaiUiDebugData>;
  label?: string;
};
