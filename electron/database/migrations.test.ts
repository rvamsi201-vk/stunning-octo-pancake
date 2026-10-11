import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalDatabase } from './client.js';
import { MIGRATION_COUNT, runMigrations, runMigrationsToVersion } from './migrations.js';
import { seedDatabase } from './seed.js';

describe('database migrations', () => {
  let dir = '';

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cc-migrations-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('upgrades a version-4 database through migrations 5–7 without foreign key errors', () => {
    const productionDb = path.join(process.env.HOME ?? '', 'Library/Application Support/Command Centre/command-centre.sqlite');
    const dbPath = path.join(dir, 'upgrade.sqlite');
    if (existsSync(productionDb)) {
      copyFileSync(productionDb, dbPath);
      const db = new LocalDatabase(dbPath);
      expect(db.pragma('user_version', { simple: true })).toBe(4);
      runMigrations(db);
      expect(db.pragma('user_version', { simple: true })).toBe(MIGRATION_COUNT);
      seedDatabase(db);
      db.close();
      return;
    }

    const db = new LocalDatabase(dbPath);
    runMigrationsToVersion(db, 4);
    runMigrations(db);
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATION_COUNT);
    db.close();
  });
});
