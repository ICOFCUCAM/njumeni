import { validateSourceManifest, type LegalSourceAdapter, type LegalSourceManifest } from './contracts.ts';

export interface LegalAdapterRegistration {
  manifest: LegalSourceManifest;
  create: () => LegalSourceAdapter;
}
export interface LegalAdapterRegistry {
  resolve(adapterKey: string, adapterVersion: string): LegalSourceAdapter | null;
  list(): readonly LegalSourceManifest[];
}
const identity=(key:string,version:string)=>key+'@'+version;
function sameManifest(a:LegalSourceManifest,b:LegalSourceManifest):boolean {
  return a.sourceKey===b.sourceKey&&a.name===b.name&&a.issuingAuthority===b.issuingAuthority&&
    a.jurisdictionCode===b.jurisdictionCode&&a.sourceType===b.sourceType&&a.baseUri===b.baseUri&&
    a.accessMethod===b.accessMethod&&a.adapterKey===b.adapterKey&&a.adapterVersion===b.adapterVersion&&
    [...a.allowedHosts].sort().join('|')===[...b.allowedHosts].sort().join('|');
}

export function createLegalAdapterRegistry(
  registrations: readonly LegalAdapterRegistration[],
): LegalAdapterRegistry {
  const entries = new Map<string, { manifest: LegalSourceManifest; create: () => LegalSourceAdapter }>();
  for (const registration of registrations) {
    validateSourceManifest(registration.manifest);
    const manifest = Object.freeze({
      ...registration.manifest,
      allowedHosts: Object.freeze([...registration.manifest.allowedHosts]),
    });
    const key = identity(manifest.adapterKey, manifest.adapterVersion);
    if (entries.has(key)) throw new Error('LEGAL_ADAPTER_DUPLICATE_REGISTRATION');
    if (typeof registration.create !== 'function') throw new Error('LEGAL_ADAPTER_FACTORY_REQUIRED');
    entries.set(key, { manifest, create: registration.create });
  }
  const snapshot = Object.freeze([...entries.values()].map(entry => entry.manifest));
  return Object.freeze({
    resolve(adapterKey: string, adapterVersion: string): LegalSourceAdapter | null {
      const entry = entries.get(identity(adapterKey, adapterVersion));
      if (!entry) return null;
      const adapter = entry.create();
      if (adapter.manifest.adapterKey !== adapterKey ||
          adapter.manifest.adapterVersion !== adapterVersion ||
          adapter.manifest.sourceKey !== entry.manifest.sourceKey ||
          !sameManifest(adapter.manifest, entry.manifest)) {
        throw new Error('LEGAL_ADAPTER_MANIFEST_MISMATCH');
      }
      validateSourceManifest(adapter.manifest);
      return adapter;
    },
    list(): readonly LegalSourceManifest[] { return snapshot; },
  });
}
