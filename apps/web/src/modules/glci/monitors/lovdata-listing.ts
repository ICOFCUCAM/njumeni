// Lovdata public-data listing monitor (Norway, GLCI-02).
// Reads https://api.lovdata.no/v1/publicData/list (the API host the Lovdata licence policy names;
// never the website) and fingerprints the configured dataset's filename, size and last-modified.
// A changed fingerprint means Lovdata republished the dataset; the ingestion worker then compares
// the acts themselves (GLCI-03). Only licensed datasets can be monitored.
import { LOVDATA_LICENCE_POLICY } from '../../legal-knowledge/licence-policy.ts';
import { fingerprintOf, httpFailure, MonitorError, type MonitorAdapter } from '../monitor.ts';

export const LOVDATA_LISTING_MONITOR_KEY = 'lovdata-public-data-listing';
export const LOVDATA_LISTING_URL = 'https://api.lovdata.no/v1/publicData/list';
const USER_AGENT = 'njumeni-glci-monitor/1.0 (+https://github.com/ICOFCUCAM/njumeni)';

export function createLovdataListingMonitor(options: { timeoutMs?: number } = {}): MonitorAdapter {
  const timeout = options.timeoutMs ?? 60_000;
  return {
    key: LOVDATA_LISTING_MONITOR_KEY,
    async check(target, fetch) {
      const dataset = typeof target.config.dataset === 'string' ? target.config.dataset : '';
      if (!LOVDATA_LICENCE_POLICY.permittedDatasets.includes(dataset)) {
        throw new MonitorError('LEGAL_SOURCE_LICENCE_DATASET_NOT_PERMITTED', 'failed');
      }
      if (target.officialUri !== LOVDATA_LISTING_URL) throw new MonitorError('LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED', 'failed');
      const response = await fetch(LOVDATA_LISTING_URL, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw httpFailure(response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new MonitorError('LOVDATA_LISTING_NOT_JSON', 'integration_failure');
      }
      // The listing's shape is Njumeni's contract with Lovdata: any deviation is an integration failure.
      if (!Array.isArray(body) || body.length === 0) throw new MonitorError('LOVDATA_LISTING_SCHEMA_CHANGED', 'integration_failure');
      const entry = body.find(item => (item as { filename?: unknown })?.filename === dataset) as Record<string, unknown> | undefined;
      if (!entry) throw new MonitorError('LOVDATA_DATASET_NOT_LISTED', 'integration_failure');
      const sizeBytes = Number(entry.sizeBytes);
      const lastModified = typeof entry.lastModified === 'string' ? entry.lastModified : '';
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || Number.isNaN(Date.parse(lastModified))) {
        throw new MonitorError('LOVDATA_LISTING_SCHEMA_CHANGED', 'integration_failure');
      }
      const lastModifiedIso = new Date(lastModified).toISOString();
      return {
        fingerprint: fingerprintOf([dataset, sizeBytes, lastModifiedIso]),
        observed: {
          dataset, sizeBytes, lastModified: lastModifiedIso,
          description: typeof entry.description === 'string' ? entry.description.slice(0, 200) : null,
          listedDatasets: body.length,
        },
      };
    },
  };
}
