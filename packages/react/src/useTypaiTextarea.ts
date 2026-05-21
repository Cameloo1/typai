import {
  attachTextarea,
  type DetachTextarea,
  type TextareaAdapterSettings,
  type TextareaCorrectionEvent,
  type TextareaDecisionEvent,
  type TextareaMarkEvent,
  type TextareaMarkRemovedEvent,
  type TextareaProtectedSkipEvent,
} from "@typai/textarea";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useComposedRefs } from "./internals/useComposedRefs";
import { useStableCallback } from "./internals/useStableCallback";
import type {
  TypaiAdapterHookStatus,
  TypaiTextareaHookOptions,
  TypaiTextareaHookResult,
} from "./types";
import { useTypaiCore } from "./useTypaiCore";

const defaultTextareaSettings: TextareaAdapterSettings = {
  autocorrect: true,
  spellcheck: true,
  keepCorrectionMarksVisible: true,
  usePersonalDictionary: true,
};

const useAdapterLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useTypaiTextarea(options: TypaiTextareaHookOptions = {}): TypaiTextareaHookResult {
  const coreContext = useTypaiCore();
  const typai = options.typai ?? coreContext.typai;
  const completion = options.completion ?? coreContext.completion?.textarea;
  const coreStatus = options.typai !== undefined ? "ready" : coreContext.status;
  const coreError = options.typai !== undefined ? null : coreContext.error;
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);
  const [adapter, setAdapter] = useState<DetachTextarea | null>(null);
  const adapterRef = useRef<DetachTextarea | null>(null);
  const [status, setStatus] = useState<TypaiAdapterHookStatus>("idle");
  const [lastError, setLastError] = useState<unknown>(null);
  const [attachCount, setAttachCount] = useState(0);
  const [detachCount, setDetachCount] = useState(0);
  const [localSettings, setLocalSettings] = useState<Partial<TextareaAdapterSettings>>({});
  const elementRef = useCallback((node: HTMLTextAreaElement | null) => {
    setTextarea(node);
  }, []);
  const ref = useComposedRefs(elementRef, options.textareaRef);
  const settings = useMemo<TextareaAdapterSettings>(
    () => ({
      autocorrect:
        localSettings.autocorrect ??
        options.autocorrect ??
        options.settings?.autocorrect ??
        defaultTextareaSettings.autocorrect,
      spellcheck:
        localSettings.spellcheck ??
        options.spellcheck ??
        options.settings?.spellcheck ??
        defaultTextareaSettings.spellcheck,
      keepCorrectionMarksVisible:
        localSettings.keepCorrectionMarksVisible ??
        options.settings?.keepCorrectionMarksVisible ??
        defaultTextareaSettings.keepCorrectionMarksVisible,
      usePersonalDictionary:
        localSettings.usePersonalDictionary ??
        options.settings?.usePersonalDictionary ??
        defaultTextareaSettings.usePersonalDictionary,
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

  const updateSettings = useStableCallback((nextSettings: Partial<TextareaAdapterSettings>) => {
    setLocalSettings((current) => ({ ...current, ...nextSettings }));
  });
  const onDecision = useStableCallback((event: TextareaDecisionEvent) => {
    options.onDecision?.(event);
  });
  const onCorrection = useStableCallback((event: TextareaCorrectionEvent) => {
    options.onCorrection?.(event);
  });
  const onMark = useStableCallback((event: TextareaMarkEvent) => {
    options.onMark?.(event);
  });
  const onMarkRemoved = useStableCallback((event: TextareaMarkRemovedEvent) => {
    options.onMarkRemoved?.(event);
  });
  const onProtectedSkip = useStableCallback((event: TextareaProtectedSkipEvent) => {
    options.onProtectedSkip?.(event);
  });
  const overlayEnabled = options.overlay?.enabled ?? completion !== undefined;
  const overlayClassName = options.overlay?.className;
  const disabled = options.disabled;
  const readOnly = options.readOnly;

  useEffect(() => {
    adapterRef.current?.updateSettings(settings);
  }, [settings]);

  useAdapterLayoutEffect(() => {
    if (typai === null) {
      setAdapter(null);
      setStatus(coreStatus === "error" ? "error" : "waiting_for_core");
      setLastError(coreStatus === "error" ? coreError : null);
      return;
    }

    if (textarea === null) {
      setAdapter(null);
      setStatus("idle");
      setLastError(null);
      return;
    }

    if (disabled === true || readOnly === true || textarea.disabled || textarea.readOnly) {
      setAdapter(null);
      setStatus("idle");
      setLastError(null);
      return;
    }

    try {
      const attachedAdapter = attachTextarea({
        textarea,
        typai,
        settings: settingsRef.current,
        overlay: {
          enabled: overlayEnabled,
          className: overlayClassName,
        },
        completion,
        onDecision,
        onCorrection,
        onMark,
        onMarkRemoved,
        onProtectedSkip,
      });
      const disconnectCompletion = completion?.connectEditor?.(attachedAdapter);

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

        disconnectCompletion?.();
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
    textarea,
    overlayEnabled,
    overlayClassName,
    completion,
    disabled,
    readOnly,
    onDecision,
    onCorrection,
    onMark,
    onMarkRemoved,
    onProtectedSkip,
  ]);

  return useMemo(
    () => ({
      ref,
      status,
      adapter,
      debug: {
        attachCount,
        detachCount,
        hasElement: textarea !== null,
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
      textarea,
      coreStatus,
      lastError,
      settings,
      updateSettings,
      typai,
      coreError,
    ],
  );
}
