import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegalAdapterRegistry } from '../src/modules/legal-knowledge/adapter-registry.ts';

const manifest = (version = '1.0.0') => ({
  sourceKey: 'test-source', name: 'Test source', issuingAuthority: 'Test authority',
  jurisdictionCode: 'NO', sourceType: 'legislation', baseUri: 'https://laws.example.test/',
  allowedHosts: ['example.test'], accessMethod: 'api', adapterKey: 'test-adapter',
  adapterVersion: version,
});
const adapter = (m) => ({ manifest: m, listChangedAuthorities: async () => ({
  externalIds: [], nextCursor: null, complete: true,
}), fetchAuthority: async () => { throw new Error('not used'); } });

test('registry resolves exact adapter key and version only', () => {
  const registry = createLegalAdapterRegistry([{ manifest: manifest(), create: () => adapter(manifest()) }]);
  assert.equal(registry.resolve('test-adapter', '1.0.0').manifest.adapterVersion, '1.0.0');
  assert.equal(registry.resolve('test-adapter', '2.0.0'), null);
  assert.equal(registry.resolve('other-adapter', '1.0.0'), null);
});

test('registry rejects duplicate key-version pairs', () => {
  assert.throws(() => createLegalAdapterRegistry([
    { manifest: manifest(), create: () => adapter(manifest()) },
    { manifest: manifest(), create: () => adapter(manifest()) },
  ]), /LEGAL_ADAPTER_DUPLICATE_REGISTRATION/);
});

test('registry rejects a factory that returns a different pinned version', () => {
  const registry = createLegalAdapterRegistry([{
    manifest: manifest(), create: () => adapter(manifest('2.0.0')),
  }]);
  assert.throws(() => registry.resolve('test-adapter', '1.0.0'), /LEGAL_ADAPTER_MANIFEST_MISMATCH/);
});

test('registry snapshots manifests and allowed-host lists', () => {
  const input = manifest();
  const registry = createLegalAdapterRegistry([{ manifest: input, create: () => adapter(manifest()) }]);
  input.allowedHosts.push('evil.test');
  assert.deepEqual(registry.list()[0].allowedHosts, ['example.test']);
  assert.equal(Object.isFrozen(registry.list()[0]), true);
});

test('registry rejects a factory that changes the registered host allow-list', () => {
  const registry = createLegalAdapterRegistry([{
    manifest: manifest(), create: () => adapter({ ...manifest(), allowedHosts:['attacker.example'] }),
  }]);
  assert.throws(() => registry.resolve('test-adapter', '1.0.0'), /LEGAL_ADAPTER_MANIFEST_MISMATCH/);
});

test('registry rejects malformed allow-list hostnames', () => {
  assert.throws(() => createLegalAdapterRegistry([{
    manifest: { ...manifest(), allowedHosts:['https://not-a-host.example'] },
    create: () => adapter(manifest()),
  }]), /LEGAL_SOURCE_MANIFEST_INVALID/);
});
