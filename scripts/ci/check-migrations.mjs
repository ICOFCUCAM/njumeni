import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';
const MIGRATION_PATTERN = /^\d{14}_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;

export function validateMigrationFiles(entries) {
  const errors = [];
  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql')).sort();
  const timestamps = [];

  for (const file of sqlFiles) {
    if (!MIGRATION_PATTERN.test(file)) {
      errors.push(
        `Invalid migration filename: ${file}. Create migrations with the pinned Supabase CLI.`,
      );
      continue;
    }

    timestamps.push(file.slice(0, 14));
  }

  const unique = new Set(timestamps);
  if (unique.size !== timestamps.length) {
    errors.push('Migration timestamps must be unique.');
  }

  const sorted = [...timestamps].sort();
  if (timestamps.some((timestamp, index) => timestamp !== sorted[index])) {
    errors.push('Migration files must be in ascending timestamp order.');
  }

  return errors;
}

export function validateMigrationChanges(statusLines, allowedCorrections = new Set()) {
  const errors = [];

  for (const line of statusLines) {
    const [status, ...pathParts] = line.trim().split(/\s+/);
    const path = pathParts.join(' ');

    if (!status || !path) {
      continue;
    }

    if (status === 'M' && allowedCorrections.has(path)) {
      continue;
    }

    if (status !== 'A') {
      errors.push(
        `Existing migration is immutable; change ${status} is blocked for ${path}. Add a forward migration instead.`,
      );
    }
  }

  return errors;
}

async function main() {
  let entries;

  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      entries = [];
    } else {
      throw error;
    }
  }

  const errors = validateMigrationFiles(entries);
  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql'));

  for (const file of sqlFiles) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    if (!sql.trim()) {
      errors.push(`Migration file is empty: ${file}`);
    }
  }

  const correctionFile = 'scripts/ci/migration-predeployment-corrections.json';
  const allowedCorrections = new Set();

  try {
    const correctionConfig = JSON.parse(await readFile(correctionFile, 'utf8'));
    for (const correction of correctionConfig.corrections ?? []) {
      if (
        typeof correction.path !== 'string' ||
        !correction.path.startsWith(`${MIGRATIONS_DIR}/`) ||
        typeof correction.blob_sha !== 'string' ||
        typeof correction.reason !== 'string' ||
        correction.reason.trim().length < 20
      ) {
        errors.push('Invalid pre-deployment migration correction record.');
        continue;
      }

      const actualBlobSha = execFileSync('git', ['hash-object', correction.path], {
        encoding: 'utf8',
      }).trim();
      if (actualBlobSha !== correction.blob_sha) {
        errors.push(`Pre-deployment correction hash mismatch for ${correction.path}.`);
        continue;
      }
      allowedCorrections.add(correction.path);
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  const baseSha = process.env.MIGRATION_BASE_SHA;
  const headSha = process.env.GITHUB_SHA;

  if (baseSha && !/^0+$/.test(baseSha) && headSha) {
    try {
      execFileSync('git', ['cat-file', '-e', `${baseSha}^{commit}`], { stdio: 'ignore' });
      const diff = execFileSync(
        'git',
        ['diff', '--name-status', baseSha, headSha, '--', MIGRATIONS_DIR],
        { encoding: 'utf8' },
      );
      errors.push(
        ...validateMigrationChanges(diff.split('\n').filter(Boolean), allowedCorrections),
      );
    } catch (error) {
      throw new Error(
        `Unable to verify migration immutability against base ${baseSha}; full Git history is required.`,
        { cause: error },
      );
    }
  } else {
    console.log(
      'No valid base commit was supplied; existing-file immutability comparison is skipped.',
    );
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`MIGRATION POLICY ERROR: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    sqlFiles.length === 0
      ? 'Migration policy passed; no SQL migrations exist yet.'
      : `Migration policy passed for ${sqlFiles.length} SQL migration(s).`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
