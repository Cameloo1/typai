import type { TypaiCodeMirrorOptions, TypaiCodeMirrorResolvedOptions } from "./types";

export function resolveTypaiCodeMirrorOptions(
  options: TypaiCodeMirrorOptions,
): TypaiCodeMirrorResolvedOptions {
  return {
    ...options,
    autocorrect: options.autocorrect ?? true,
    spellcheck: options.spellcheck ?? true,
    marks: {
      corrected: options.marks?.corrected ?? true,
      spelling: options.marks?.spelling ?? true,
    },
  };
}
