import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMigrationChanges, validateMigrationFiles } from '../scripts/ci/check-migrations.mjs';

test('accepts CLI-shaped migration names in timestamp order', () => {
  assert.deepEqual(
    validateMigrationFiles([
      '20261110010000_create_identity_tables.sql',
      '20261110020000_add_workspace_membership.sql',
    ]),
    [],
  );
});

test('rejects non-CLI names, duplicate timestamps and out-of-order migrations', () => {
  assert.ok(validateMigrationFiles(['init.sql']).some((error) => error.includes('Invalid migration')));
  assert.ok(
    validateMigrationFiles([
      '20261110020000_add_workspace_membership.sql',
      '20261110010000_create_identity_tables.sql',
    ]).some((error) => error.includes('ascending timestamp order')),
  );
  assert.ok(
    validateMigrationFiles([
      '20261110010000_create_identity_tables.sql',
      '20261110010000_add_workspace_membership.sql',
    ]).some((error) => error.includes('must be unique')),
  );
});

test('allows new migration additions but rejects edits, deletions and renames', () => {
  assert.deepEqual(validateMigrationChanges(['A supabase/migrations/20261110010000_initial.sql']), []);
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
    validateMigrationChanges(['R100 supabase/migrations/20261110010000_old.sql supabase/migrations/20261110020000_new.sql']).length > 0,
  );
});
