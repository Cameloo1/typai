import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createTypaiCodeMirrorExtension } from "@typai/codemirror";
import { createTypaiCore } from "@typai/core";

import "./style.css";

const mount = document.querySelector<HTMLElement>("#editor");
const log = document.querySelector<HTMLPreElement>("#log");

if (mount === null || log === null) {
  throw new Error("Missing CodeMirror example elements.");
}

const typai = await createTypaiCore();
const state = EditorState.create({
  doc: "Try typing teh CodeMirror update.\n",
  extensions: [
    markdown(),
    EditorView.lineWrapping,
    createTypaiCodeMirrorExtension({
      typai,
      onCorrection(event) {
        if (event.transaction !== undefined) {
          log.textContent = `Corrected "${event.transaction.original}" to "${event.transaction.replacement}".`;
        }
      },
      onMark(mark) {
        log.textContent = `Marked "${mark.text}" as ${mark.kind}.`;
      },
    }),
  ],
});

const view = new EditorView({
  parent: mount,
  state,
});

log.textContent = "Typai is attached locally to CodeMirror.";
window.addEventListener("beforeunload", () => view.destroy());
