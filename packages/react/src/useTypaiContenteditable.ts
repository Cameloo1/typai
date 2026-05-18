import {
  attachContenteditable,
  type CorrectionTransaction,
  type DetachContenteditable,
  type TypaiPopover,
  type TypaiSettings,
  type TypaiTextChange,
  type TypaiUserAction,
  type VisualMark,
} from "@typai/contenteditable";
import type { CorrectionDecision, Token } from "@typai/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useComposedRefs } from "./internals/useComposedRefs";
import { useStableCallback } from "./internals/useStableCallback";
import type {
  TypaiAdapterHookStatus,
  TypaiContenteditableHookOptions,
  TypaiContenteditableHookResult,
} from "./types";
import { useTypaiCore } from "./useTypaiCore";

const defaultContenteditableSettings: TypaiSettings = {
  autocorrect: true,
  spellcheck: true,
  keepCorrectionMarksVisible: true,
  usePersonalDictionary: true,
};

export function useTypaiContenteditable(
  options: TypaiContenteditableHookOptions = {},
): TypaiContenteditableHookResult {
  const coreContext = useTypaiCore();
  const typai = options.typai ?? coreContext.typai;
  const coreStatus = options.typai !== undefined ? "ready" : coreContext.status;
  const coreError = options.typai !== undefined ? null : coreContext.error;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [adapter, setAdapter] = useState<DetachContenteditable | null>(null);
  const adapterRef = useRef<DetachContenteditable | null>(null);
  const [status, setStatus] = useState<TypaiAdapterHookStatus>("idle");
  const [lastError, setLastError] = useState<unknown>(null);
  const [attachCount, setAttachCount] = useState(0);
  const [detachCount, setDetachCount] = useState(0);
  const [localSettings, setLocalSettings] = useState<Partial<TypaiSettings>>({});
  const elementRef = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);
  const ref = useComposedRefs(elementRef, options.elementRef);
  const settings = useMemo<TypaiSettings>(
    () => ({
      autocorrect:
        localSettings.autocorrect ??
        options.autocorrect ??
        options.settings?.autocorrect ??
        defaultContenteditableSettings.autocorrect,
      spellcheck:
        localSettings.spellcheck ??
        options.spellcheck ??
        options.settings?.spellcheck ??
        defaultContenteditableSettings.spellcheck,
      keepCorrectionMarksVisible:
        localSettings.keepCorrectionMarksVisible ??
        options.settings?.keepCorrectionMarksVisible ??
        defaultContenteditableSettings.keepCorrectionMarksVisible,
      usePersonalDictionary:
        localSettings.usePersonalDictionary ??
        options.settings?.usePersonalDictionary ??
        defaultContenteditableSettings.usePersonalDictionary,
    }),
    [
      localSettings,
      options.autocorrect,
      options.spellcheck,
      options.settings?.autocorrect,
      options.settings?.spellcheck,
      options.settings?.keepCorrectionMarksVisible,
      options.settings?.usePersonalDictionary,
    ],
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateSettings = useStableCallback((nextSettings: Partial<TypaiSettings>) => {
    setLocalSettings((current) => ({ ...current, ...nextSettings }));
  });
  const onDecision = useStableCallback((decision: CorrectionDecision) => {
    options.onDecision?.(decision);
  });
  const onCorrection = useStableCallback((transaction: CorrectionTransaction) => {
    options.onCorrection?.(transaction);
  });
  const onMark = useStableCallback((mark: VisualMark) => {
    options.onMark?.(mark);
  });
  const onMarkRemoved = useStableCallback((mark: VisualMark) => {
    options.onMarkRemoved?.(mark);
  });
  const onPopover = useStableCallback((popover: TypaiPopover | null) => {
    options.onPopover?.(popover);
  });
  const onProtectedSkip = useStableCallback((token: Token) => {
    options.onProtectedSkip?.(token);
  });
  const onSettingsChange = useStableCallback((nextSettings: TypaiSettings) => {
    setLocalSettings(nextSettings);
    options.onSettingsChange?.(nextSettings);
  });
  const onTextChange = useStableCallback((change: TypaiTextChange) => {
    options.onTextChange?.(change);
  });
  const onUserAction = useStableCallback((action: TypaiUserAction) => {
    options.onUserAction?.(action);
  });

  useEffect(() => {
    adapterRef.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (typai === null) {
      setAdapter(null);
      setStatus(coreStatus === "error" ? "error" : "waiting_for_core");
      setLastError(coreStatus === "error" ? coreError : null);
      return;
    }

    if (element === null) {
      setAdapter(null);
      setStatus("idle");
      setLastError(null);
      return;
    }

    try {
      const attachedAdapter = attachContenteditable({
        element,
        typai,
        settings: settingsRef.current,
        onDecision,
        onCorrection,
        onMark,
        onMarkRemoved,
        onPopover,
        onProtectedSkip,
        onSettingsChange,
        onTextChange,
        onUserAction,
      });

      adapterRef.current = attachedAdapter;
      setAdapter(() => attachedAdapter);
      setAttachCount((current) => current + 1);
      setStatus("attached");
      setLastError(null);

      return () => {
        if (adapterRef.current === attachedAdapter) {
          adapterRef.current = null;
          setAdapter(null);
        }

        attachedAdapter();
        setDetachCount((current) => current + 1);
      };
    } catch (error: unknown) {
      adapterRef.current = null;
      setAdapter(null);
      setStatus("error");
      setLastError(error);
      return;
    }
  }, [
    typai,
    coreStatus,
    coreError,
    element,
    onDecision,
    onCorrection,
    onMark,
    onMarkRemoved,
    onPopover,
    onProtectedSkip,
    onSettingsChange,
    onTextChange,
    onUserAction,
  ]);

  return useMemo(
    () => ({
      ref,
      status,
      adapter,
      debug: {
        attachCount,
        detachCount,
        hasElement: element !== null,
        coreStatus,
        lastError,
      },
      settings,
      updateSettings,
      typai,
      error: lastError ?? coreError,
    }),
    [
      ref,
      status,
      adapter,
      attachCount,
      detachCount,
      element,
      coreStatus,
      lastError,
      settings,
      updateSettings,
      typai,
      coreError,
    ],
  );
}
