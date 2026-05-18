import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { isDelimiter } from "@typai/core";
import { openTypaiCodeMirrorPopoverForMark } from "./commands";
import { getCompletedTokenBeforeCursor, isProtectedCodeMirrorToken } from "./protectedContexts";
import {
  addTypaiCodeMirrorMarkEffect,
  addTypaiCodeMirrorTransactionEffect,
  getTypaiCodeMirrorEffectiveOptions,
} from "./state";
import type {
  CodeMirrorTypaiCorrectionTransaction,
  CodeMirrorTypaiCorrectionTrigger,
  CodeMirrorTypaiMark,
  TypaiCodeMirrorResolvedOptions,
} from "./types";

type QueuedCorrection = {
  id: string;
  markId: string;
  documentVersion: number;
  docLengthBefore: number;
  from: number;
  to: number;
  original: string;
  replacement: string;
  selectionHead: number;
  trigger: CodeMirrorTypaiCorrectionTrigger;
  confidence: number;
  reasonCodes: string[];
  createdAt: number;
};

export function createTypaiCodeMirrorPlugin(resolvedOptions: TypaiCodeMirrorResolvedOptions) {
  return ViewPlugin.fromClass(
    class TypaiCodeMirrorPlugin {
      nextMarkId = 1;
      documentVersion = 0;

      update(update: ViewUpdate): void {
        if (!update.docChanged || update.view.composing) {
          return;
        }

        this.documentVersion += 1;

        if (isTypaiGeneratedUpdate(update)) {
          return;
        }

        const selection = update.state.selection.main;

        if (!selection.empty || !isDelimiterBeforeCursor(update.view)) {
          return;
        }

        const token = getCompletedTokenBeforeCursor(update.state.doc, selection.head);

        if (token === null || isProtectedCodeMirrorToken(update.state, token)) {
          return;
        }

        const effectiveOptions = getTypaiCodeMirrorEffectiveOptions(update.state, resolvedOptions);
        const decision = effectiveOptions.typai.checkCompletedToken({ token: token.text });
        const event = {
          token: {
            text: token.text,
            range: token.range,
          },
          decision,
        };

        effectiveOptions.onDecision?.(event);

        if (decision.action === "mark_unresolved") {
          if (!effectiveOptions.spellcheck || !effectiveOptions.marks.spelling) {
            return;
          }

          const mark: CodeMirrorTypaiMark = {
            id: this.createId("red"),
            from: token.range.start,
            to: token.range.end,
            kind: "red_spelling_issue",
            original: decision.original,
            suggestions: decision.suggestions,
            reasonCodes: decision.reasonCodes,
          };

          this.queueMark(update.view, effectiveOptions, mark);
          return;
        }

        if (decision.action === "auto_correct") {
          if (!effectiveOptions.autocorrect) {
            if (effectiveOptions.spellcheck && effectiveOptions.marks.spelling) {
              this.queueMark(update.view, effectiveOptions, {
                id: this.createId("red"),
                from: token.range.start,
                to: token.range.end,
                kind: "red_spelling_issue",
                original: decision.original,
                replacement: decision.replacement,
                suggestions: [decision.replacement],
                reasonCodes: decision.reasonCodes,
              });
            }

            effectiveOptions.onCorrection?.({
              token: {
                text: token.text,
                range: token.range,
              },
              decision,
              applied: false,
              reason: "autocorrect_disabled",
            });
            return;
          }

          this.queueCorrection(update.view, effectiveOptions, {
            id: this.createId("tx"),
            markId: this.createId("blue"),
            documentVersion: this.documentVersion,
            docLengthBefore: update.state.doc.length,
            from: token.range.start,
            to: token.range.end,
            original: token.text,
            replacement: decision.replacement,
            selectionHead: selection.head,
            trigger: getTriggerBeforeCursor(update.view),
            confidence: decision.confidence,
            reasonCodes: decision.reasonCodes,
            createdAt: Date.now(),
          });
        }
      }

      createId(prefix: string): string {
        const id = `typai-cm-${prefix}-${this.nextMarkId}`;

        this.nextMarkId += 1;

        return id;
      }

      queueMark(
        view: EditorView,
        options: TypaiCodeMirrorResolvedOptions,
        mark: CodeMirrorTypaiMark,
      ): void {
        queueMicrotask(() => {
          if (view.state.doc.sliceString(mark.from, mark.to) !== mark.original) {
            return;
          }

          view.dispatch({
            effects: addTypaiCodeMirrorMarkEffect.of(mark),
          });
          options.onMark?.(mark);
        });
      }

      queueCorrection(
        view: EditorView,
        options: TypaiCodeMirrorResolvedOptions,
        correction: QueuedCorrection,
      ): void {
        queueMicrotask(() => {
          const selection = view.state.selection.main;

          if (
            this.documentVersion !== correction.documentVersion ||
            view.state.doc.length !== correction.docLengthBefore ||
            !selection.empty ||
            selection.head !== correction.selectionHead ||
            view.state.doc.sliceString(correction.from, correction.to) !== correction.original
          ) {
            return;
          }

          const rangeAfter = {
            from: correction.from,
            to: correction.from + correction.replacement.length,
            text: correction.replacement,
          };
          const transaction: CodeMirrorTypaiCorrectionTransaction = {
            id: correction.id,
            markId: correction.markId,
            documentVersion: correction.documentVersion,
            docLengthBefore: correction.docLengthBefore,
            rangeBefore: {
              from: correction.from,
              to: correction.to,
              text: correction.original,
            },
            rangeAfter,
            original: correction.original,
            replacement: correction.replacement,
            trigger: correction.trigger,
            confidence: correction.confidence,
            reasonCodes: correction.reasonCodes,
            createdAt: correction.createdAt,
          };
          const mark: CodeMirrorTypaiMark = {
            id: correction.markId,
            from: rangeAfter.from,
            to: rangeAfter.to,
            kind: "blue_applied_correction",
            original: correction.original,
            replacement: correction.replacement,
            reasonCodes: correction.reasonCodes,
          };
          const selectionHead =
            correction.selectionHead + correction.replacement.length - correction.original.length;

          view.dispatch({
            changes: {
              from: correction.from,
              to: correction.to,
              insert: correction.replacement,
            },
            selection: {
              anchor: selectionHead,
            },
            effects: [
              addTypaiCodeMirrorMarkEffect.of(mark),
              addTypaiCodeMirrorTransactionEffect.of(transaction),
            ],
            userEvent: "input.typai.correct",
          });
          options.onCorrection?.({
            token: {
              text: correction.original,
              range: {
                start: correction.from,
                end: correction.to,
              },
            },
            decision: {
              action: "auto_correct",
              original: correction.original,
              replacement: correction.replacement,
              confidence: correction.confidence,
              mark: "blue_applied_correction",
              reasonCodes: correction.reasonCodes,
            },
            applied: true,
            reason: "applied",
            transaction,
          });
          options.onMark?.(mark);
        });
      }
    },
    {
      eventHandlers: {
        click(event, view) {
          const markId = getTypaiMarkIdFromEventTarget(event.target);

          if (markId === null) {
            return false;
          }

          return openTypaiCodeMirrorPopoverForMark(view, markId);
        },
        keydown(event, view) {
          if (event.key !== "Enter" && event.key !== " ") {
            return false;
          }

          const markId = getTypaiMarkIdFromEventTarget(event.target);

          if (markId === null) {
            return false;
          }

          event.preventDefault();
          event.stopPropagation();

          return openTypaiCodeMirrorPopoverForMark(view, markId);
        },
      },
    },
  );
}

function isDelimiterBeforeCursor(view: EditorView): boolean {
  const head = view.state.selection.main.head;

  if (head === 0) {
    return false;
  }

  return isDelimiter(view.state.doc.sliceString(head - 1, head));
}

function isTypaiGeneratedUpdate(update: ViewUpdate): boolean {
  return update.transactions.some(
    (transaction) =>
      transaction.isUserEvent("input.typai.correct") ||
      transaction.isUserEvent("input.typai.suggestion") ||
      transaction.isUserEvent("input.typai.revert"),
  );
}

function getTriggerBeforeCursor(view: EditorView): CodeMirrorTypaiCorrectionTrigger {
  const head = view.state.selection.main.head;

  if (head === 0) {
    return "punctuation";
  }

  const delimiter = view.state.doc.sliceString(head - 1, head);

  if (delimiter === "\n") {
    return "newline";
  }

  if (delimiter === " " || delimiter === "\t") {
    return "space";
  }

  return "punctuation";
}

function getTypaiMarkIdFromEventTarget(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest<HTMLElement>("[data-typai-cm-mark-id]")?.dataset.typaiCmMarkId ?? null;
}
