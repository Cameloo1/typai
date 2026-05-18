import { forwardRef, type ReactElement, type Ref } from "react";
import { useComposedRefs } from "../internals/useComposedRefs";
import type { TypaiContenteditableProps } from "../types";
import { useTypaiContenteditable } from "../useTypaiContenteditable";

export const TypaiContenteditable = forwardRef<HTMLDivElement, TypaiContenteditableProps>(
  function TypaiContenteditable(
    {
      elementRef,
      contenteditableProps,
      typai,
      completion,
      completionMode,
      autocorrect,
      spellcheck,
      settings,
      onDecision,
      onCorrection,
      onMark,
      onMarkRemoved,
      onPopover,
      onProtectedSkip,
      onSettingsChange,
      onTextChange,
      onUserAction,
      onCompletionAccepted,
      onCompletionReverted,
      ...directContenteditableProps
    },
    forwardedRef,
  ): ReactElement {
    const mergedContenteditableProps = {
      ...contenteditableProps,
      ...directContenteditableProps,
    };
    const hook = useTypaiContenteditable({
      elementRef,
      typai,
      completion,
      completionMode,
      autocorrect,
      spellcheck,
      settings,
      onDecision,
      onCorrection,
      onMark,
      onMarkRemoved,
      onPopover,
      onProtectedSkip,
      onSettingsChange,
      onTextChange,
      onUserAction,
      onCompletionAccepted,
      onCompletionReverted,
    });
    const ref = useComposedRefs<HTMLDivElement>(hook.ref as Ref<HTMLDivElement>, forwardedRef);

    return (
      <div
        {...mergedContenteditableProps}
        ref={ref}
        contentEditable={mergedContenteditableProps.contentEditable ?? true}
        data-typai-react-contenteditable="true"
      />
    );
  },
);
