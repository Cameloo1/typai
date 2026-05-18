import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { resolveTypaiCodeMirrorOptions } from "./options";
import { createTypaiCodeMirrorPlugin } from "./plugin";
import {
  typaiCodeMirrorMarksField,
  typaiCodeMirrorOptionsFacet,
  typaiCodeMirrorRuntimeSettingsField,
  typaiCodeMirrorTransactionsField,
} from "./state";
import type { TypaiCodeMirrorOptions } from "./types";

export function createTypaiCodeMirrorExtension(options: TypaiCodeMirrorOptions): Extension {
  const resolvedOptions = resolveTypaiCodeMirrorOptions(options);

  return [
    typaiCodeMirrorOptionsFacet.of(resolvedOptions),
    typaiCodeMirrorRuntimeSettingsField,
    typaiCodeMirrorMarksField,
    typaiCodeMirrorTransactionsField,
    typaiCodeMirrorTheme,
    createTypaiCodeMirrorPlugin(resolvedOptions),
  ];
}

const typaiCodeMirrorTheme = EditorView.baseTheme({
  ".typai-cm-red-spelling": {
    textDecorationLine: "underline",
    textDecorationStyle: "wavy",
    textDecorationColor: "#d92d20",
    textUnderlineOffset: "0.16em",
  },
  ".typai-cm-blue-corrected": {
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textDecorationColor: "#2563eb",
    textUnderlineOffset: "0.16em",
  },
});
