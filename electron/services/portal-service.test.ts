import { describe, expect, it } from 'vitest';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { buildPortalTrustedOrigins } from '../portals/portal-navigation-policy.js';
import { PortalService, validatePortalUrl } from './portal-service.js';

describe('PortalService security', () => {
  it('rejects non-HTTPS portal URLs', () => {
    expect(() => validatePortalUrl('http://example.com')).toThrow(/HTTPS/);
    expect(validatePortalUrl('https://portal.example.edu/')).toBe('https://portal.example.edu/');
  });

  it('stores configured trusted SSO origins', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    const portals = new PortalService(db);
    const created = portals.create({
      name: 'IITM',
      url: 'https://ds.study.iitm.ac.in/',
      area: 'IITM',
      trustedOrigins: ['https://login.microsoftonline.com'],
    });
    expect(created.trustedOrigins).toEqual(['https://login.microsoftonline.com']);
    expect(buildPortalTrustedOrigins('https://ds.study.iitm.ac.in/', created.trustedOrigins)).toContain('https://login.microsoftonline.com');
  });

  it('creates and archives portals without exposing credentials', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    const portals = new PortalService(db);
    const created = portals.create({ name: 'Custom portal', url: 'https://example.com/', area: 'PERSONAL' });
    expect(created.url).toBe('https://example.com/');
    portals.archive(created.id);
    expect(portals.list().find((portal) => portal.id === created.id)).toBeUndefined();
  });
});
