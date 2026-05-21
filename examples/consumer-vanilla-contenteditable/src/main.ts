import { attachContenteditable } from "@typai/contenteditable";
import { createTypaiCore } from "@typai/core";

import "./style.css";

const editor = document.querySelector<HTMLElement>("#editor");
const log = document.querySelector<HTMLPreElement>("#log");

if (editor === null || log === null) {
  throw new Error("Missing contenteditable example elements.");
}

const typai = await createTypaiCore();
const detach = attachContenteditable({
  element: editor,
  typai,
  onCorrection(transaction) {
    log.textContent = `Corrected "${transaction.original}" to "${transaction.replacement}".`;
  },
  onMark(mark) {
    log.textContent = `Marked "${mark.text}" as ${mark.kind}.`;
  },
  onProtectedSkip(token) {
    log.textContent = `Skipped protected token "${token.text}".`;
  },
});

log.textContent = "Typai is attached locally. No server or provider key is used.";
window.addEventListener("beforeunload", detach);
