// GLCI-02: automated legal source monitoring (docs/GLCI_SPECIFICATION.md §2 engine 1).
//
// A monitor adapter reads a target's official listing and returns a fingerprint of what the
// source currently publishes. The database decides first_seen / unchanged / changed by comparing
// fingerprints. Failures are classified, so that an unreachable source and a source whose format
// changed are never mistaken for "nothing changed" (spec §8):
//   unreachable          network failure, timeout, HTTP 429 or 5xx;
//   integration_failure  the source answered, but Njumeni no longer understands the response;
//   failed               anything else.
import { createHash } from 'node:crypto';

export type MonitorFailureClass = 'unreachable' | 'integration_failure' | 'failed';
export interface MonitorTarget {
  targetKey: string;
  jurisdictionCode: string;
  monitorAdapterKey: string | null;
  officialUri: string | null;
  config: Record<string, unknown>;
  sourceKey: string | null;
  previousFingerprint: string | null;
  leaseToken: string;
}
export interface MonitorObservation {
  fingerprint: string;
  observed: Record<string, unknown>;
}
export type MonitorFetch = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text?(): Promise<string> }>;
export interface MonitorAdapter {
  readonly key: string;
  check(target: MonitorTarget, fetch: MonitorFetch): Promise<MonitorObservation>;
}

/** An error a monitor adapter raises on purpose, with its class. */
export class MonitorError extends Error {
  readonly failureClass: MonitorFailureClass;
  constructor(code: string, failureClass: MonitorFailureClass) {
    super(code);
    this.failureClass = failureClass;
  }
}

export function fingerprintOf(parts: readonly (string | number | null)[]): string {
  return createHash('sha256').update(parts.map(p => (p === null ? '∅' : String(p))).join('\u001f'), 'utf8').digest('hex');
}

export function classifyMonitorFailure(error: unknown): { code: string; failureClass: MonitorFailureClass } {
  if (error instanceof MonitorError) return { code: error.message, failureClass: error.failureClass };
  const code = error instanceof Error && /^[A-Z0-9_]{1,80}$/.test(error.message) ? error.message : 'MONITOR_UNEXPECTED_ERROR';
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { code: 'NETWORK_TIMEOUT', failureClass: 'unreachable' };
  }
  if (error instanceof TypeError) return { code: 'NETWORK_UNREACHABLE', failureClass: 'unreachable' };
  if (['RATE_LIMITED', 'UPSTREAM_5XX', 'NETWORK_TIMEOUT', 'NETWORK_UNREACHABLE'].includes(code)) return { code, failureClass: 'unreachable' };
  return { code, failureClass: 'failed' };
}

/** Classifies an HTTP status from an official source. */
export function httpFailure(status: number): MonitorError {
  if (status === 429) return new MonitorError('RATE_LIMITED', 'unreachable');
  if (status >= 500) return new MonitorError('UPSTREAM_5XX', 'unreachable');
  // A 404 or 410 on a listing Njumeni relies on means the integration broke (moved or retired API).
  if (status === 404 || status === 410) return new MonitorError('MONITOR_ENDPOINT_GONE', 'integration_failure');
  if (status === 401 || status === 403) return new MonitorError('MONITOR_ACCESS_REFUSED', 'integration_failure');
  return new MonitorError('MONITOR_HTTP_' + status, 'failed');
}

export interface MonitorPersistence {
  claim(workerId: string, limit: number): Promise<MonitorTarget[]>;
  record(input: {
    targetKey: string; leaseToken: string; fingerprint: string | null; observed: Record<string, unknown>;
    failureCode: string | null; failureClass: MonitorFailureClass | null; durationMs: number;
  }): Promise<string>;
}

export interface MonitorCycleResult {
  claimed: number;
  outcomes: { targetKey: string; outcome: string }[];
}

/** One monitoring pass: claim due targets, check each with its adapter, record every result. */
export async function runMonitorCycle(options: {
  workerId: string;
  persistence: MonitorPersistence;
  adapters: readonly MonitorAdapter[];
  fetch: MonitorFetch;
  limit?: number;
  now?: () => number;
}): Promise<MonitorCycleResult> {
  const now = options.now ?? (() => Date.now());
  const byKey = new Map(options.adapters.map(adapter => [adapter.key, adapter]));
  const targets = await options.persistence.claim(options.workerId, options.limit ?? 10);
  const outcomes: MonitorCycleResult['outcomes'] = [];
  for (const target of targets) {
    const started = now();
    let fingerprint: string | null = null;
    let observed: Record<string, unknown> = {};
    let failureCode: string | null = null;
    let failureClass: MonitorFailureClass | null = null;
    try {
      const adapter = target.monitorAdapterKey ? byKey.get(target.monitorAdapterKey) : undefined;
      // A target whose adapter this worker does not have is a software problem, not "unchanged".
      if (!adapter) throw new MonitorError('MONITOR_ADAPTER_NOT_REGISTERED', 'integration_failure');
      const result = await adapter.check(target, options.fetch);
      if (!/^[a-f0-9]{64}$/.test(result.fingerprint)) throw new MonitorError('MONITOR_FINGERPRINT_INVALID', 'failed');
      fingerprint = result.fingerprint;
      observed = result.observed;
    } catch (error) {
      const failure = classifyMonitorFailure(error);
      failureCode = failure.code;
      failureClass = failure.failureClass;
    }
    const outcome = await options.persistence.record({
      targetKey: target.targetKey, leaseToken: target.leaseToken, fingerprint, observed,
      failureCode, failureClass, durationMs: Math.max(0, Math.round(now() - started)),
    });
    outcomes.push({ targetKey: target.targetKey, outcome });
  }
  return { claimed: targets.length, outcomes };
}
