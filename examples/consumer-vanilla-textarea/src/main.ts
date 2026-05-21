import { createTypaiCore } from "@typai/core";
import { attachTextarea } from "@typai/textarea";

import "./style.css";

const textarea = document.querySelector<HTMLTextAreaElement>("#editor");
const log = document.querySelector<HTMLPreElement>("#log");

if (textarea === null || log === null) {
  throw new Error("Missing textarea example elements.");
}

const typai = await createTypaiCore();
const detach = attachTextarea({
  textarea,
  typai,
  overlay: {
    enabled: true,
  },
  onCorrection(event) {
    log.textContent = `Corrected "${event.transaction.original}" to "${event.transaction.replacement}".`;
  },
  onMark(event) {
    log.textContent = `Marked "${event.mark.text}" as ${event.mark.kind}.`;
  },
  onProtectedSkip(event) {
    log.textContent = `Skipped protected token "${event.token.text}".`;
  },
});

log.textContent = "Typai is attached locally with the textarea overlay enabled.";
window.addEventListener("beforeunload", detach);
