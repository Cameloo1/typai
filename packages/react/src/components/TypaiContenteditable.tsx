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
