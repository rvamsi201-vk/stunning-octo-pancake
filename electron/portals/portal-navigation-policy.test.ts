import { describe, expect, it } from 'vitest';
import {
  buildPortalTrustedOrigins,
  handlePortalNavigation,
  isPortalNavigationAllowed,
  normalizeTrustedOrigin,
} from './portal-navigation-policy.js';

describe('portal navigation policy', () => {
  const primary = 'https://ds.study.iitm.ac.in/';
  const trusted = buildPortalTrustedOrigins(primary, ['https://login.microsoftonline.com', 'accounts.google.com']);

  it('allows primary origin', () => {
    expect(isPortalNavigationAllowed('https://ds.study.iitm.ac.in/courses', trusted)).toBe(true);
  });

  it('allows configured SSO origin', () => {
    expect(isPortalNavigationAllowed('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', trusted)).toBe(true);
    expect(isPortalNavigationAllowed('https://accounts.google.com/o/oauth2/auth', trusted)).toBe(true);
  });

  it('rejects or externalizes untrusted origin', () => {
    expect(isPortalNavigationAllowed('https://evil.example/phish', trusted)).toBe(false);
    expect(handlePortalNavigation('https://evil.example/landing', trusted)).toEqual({ action: 'open-external' });
  });

  it('rejects HTTP', () => {
    expect(isPortalNavigationAllowed('http://ds.study.iitm.ac.in/', trusted)).toBe(false);
    expect(handlePortalNavigation('http://insecure.example/', trusted)).toEqual({ action: 'block' });
  });

  it('rejects malformed origin configuration', () => {
    expect(() => normalizeTrustedOrigin('not a valid origin!!!')).toThrow(/malformed/i);
    expect(() => normalizeTrustedOrigin('http://bad.example')).toThrow(/HTTPS/i);
  });
});
