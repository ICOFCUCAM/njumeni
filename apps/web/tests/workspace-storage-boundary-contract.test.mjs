import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storage = await readFile(new URL('../src/lib/workspace-storage.ts', import.meta.url), 'utf8');

test('workspace storage is server-only and uses the authenticated Supabase client', () => {
  assert.ok(storage.startsWith("import 'server-only';"));
  assert.ok(storage.includes("import { createClient } from '@/lib/supabase/server'"));
  assert.ok(storage.includes('supabase.auth.getUser()'));
  assert.ok(storage.includes("supabase.rpc('has_permission'"));
  assert.ok(!storage.includes('SUPABASE_SERVICE_ROLE_KEY'));
});

test('uploads generate opaque keys and non-upsert signed upload capabilities', () => {
  assert.ok(storage.includes('randomUUID()'));
  assert.ok(storage.includes('createSignedUploadUrl(objectKey, { upsert: false })'));
  assert.ok(storage.includes('ALLOWED_CONTENT_TYPES'));
  assert.ok(storage.includes('normalizeFilename'));
});

test('download and delete operations re-check permission and exact tenant path', () => {
  assert.ok(storage.includes("requireWorkspacePermission(scope, 'document.read')"));
  assert.ok(storage.includes("requireWorkspacePermission(scope, 'document.delete')"));
  assert.ok(storage.includes('assertObjectKey(scope, scope.objectKey)'));
  assert.ok(storage.includes('createSignedUrl(scope.objectKey, SIGNED_DOWNLOAD_TTL_SECONDS)'));
  assert.ok(storage.includes('SIGNED_DOWNLOAD_TTL_SECONDS = 60'));
  assert.ok(storage.includes('.remove([scope.objectKey])'));
});

test('object keys must match organisation, workspace, file UUID and safe filename', () => {
  assert.ok(storage.includes('segments.length !== 4'));
  assert.ok(storage.includes('segments[0] !== scope.organizationId'));
  assert.ok(storage.includes('segments[1] !== scope.workspaceId'));
  assert.ok(storage.includes("!UUID_PATTERN.test(segments[2] ?? '')"));
  assert.ok(storage.includes("segments[3] === '..'"));
});
