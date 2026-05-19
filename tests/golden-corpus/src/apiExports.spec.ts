import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const packageEntrypoints = {
  "@typai/core": "packages/core/src/index.ts",
  "@typai/contenteditable": "packages/contenteditable/src/index.ts",
  "@typai/textarea": "packages/textarea/src/index.ts",
  "@typai/react": "packages/react/src/index.ts",
  "@typai/codemirror": "packages/codemirror/src/index.ts",
  "@typai/completion-remote": "packages/completion-remote/src/index.ts",
  "@typai/provider-proxy-testkit": "packages/provider-proxy-testkit/src/index.ts",
  "@typai/ui": "packages/ui/src/index.ts",
  "@typai/adapter-testkit": "packages/adapter-testkit/src/index.ts",
} as const;

const expectedExports = {
  "@typai/core": [
    "CheckCompletedTokenInput",
    "CorrectionAction",
    "CorrectionDecision",
    "CorrectionMark",
    "CorrectionRule",
    "CorrectionRuleStatus",
    "CreateIndexedDbStorageOptions",
    "CreateTypaiCoreOptions",
    "ImportTypaiMemoryOptions",
    "PersonalDictionaryEntry",
    "ResetTypaiMemoryOptions",
    "SuggestTokenInput",
    "SuggestTokenResult",
    "TYPAI_CORE_VERSION",
    "Token",
    "TokenType",
    "TypaiCore",
    "TypaiDictionaryLoadResult",
    "TypaiDictionaryLoadSource",
    "TypaiLanguage",
    "TypaiMemoryExport",
    "TypaiRange",
    "TypaiStorage",
    "classifyToken",
    "createIndexedDbStorage",
    "createMemoryStorage",
    "createTypaiCore",
    "getTokenBeforeOffset",
    "isDelimiter",
    "isProtectedTokenText",
  ],
  "@typai/contenteditable": [
    "AttachContenteditableOptions",
    "BlueCorrectionPopover",
    "CompletionEditorSnapshot",
    "CompletionGhostMetadata",
    "CompletionRevertResult",
    "CompletionTransaction",
    "ContenteditableCompletionController",
    "ContenteditableCompletionMode",
    "ContenteditableSnapshot",
    "CorrectionTransaction",
    "CorrectionTrigger",
    "DetachContenteditable",
    "DomTextPosition",
    "GhostTextClearReason",
    "PopoverActionResult",
    "RangeStillMatchesInput",
    "RedSpellingPopover",
    "TYPAI_CONTENTEDITABLE_VERSION",
    "TypaiPopover",
    "TypaiSettings",
    "TypaiTextChange",
    "TypaiUserAction",
    "VisualMark",
    "attachContenteditable",
    "domRangeToPlainTextRange",
    "plainTextOffsetToDomPosition",
    "plainTextRangeToDomRange",
    "rangeStillMatches",
  ],
  "@typai/textarea": [
    "AttachTextareaOptions",
    "DetachTextarea",
    "TYPAI_TEXTAREA_VERSION",
    "TextareaAdapterSettings",
    "TextareaCompletionAcceptResult",
    "TextareaCompletionController",
    "TextareaCompletionDismissEvent",
    "TextareaCompletionEvent",
    "TextareaCompletionMode",
    "TextareaCompletionRenderMetadata",
    "TextareaCompletionRevertResult",
    "TextareaCompletionSnapshot",
    "TextareaCompletionTransaction",
    "TextareaCorrectionEvent",
    "TextareaCorrectionRevertResult",
    "TextareaCorrectionTransaction",
    "TextareaDecisionEvent",
    "TextareaGhostTextClearReason",
    "TextareaMark",
    "TextareaMarkEvent",
    "TextareaMarkRemovedEvent",
    "TextareaOverlayMode",
    "TextareaPopoverActionResult",
    "TextareaProtectedSkipEvent",
    "TextareaRange",
    "TextareaSnapshot",
    "attachTextarea",
    "clampTextareaRange",
    "getCompletedTokenBeforeSelection",
    "getTextareaRangeText",
    "getTextareaSnapshot",
    "isTextareaDelimiterInput",
    "rangeStillMatches",
  ],
  "@typai/react": [
    "TypaiAdapterDebugState",
    "TypaiAdapterHookStatus",
    "TypaiCompletionContextValue",
    "TypaiContenteditable",
    "TypaiContenteditableCompletionController",
    "TypaiContenteditableHookOptions",
    "TypaiContenteditableHookResult",
    "TypaiContenteditableProps",
    "TypaiCoreContextValue",
    "TypaiCoreFactory",
    "TypaiCoreStatus",
    "TypaiDebugTable",
    "TypaiDebugTableProps",
    "TypaiNativeContenteditableProps",
    "TypaiNativeTextareaProps",
    "TypaiProvider",
    "TypaiProviderProps",
    "TypaiSettingsPanel",
    "TypaiSettingsPanelProps",
    "TypaiTextarea",
    "TypaiTextareaCompletionController",
    "TypaiTextareaHookOptions",
    "TypaiTextareaHookResult",
    "TypaiTextareaProps",
    "useTypaiContenteditable",
    "useTypaiCore",
    "useTypaiTextarea",
  ],
  "@typai/codemirror": [
    "CodeMirrorCompletionController",
    "CodeMirrorCompletionEditor",
    "CodeMirrorCompletionGhost",
    "CodeMirrorCompletionGhostMetadata",
    "CodeMirrorCompletionMode",
    "CodeMirrorCompletionSnapshot",
    "CodeMirrorCompletionTransaction",
    "CodeMirrorGhostTextClearReason",
    "CodeMirrorTypaiCorrectionTransaction",
    "CodeMirrorTypaiCorrectionTrigger",
    "CodeMirrorTypaiMark",
    "TypaiCodeMirrorCorrectionEvent",
    "TypaiCodeMirrorDecisionEvent",
    "TypaiCodeMirrorMarkKind",
    "TypaiCodeMirrorOptions",
    "addTypaiCodeMirrorCompletionTransactionEffect",
    "applyFirstTypaiCodeMirrorRedSuggestion",
    "clearTypaiCodeMirrorCompletionTransactionsEffect",
    "clearTypaiCodeMirrorGhostText",
    "clearTypaiCodeMirrorGhostTextEffect",
    "clearTypaiCodeMirrorMarks",
    "closeTypaiCodeMirrorPopover",
    "createTypaiCodeMirrorExtension",
    "getTypaiCodeMirrorCompletionTransactions",
    "getTypaiCodeMirrorGhostText",
    "getTypaiCodeMirrorGhostTextContent",
    "getTypaiCodeMirrorMarks",
    "getTypaiCodeMirrorOptions",
    "getTypaiCodeMirrorRuntimeSettings",
    "getTypaiCodeMirrorTransactions",
    "getTypaiCodeMirrorViewCompletionTransactions",
    "getTypaiCodeMirrorViewMarks",
    "getTypaiCodeMirrorViewTransactions",
    "ignoreFirstTypaiCodeMirrorRedMark",
    "isTypaiCodeMirrorGhostTextVisible",
    "openFirstTypaiCodeMirrorBluePopover",
    "openFirstTypaiCodeMirrorRedPopover",
    "openTypaiCodeMirrorPopoverForMark",
    "renderTypaiCodeMirrorGhostText",
    "revertFirstTypaiCodeMirrorCorrection",
    "revertLastTypaiCodeMirrorCompletion",
    "revertSelectedTypaiCodeMirrorCorrection",
    "revertTypaiCodeMirrorCompletion",
    "setTypaiCodeMirrorGhostTextEffect",
    "setTypaiCodeMirrorRuntimeSettingsEffect",
    "typaiCodeMirrorBlueCorrectedClass",
    "typaiCodeMirrorCompletionTransactionsField",
    "typaiCodeMirrorGhostTextClass",
    "typaiCodeMirrorGhostTextField",
    "typaiCodeMirrorMarksField",
    "typaiCodeMirrorOptionsFacet",
    "typaiCodeMirrorRedSpellingClass",
    "typaiCodeMirrorRuntimeSettingsField",
    "typaiCodeMirrorTransactionsField",
  ],
  "@typai/completion-remote": [
    "COMPLETION_METRIC_EVENT_TYPES",
    "CompletionContextHook",
    "CompletionContextOptions",
    "CompletionDelta",
    "CompletionDismissReason",
    "CompletionEvent",
    "CompletionEventType",
    "CompletionInstruction",
    "CompletionMetricEvent",
    "CompletionMetricEventType",
    "CompletionMetricsListener",
    "CompletionMetricsSink",
    "CompletionMetricsSnapshot",
    "CompletionMetricsStore",
    "CompletionMode",
    "CompletionProvider",
    "CompletionProviderError",
    "CompletionProviderErrorKind",
    "CompletionProviderFailure",
    "CompletionProviderOptions",
    "CompletionRequest",
    "CompletionRequestBudget",
    "CompletionResponse",
    "CompletionScheduleInput",
    "CompletionState",
    "ContenteditableCompletionEditorSnapshot",
    "ContenteditableCompletionGhostMetadata",
    "ContenteditableCompletionTransaction",
    "ContenteditableGhostTextEditor",
    "ContenteditableRemoteCompletionController",
    "CreateCompletionRequestInput",
    "CreateContenteditableCompletionControllerOptions",
    "DEFAULT_COMPLETION_CONSTRAINTS",
    "DEFAULT_COMPLETION_METRICS_MAX_EVENTS",
    "DEFAULT_CONTEXT_AFTER_CHARS",
    "DEFAULT_CONTEXT_BEFORE_CHARS",
    "DEFAULT_MAX_COMPLETION_CHARS",
    "DEFAULT_REMOTE_COMPLETION_OPTIONS",
    "EndpointCompletionPayload",
    "EndpointCompletionProviderError",
    "EndpointCompletionProviderErrorCode",
    "EndpointCompletionProviderOptions",
    "ExtractCompletionContextInput",
    "MemoryMetricsSinkOptions",
    "MockCompletionResolver",
    "MockStreamingCompletionProviderOptions",
    "RemoteCompletionController",
    "RemoteCompletionOptions",
    "RemoteCompletionStreamingOptions",
    "SanitizeCompletionInput",
    "SanitizeCompletionOptions",
    "buildContinuationInstruction",
    "buildEndpointPayload",
    "createCompletionRequest",
    "createContenteditableCompletionController",
    "createDefaultCompletionInstruction",
    "createEndpointCompletionProvider",
    "createMemoryMetricsSink",
    "createMockCompletionProvider",
    "createMockStreamingCompletionProvider",
    "createNoopCompletionProvider",
    "createRemoteCompletion",
    "extractCompletionContext",
    "getSafeCompletionProviderErrorMessage",
    "idleCompletionState",
    "inferCurrentLine",
    "isActiveCompletionState",
    "normalizeCompletionProviderError",
    "sanitizeCompletionText",
    "trimDuplicateCompletionPrefix",
  ],
  "@typai/provider-proxy-testkit": [
    "CompletionProxyResponseBody",
    "DEFAULT_PROVIDER_PROXY_LIMITS",
    "PROVIDER_PROXY_ALLOWED_MODES",
    "ProviderProxyContractOptions",
    "ProviderProxyContractRequest",
    "ProviderProxyContractResponse",
    "ProviderProxyContractScenario",
    "ProviderProxyErrorResponse",
    "ProviderProxyLimits",
    "ProviderProxyPayload",
    "ProviderProxyRequestValidationInput",
    "ProviderProxySafeError",
    "ProviderProxySafeErrorCode",
    "ProviderProxyValidationOptions",
    "ProviderProxyValidationResult",
    "createSafeErrorResponse",
    "defaultSafeErrorMessages",
    "getSafeErrorStatus",
    "invalidModeRequest",
    "isProviderProxyCompletionResponse",
    "isProviderProxyErrorResponse",
    "isProviderProxyPayload",
    "malformedJsonBody",
    "mapProviderErrorToSafeError",
    "mapUnknownErrorToSafeError",
    "mergeProviderProxyLimits",
    "mockCompletionResponse",
    "oversizedContextAfterRequest",
    "oversizedContextBeforeRequest",
    "oversizedContextRequest",
    "providerFailureSentinel",
    "rawContextSentinel",
    "runProviderProxyContractSuite",
    "secretLikeApiKey",
    "validCompletionPayload",
    "validCompletionRequest",
    "validateCompletionProxyRequest",
    "validateCompletionRequestBody",
  ],
  "@typai/ui": [
    "CorrectionPopoverActions",
    "CorrectionPopoverData",
    "CorrectionPopoverOptions",
    "CreateDebugTableOptions",
    "CreatePopoverOptions",
    "CreateSettingsPanelOptions",
    "SpellingPopoverActions",
    "SpellingPopoverData",
    "SpellingPopoverOptions",
    "TypaiDebugTableHandle",
    "TypaiLiveRegion",
    "TypaiLiveRegionOptions",
    "TypaiPopoverHandle",
    "TypaiSettingsPanelHandle",
    "TypaiSuggestionAction",
    "TypaiUiAction",
    "TypaiUiActionResult",
    "TypaiUiDebugData",
    "TypaiUiDebugEvent",
    "TypaiUiSettings",
    "TypaiUiSettingsChange",
    "createCorrectionPopover",
    "createDebugTable",
    "createEscapeKeyHandler",
    "createPopover",
    "createSettingsPanel",
    "createSpellingPopover",
    "createTypaiLiveRegion",
    "createTypaiUiStyleElement",
    "ensureTypaiUiStyles",
    "focusFirstAction",
    "restoreFocus",
    "typaiUiStyles",
  ],
  "@typai/adapter-testkit": [
    "AdapterConformanceCapabilities",
    "AdapterConformanceDriver",
    "AdapterConformanceDriverFactory",
    "AdapterConformanceOptions",
    "AdapterCorrectionTransaction",
    "AdapterMark",
    "AdapterRange",
    "AdapterSnapshot",
    "COMPLETION_CONFORMANCE_FIXTURES",
    "CompletionConformanceCapabilities",
    "CompletionConformanceDriver",
    "CompletionConformanceDriverFactory",
    "CompletionConformanceOptions",
    "CompletionConformanceSkipReasons",
    "CompletionCorrectionMarkProbe",
    "CompletionCorrectionTransactionProbe",
    "TypaiAdapterKind",
    "conformanceDecisionForToken",
    "createConformanceTypaiCore",
    "expectBlueMark",
    "expectNoBlueMarks",
    "expectNoTransactions",
    "expectPlainSourceText",
    "expectRedMark",
    "runAdapterConformanceSuite",
    "runCompletionConformanceSuite",
    "waitForCompletionCondition",
  ],
} satisfies Record<keyof typeof packageEntrypoints, string[]>;

describe("API export snapshots", () => {
  for (const [packageName, entrypoint] of Object.entries(packageEntrypoints)) {
    it(`${packageName} exports only intentional API names`, () => {
      const actual = collectExports(path.join(repoRoot, entrypoint));

      expect(actual).toEqual(expectedExports[packageName as keyof typeof expectedExports]);
    });
  }
});

function collectExports(entrypoint: string, seen = new Set<string>()): string[] {
  const absoluteEntrypoint = path.resolve(entrypoint);

  if (seen.has(absoluteEntrypoint)) {
    return [];
  }

  seen.add(absoluteEntrypoint);

  const source = ts.createSourceFile(
    absoluteEntrypoint,
    readFileSync(absoluteEntrypoint, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    sourceKindForPath(absoluteEntrypoint),
  );
  const names = new Set<string>();

  for (const statement of source.statements) {
    if (isExportedDeclaration(statement)) {
      collectExportedDeclarationNames(statement, names);
    }

    if (!ts.isExportDeclaration(statement)) {
      continue;
    }

    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        names.add(element.name.text);
      }
      continue;
    }

    if (!statement.exportClause && statement.moduleSpecifier) {
      const nestedEntrypoint = resolveRelativeModule(absoluteEntrypoint, statement.moduleSpecifier);

      if (nestedEntrypoint !== null) {
        for (const name of collectExports(nestedEntrypoint, seen)) {
          names.add(name);
        }
      }
    }
  }

  return [...names].sort();
}

function collectExportedDeclarationNames(statement: ts.Statement, names: Set<string>): void {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        names.add(declaration.name.text);
      }
    }
    return;
  }

  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    names.add(statement.name.text);
  }
}

function isExportedDeclaration(statement: ts.Statement): boolean {
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;

  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function resolveRelativeModule(sourcePath: string, moduleSpecifier: ts.Expression): string | null {
  if (!ts.isStringLiteral(moduleSpecifier) || !moduleSpecifier.text.startsWith(".")) {
    return null;
  }

  const basePath = path.resolve(path.dirname(sourcePath), moduleSpecifier.text);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  return candidates.find((candidate) => fileExists(candidate)) ?? null;
}

function fileExists(filePath: string): boolean {
  try {
    readFileSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function sourceKindForPath(filePath: string): ts.ScriptKind {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}
