import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

const BUCKET_ID = 'njumeni-workspace-files';
const SIGNED_DOWNLOAD_TTL_SECONDS = 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/tiff',
]);

export type WorkspaceStorageScope = {
  organizationId: string;
  workspaceId: string;
};

export type WorkspaceUploadIntentInput = WorkspaceStorageScope & {
  filename: string;
  contentType: string;
};

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error(`Invalid ${field}.`);
}

function normalizeFilename(value: string): string {
  const filename = value
    .normalize('NFKC')
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .trim()
    .slice(0, 160);

  if (!filename || filename === '.' || filename === '..') {
    throw new Error('A valid filename is required.');
  }
  return filename;
}

function assertObjectKey(scope: WorkspaceStorageScope, objectKey: string): void {
  const segments = objectKey.split('/');
  if (
    segments.length !== 4 ||
    segments[0] !== scope.organizationId ||
    segments[1] !== scope.workspaceId ||
    !UUID_PATTERN.test(segments[2] ?? '') ||
    !segments[3] ||
    segments[3] === '.' ||
    segments[3] === '..' ||
    /[\u0000-\u001f\u007f]/.test(objectKey)
  ) {
    throw new Error('The object key is outside the requested workspace scope.');
  }
}

async function requireWorkspacePermission(
  scope: WorkspaceStorageScope,
  permission: 'document.read' | 'document.upload' | 'document.delete',
): Promise<Awaited<ReturnType<typeof createClient>>> {
  assertUuid(scope.organizationId, 'organisation');
  assertUuid(scope.workspaceId, 'workspace');

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Authentication is required.');

  const { data, error } = await supabase.rpc('has_permission', {
    p_permission_key: permission,
    p_organization_id: scope.organizationId,
    p_workspace_id: scope.workspaceId,
  });

  if (error || data !== true) {
    throw new Error('You do not have permission to access this workspace file.');
  }
  return supabase;
}

/** Creates a one-object upload capability after PostgreSQL authorises the caller. */
export async function createWorkspaceUploadIntent(input: WorkspaceUploadIntentInput) {
  const filename = normalizeFilename(input.filename);
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
    throw new Error('This file type is not allowed.');
  }

  const supabase = await requireWorkspacePermission(input, 'document.upload');
  const objectKey = [input.organizationId, input.workspaceId, randomUUID(), filename].join('/');
  const { data, error } = await supabase.storage
    .from(BUCKET_ID)
    .createSignedUploadUrl(objectKey, { upsert: false });

  if (error || !data) throw new Error('Unable to create a workspace upload capability.');
  return { bucketId: BUCKET_ID, objectKey, signedUrl: data.signedUrl, token: data.token };
}

/** Signs a recorded object for 60 seconds after checking the exact tenant/workspace path. */
export async function createWorkspaceDownloadUrl(
  scope: WorkspaceStorageScope & { objectKey: string },
) {
  assertObjectKey(scope, scope.objectKey);
  const supabase = await requireWorkspacePermission(scope, 'document.read');
  const { data, error } = await supabase.storage
    .from(BUCKET_ID)
    .createSignedUrl(scope.objectKey, SIGNED_DOWNLOAD_TTL_SECONDS);

  if (error || !data) throw new Error('Unable to create a workspace download capability.');
  return { bucketId: BUCKET_ID, objectKey: scope.objectKey, signedUrl: data.signedUrl };
}

/** Deletes one scoped object after checking the caller's current document.delete grant. */
export async function deleteWorkspaceObject(
  scope: WorkspaceStorageScope & { objectKey: string },
): Promise<void> {
  assertObjectKey(scope, scope.objectKey);
  const supabase = await requireWorkspacePermission(scope, 'document.delete');
  const { error } = await supabase.storage.from(BUCKET_ID).remove([scope.objectKey]);
  if (error) throw new Error('Unable to delete the workspace file.');
}
