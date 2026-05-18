export interface LatencySummary {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MeasureSyncLatencyOptions {
  iterations?: number;
  warmupIterations?: number;
}

export function measureSyncLatency(
  operation: () => void,
  options: MeasureSyncLatencyOptions = {},
): LatencySummary {
  const iterations = options.iterations ?? 100;
  const warmupIterations = options.warmupIterations ?? 5;
  const samples: number[] = [];

  for (let index = 0; index < warmupIterations; index += 1) {
    operation();
  }

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = now();
    operation();
    samples.push(now() - startedAt);
  }

  return summarizeLatencies(samples);
}

export function summarizeLatencies(samples: readonly number[]): LatencySummary {
  const finiteSamples = samples.filter((sample) => Number.isFinite(sample) && sample >= 0);

  if (finiteSamples.length === 0) {
    return {
      count: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...finiteSamples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, sample) => sum + sample, 0);

  return {
    count: sorted.length,
    mean: total / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sortedSamples: readonly number[], percentileValue: number): number {
  const index = Math.ceil((sortedSamples.length * percentileValue) / 100) - 1;

  return sortedSamples[Math.max(0, Math.min(sortedSamples.length - 1, index))] ?? 0;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
