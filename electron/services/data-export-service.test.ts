import { describe, expect, it } from 'vitest';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase } from '../database/seed.js';
import { DataExportService } from './data-export-service.js';

describe('DataExportService', () => {
  it('exports academics and items without OAuth secrets', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db);
    const payload = new DataExportService(db).buildJsonExport();
    const json = JSON.stringify(payload);
    expect(json).toContain('institutions');
    expect(json).toContain('MA1003');
    expect(json).not.toContain('refresh_token');
    expect(json).not.toContain('access_token');
    expect(payload).not.toHaveProperty('integration_accounts');
  });
});
