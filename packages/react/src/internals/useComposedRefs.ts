import type { Ref } from "react";
import { useCallback } from "react";

export function useComposedRefs<T>(firstRef: Ref<T> | undefined, secondRef?: Ref<T>): Ref<T> {
  return useCallback(
    (node: T | null) => {
      for (const ref of [firstRef, secondRef]) {
        if (ref === undefined || ref === null) {
          continue;
        }

        if (typeof ref === "function") {
          ref(node);
          continue;
        }

        ref.current = node;
      }
    },
    [firstRef, secondRef],
  );
}
