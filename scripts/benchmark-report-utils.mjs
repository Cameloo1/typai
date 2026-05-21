export function summarizeLatencies(samples) {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample >= 0)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
    };
  }

  const total = sorted.reduce((sum, sample) => sum + sample, 0);

  return {
    count: sorted.length,
    mean: total / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.at(-1) ?? 0,
  };
}

export function percentile(sortedSamples, value) {
  const index = Math.ceil((sortedSamples.length * value) / 100) - 1;

  return sortedSamples[Math.max(0, Math.min(sortedSamples.length - 1, index))] ?? 0;
}

export function classifyThreshold(value, thresholds) {
  if (!Number.isFinite(value)) {
    return "fail";
  }

  if (value > thresholds.fail) {
    return "fail";
  }

  if (value > thresholds.warn) {
    return "warn";
  }

  return "pass";
}

export function createMachineReadableLine(prefix, payload) {
  return `${prefix}: ${JSON.stringify(payload)}`;
}

export function parseMachineReadableLine(prefix, line) {
  const expectedPrefix = `${prefix}: `;

  if (!line.startsWith(expectedPrefix)) {
    throw new Error(`Expected ${expectedPrefix} prefix.`);
  }

  return JSON.parse(line.slice(expectedPrefix.length));
}

export function formatMs(value) {
  return `${value.toFixed(4)} ms`;
}

export function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KiB`;
  }

  return `${value} B`;
}
