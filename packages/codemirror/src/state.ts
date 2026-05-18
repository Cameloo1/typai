import {
  type EditorState,
  Facet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Text,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import {
  collectTypaiCompletionGhosts,
  collectTypaiMarks,
  createGhostTextDecoration,
  createMarkDecoration,
  getTypaiMarkFromDecoration,
} from "./decorations";
import type {
  CodeMirrorCompletionGhost,
  CodeMirrorTypaiCorrectionTransaction,
  CodeMirrorTypaiMark,
  TypaiCodeMirrorResolvedOptions,
} from "./types";

export type TypaiCodeMirrorRuntimeSettings = {
  autocorrect?: boolean;
  spellcheck?: boolean;
};

export const addTypaiCodeMirrorMarkEffect = StateEffect.define<CodeMirrorTypaiMark>();
export const removeTypaiCodeMirrorMarkEffect = StateEffect.define<string>();
export const clearTypaiCodeMirrorMarksEffect = StateEffect.define<void>();
export const addTypaiCodeMirrorTransactionEffect =
  StateEffect.define<CodeMirrorTypaiCorrectionTransaction>();
export const clearTypaiCodeMirrorTransactionsEffect = StateEffect.define<void>();
export const setTypaiCodeMirrorGhostTextEffect = StateEffect.define<CodeMirrorCompletionGhost>();
export const clearTypaiCodeMirrorGhostTextEffect = StateEffect.define<void>();
export const setTypaiCodeMirrorRuntimeSettingsEffect =
  StateEffect.define<TypaiCodeMirrorRuntimeSettings>();

export const typaiCodeMirrorOptionsFacet = Facet.define<
  TypaiCodeMirrorResolvedOptions,
  TypaiCodeMirrorResolvedOptions | null
>({
  combine(values) {
    return values.at(-1) ?? null;
  },
});

export const typaiCodeMirrorRuntimeSettingsField =
  StateField.define<TypaiCodeMirrorRuntimeSettings>({
    create() {
      return {};
    },
    update(settings, transaction) {
      let nextSettings = settings;

      for (const effect of transaction.effects) {
        if (effect.is(setTypaiCodeMirrorRuntimeSettingsEffect)) {
          nextSettings = {
            ...nextSettings,
            ...effect.value,
          };
        }
      }

      return nextSettings;
    },
  });

export const typaiCodeMirrorMarksField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    let nextDecorations = decorations.map(transaction.changes);

    if (transaction.docChanged) {
      nextDecorations = nextDecorations.update({
        filter: (from, to, decoration) =>
          decorationStillMatches(transaction.newDoc, from, to, decoration),
      });
    }

    for (const effect of transaction.effects) {
      if (effect.is(clearTypaiCodeMirrorMarksEffect)) {
        nextDecorations = Decoration.none;
        continue;
      }

      if (effect.is(removeTypaiCodeMirrorMarkEffect)) {
        const markId = effect.value;

        nextDecorations = nextDecorations.update({
          filter: (_from, _to, decoration) => getTypaiMarkFromDecoration(decoration)?.id !== markId,
        });
        continue;
      }

      if (effect.is(addTypaiCodeMirrorMarkEffect)) {
        const mark = effect.value;
        const decoration = createMarkDecoration(mark);

        nextDecorations = nextDecorations.update({
          filter: (from, to) => to <= mark.from || from >= mark.to,
          add: [decoration.range(mark.from, mark.to)],
        });
      }
    }

    return nextDecorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const typaiCodeMirrorTransactionsField = StateField.define<
  CodeMirrorTypaiCorrectionTransaction[]
>({
  create() {
    return [];
  },
  update(transactions, transaction) {
    let nextTransactions = transactions;

    for (const effect of transaction.effects) {
      if (effect.is(clearTypaiCodeMirrorTransactionsEffect)) {
        nextTransactions = [];
        continue;
      }

      if (effect.is(addTypaiCodeMirrorTransactionEffect)) {
        nextTransactions = [...nextTransactions, effect.value];
      }
    }

    return nextTransactions;
  },
});

export const typaiCodeMirrorGhostTextField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    let nextDecorations = transaction.docChanged
      ? Decoration.none
      : decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (effect.is(clearTypaiCodeMirrorGhostTextEffect)) {
        nextDecorations = Decoration.none;
        continue;
      }

      if (effect.is(setTypaiCodeMirrorGhostTextEffect)) {
        const ghost = effect.value;

        if (
          ghost.text.length === 0 ||
          ghost.from < 0 ||
          ghost.from > transaction.state.doc.length
        ) {
          nextDecorations = Decoration.none;
          continue;
        }

        nextDecorations = Decoration.set([createGhostTextDecoration(ghost).range(ghost.from)]);
      }
    }

    return nextDecorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export function getTypaiCodeMirrorMarks(state: {
  field<T>(field: StateField<T>): T;
}): CodeMirrorTypaiMark[] {
  return collectTypaiMarks(state.field(typaiCodeMirrorMarksField));
}

export function getTypaiCodeMirrorTransactions(state: {
  field<T>(field: StateField<T>): T;
}): CodeMirrorTypaiCorrectionTransaction[] {
  return state.field(typaiCodeMirrorTransactionsField);
}

export function getTypaiCodeMirrorGhostText(state: {
  field<T>(field: StateField<T>, require?: boolean): T;
}): CodeMirrorCompletionGhost | null {
  const decorations = state.field(typaiCodeMirrorGhostTextField, false);

  if (decorations === undefined) {
    return null;
  }

  return collectTypaiCompletionGhosts(decorations)[0] ?? null;
}

export function getTypaiCodeMirrorOptions(
  state: EditorState,
): TypaiCodeMirrorResolvedOptions | null {
  return state.facet(typaiCodeMirrorOptionsFacet);
}

export function getTypaiCodeMirrorRuntimeSettings(
  state: EditorState,
): TypaiCodeMirrorRuntimeSettings {
  return state.field(typaiCodeMirrorRuntimeSettingsField, false) ?? {};
}

export function getTypaiCodeMirrorEffectiveOptions(
  state: EditorState,
  options: TypaiCodeMirrorResolvedOptions,
): TypaiCodeMirrorResolvedOptions {
  const runtimeSettings = getTypaiCodeMirrorRuntimeSettings(state);

  return {
    ...options,
    autocorrect: runtimeSettings.autocorrect ?? options.autocorrect,
    spellcheck: runtimeSettings.spellcheck ?? options.spellcheck,
  };
}

export function createTypaiMarkSet(marks: CodeMirrorTypaiMark[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const mark of marks) {
    builder.add(mark.from, mark.to, createMarkDecoration(mark));
  }

  return builder.finish();
}

function decorationStillMatches(
  doc: Text,
  from: number,
  to: number,
  decoration: Decoration,
): boolean {
  const mark = getTypaiMarkFromDecoration(decoration);

  if (mark === null || from < 0 || to > doc.length || from >= to) {
    return false;
  }

  const currentText = doc.sliceString(from, to);

  if (mark.kind === "red_spelling_issue") {
    return currentText === mark.original;
  }

  if (mark.kind === "blue_applied_correction") {
    return currentText === mark.replacement;
  }

  return false;
}
