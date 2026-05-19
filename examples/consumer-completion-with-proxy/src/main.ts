import {
  createContenteditableCompletionController,
  createEndpointCompletionProvider,
  createRemoteCompletion,
} from "@typai/completion-remote";
import { attachContenteditable } from "@typai/contenteditable";
import { createTypaiCore } from "@typai/core";

import "./style.css";

const endpoint =
  import.meta.env.VITE_TYPAI_COMPLETION_ENDPOINT ?? "http://localhost:8787/api/typai/completion";
const editor = document.querySelector<HTMLElement>("#editor");
const log = document.querySelector<HTMLPreElement>("#log");

if (editor === null || log === null) {
  throw new Error("Missing completion proxy example elements.");
}

const typai = await createTypaiCore();
const provider = createEndpointCompletionProvider({
  endpoint,
  timeoutMs: 2500,
});
const remote = createRemoteCompletion({
  provider,
  debounceMs: 250,
  minPrefixChars: 12,
  maxCompletionChars: 160,
});
const completion = createContenteditableCompletionController({
  remote,
  mode: "prose",
});
const unsubscribeMetrics = remote.subscribeMetrics((event) => {
  log.textContent = `Completion event: ${event.type}`;
});
const detach = attachContenteditable({
  element: editor,
  typai,
  completion,
  completionMode: "prose",
  onCompletionAccepted(transaction) {
    log.textContent = `Accepted completion from ${transaction.providerName ?? "endpoint"}.`;
  },
  onCompletionReverted(transaction) {
    log.textContent = `Reverted completion ${transaction.id}.`;
  },
});
const disconnectCompletion = completion.connectEditor(detach);

log.textContent = `Typai is ready. Completion endpoint: ${endpoint}`;
window.addEventListener("beforeunload", () => {
  disconnectCompletion();
  unsubscribeMetrics();
  completion.destroy();
  detach();
});
