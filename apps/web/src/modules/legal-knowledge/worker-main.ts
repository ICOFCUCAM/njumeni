import 'server-only';
import { createLegalAdapterRegistry } from './adapter-registry.ts';
import { startTrustedLegalIngestionWorker } from './worker-bootstrap.ts';
import { workerAdapterRegistrations } from './worker-adapters.ts';

async function main(): Promise<void> {
  const registry = createLegalAdapterRegistry(workerAdapterRegistrations);
  if (registry.list().length === 0) {
    throw new Error('LEGAL_WORKER_NO_APPROVED_ADAPTERS_REGISTERED');
  }
  await startTrustedLegalIngestionWorker({ registry });
}
void main().catch(error => {
  const code = error instanceof Error && /^[A-Z0-9_]{1,80}$/.test(error.message)
    ? error.message : 'LEGAL_WORKER_START_FAILED';
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'njumeni-legal-ingestion-worker',
    type: 'startup_failed',
    code,
  }) + '\n');
  process.exitCode = 1;
});
