import { type CompletionContextOptions, extractCompletionContext } from "./context";
import {
  type CompletionDismissReason,
  createRemoteCompletion,
  type RemoteCompletionController,
  type RemoteCompletionOptions,
} from "./scheduler";
import type { CompletionMode } from "./types";

export type ContenteditableCompletionEditorSnapshot = {
  text: string;
  version: number;
  selection: {
    start: number;
    end: number;
  };
  isComposingIME: boolean;
  mode?: CompletionMode;
};

export type ContenteditableCompletionGhostMetadata = {
  requestId?: string;
  providerName?: string;
  model?: string;
  latencyMs?: number;
};

export type ContenteditableCompletionTransaction = {
  id: string;
  requestId: string;
  editorVersion: number;
  rangeBefore: {
    start: number;
    end: number;
    text: string;
  };
  rangeAfter: {
    start: number;
    end: number;
    text: string;
  };
  insertedText: string;
  createdAt: number;
  providerName?: string;
  model?: string;
  latencyMs?: number;
};

export type ContenteditableGhostTextEditor = {
  renderGhostTextAtCaret(
    text: string,
    requestSnapshot?: ContenteditableCompletionEditorSnapshot,
    metadata?: ContenteditableCompletionGhostMetadata,
  ): void;
  clearGhostText?(reason?: CompletionDismissReason): void;
  isGhostTextVisible?(): boolean;
  getSnapshot?(): ContenteditableCompletionEditorSnapshot;
};

export type ContenteditableRemoteCompletionController = {
  remote: RemoteCompletionController;
  connectEditor(editor: ContenteditableGhostTextEditor): () => void;
  onEditorInput(snapshot: ContenteditableCompletionEditorSnapshot): void;
  onEditorSelectionChange(snapshot: ContenteditableCompletionEditorSnapshot): void;
  onEditorBlur(): void;
  onEditorCompositionStart(): void;
  onCorrectionTransaction(): void;
  onGhostTextAccept(
    snapshot: ContenteditableCompletionEditorSnapshot,
    transaction?: ContenteditableCompletionTransaction,
  ): void;
  onGhostTextDismiss(
    reason: CompletionDismissReason,
    snapshot: ContenteditableCompletionEditorSnapshot,
  ): void;
  onCompletionReverted(transaction: ContenteditableCompletionTransaction): void;
  destroy(): void;
};

export type CreateContenteditableCompletionControllerOptions = RemoteCompletionOptions & {
  remote?: RemoteCompletionController;
  mode?: CompletionMode;
  context?: CompletionContextOptions;
};

export function createContenteditableCompletionController(
  options: CreateContenteditableCompletionControllerOptions = {},
): ContenteditableRemoteCompletionController {
  const remote = options.remote ?? createRemoteCompletion(options);
  const mode = options.mode ?? "prose";
  const contextOptions = options.context;

  let editor: ContenteditableGhostTextEditor | null = null;
  let lastSnapshot: ContenteditableCompletionEditorSnapshot | null = null;

  const unsubscribe = remote.subscribe((event) => {
    if (event.type !== "ghost_shown" || event.state.status !== "showing") {
      return;
    }

    const renderSnapshot = lastSnapshot ?? editor?.getSnapshot?.() ?? null;

    if (renderSnapshot === null) {
      return;
    }

    editor?.renderGhostTextAtCaret(event.state.text, renderSnapshot, {
      requestId: event.requestId,
      providerName: event.providerName,
      model: event.model,
      latencyMs: event.latencyMs,
    });
  });

  return {
    remote,
    connectEditor(nextEditor) {
      editor = nextEditor;

      return () => {
        if (editor === nextEditor) {
          editor = null;
        }
      };
    },
    onEditorInput(snapshot) {
      lastSnapshot = snapshot;

      if (snapshot.isComposingIME || snapshot.selection.start !== snapshot.selection.end) {
        remote.dismiss(snapshot.isComposingIME ? "composition" : "selection_change");
        return;
      }

      remote.schedule({
        ...extractCompletionContext({
          fullText: snapshot.text,
          cursorOffset: snapshot.selection.end,
          selection: snapshot.selection,
          mode: snapshot.mode ?? mode,
          options: contextOptions,
        }),
        surface: "contenteditable",
      });
    },
    onEditorSelectionChange(snapshot) {
      if (
        lastSnapshot !== null &&
        lastSnapshot.version === snapshot.version &&
        lastSnapshot.selection.start === snapshot.selection.start &&
        lastSnapshot.selection.end === snapshot.selection.end
      ) {
        return;
      }

      lastSnapshot = snapshot;
      remote.dismiss("selection_change");
    },
    onEditorBlur() {
      remote.dismiss("blur");
    },
    onEditorCompositionStart() {
      remote.dismiss("composition");
    },
    onCorrectionTransaction() {
      remote.dismiss("correction_transaction");
    },
    onGhostTextAccept(snapshot) {
      lastSnapshot = snapshot;
      remote.accept();
    },
    onGhostTextDismiss(reason, snapshot) {
      lastSnapshot = snapshot;
      remote.dismiss(reason);
    },
    onCompletionReverted(transaction) {
      remote.revert(transaction.requestId);
    },
    destroy() {
      unsubscribe();
      editor = null;
      remote.destroy();
    },
  };
}
