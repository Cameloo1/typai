export type TypaiUiDebugEvent = {
  time: string;
  source: string;
  action: string;
  outcome: string;
  reasonCodes?: string[];
  latencyMs?: number;
};

export type TypaiUiDebugData = {
  recentEvents: TypaiUiDebugEvent[];
  correctionCount: number;
  unresolvedCount: number;
  revertCount: number;
  protectedSkipCount: number;
  latenciesMs: number[];
};

export type TypaiDebugTableHandle = {
  element: HTMLElement;
  update(data: TypaiUiDebugData): void;
  destroy(): void;
};
