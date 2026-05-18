import { forwardRef, type ReactElement } from "react";
import { useComposedRefs } from "../internals/useComposedRefs";
import type { TypaiTextareaProps } from "../types";
import { useTypaiTextarea } from "../useTypaiTextarea";

export const TypaiTextarea = forwardRef<HTMLTextAreaElement, TypaiTextareaProps>(
  function TypaiTextarea(
    {
      textareaRef,
      textareaProps,
      typai,
      autocorrect,
      spellcheck,
      settings,
      overlay,
      onDecision,
      onCorrection,
      onMark,
      onMarkRemoved,
      onProtectedSkip,
      ...directTextareaProps
    },
    forwardedRef,
  ): ReactElement {
    const mergedTextareaProps = {
      ...textareaProps,
      ...directTextareaProps,
    };
    const hook = useTypaiTextarea({
      textareaRef,
      typai,
      autocorrect,
      spellcheck,
      settings,
      overlay,
      disabled: mergedTextareaProps.disabled,
      readOnly: mergedTextareaProps.readOnly,
      onDecision,
      onCorrection,
      onMark,
      onMarkRemoved,
      onProtectedSkip,
    });
    const ref = useComposedRefs(hook.ref, forwardedRef);

    return <textarea {...mergedTextareaProps} ref={ref} data-typai-react-textarea="true" />;
  },
);
