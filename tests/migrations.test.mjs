import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMigrationChanges,
  validateMigrationFiles,
} from '../scripts/ci/check-migrations.mjs';

test('accepts CLI-shaped migration names in timestamp order', () => {
  assert.deepEqual(
    validateMigrationFiles([
      '20261110010000_create_identity_tables.sql',
      '20261110020000_add_workspace_membership.sql',
    ]),
    [],
  );
});

test('rejects non-CLI names and duplicate timestamps; filenames define migration order', () => {
  assert.ok(
    validateMigrationFiles(['init.sql']).some((error) => error.includes('Invalid migration')),
  );
  assert.deepEqual(
    validateMigrationFiles([
      '20261110020000_add_workspace_membership.sql',
      '20261110010000_create_identity_tables.sql',
    ]),
    [],
  );
  assert.ok(
    validateMigrationFiles([
      '20261110010000_create_identity_tables.sql',
      '20261110010000_add_workspace_membership.sql',
    ]).some((error) => error.includes('must be unique')),
  );
});

test('allows only explicitly hash-pinned pre-deployment migration corrections', () => {
  const allowed = new Set(['supabase/migrations/20261110155456_membership_invitation_lifecycle.sql']);
  assert.deepEqual(
    validateMigrationChanges(
      ['M supabase/migrations/20261110155456_membership_invitation_lifecycle.sql'],
      allowed,
    ),
    [],
  );
  assert.ok(
    validateMigrationChanges(
      ['M supabase/migrations/20261110141433_principal_and_user_profiles.sql'],
      allowed,
    ).some((error) => error.includes('immutable')),
  );
  assert.ok(
    validateMigrationChanges(
      ['D supabase/migrations/20261110155456_membership_invitation_lifecycle.sql'],
      allowed,
    ).some((error) => error.includes('immutable')),
  );
});

test('allows new migration additions but rejects edits, deletions and renames', () => {
  assert.deepEqual(
    validateMigrationChanges(['A supabase/migrations/20261110010000_initial.sql']),
    [],
  );
  assert.ok(
    validateMigrationChanges(['M supabase/migrations/20261110010000_initial.sql']).some((error) =>
      error.includes('immutable'),
    ),
  );
  assert.ok(
    validateMigrationChanges(['D supabase/migrations/20261110010000_initial.sql']).some((error) =>
      error.includes('immutable'),
    ),
  );
  assert.ok(
    validateMigrationChanges([
      'R100 supabase/migrations/20261110010000_old.sql supabase/migrations/20261110020000_new.sql',
    ]).length > 0,
  );
});
