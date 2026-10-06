/**
 * Navigation policy for isolated portal WebContentsView sessions.
 * HTTPS only; navigation allowed only to the portal primary origin and configured SSO origins.
 */

export function originFromPortalUrl(url: string): string {
  return new URL(url).origin;
}

export function normalizeTrustedOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Trusted origin cannot be empty.');
  try {
    const parsed = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    if (parsed.protocol !== 'https:') throw new Error('Trusted origins must use HTTPS.');
    if (!parsed.host) throw new Error('Trusted origin host is invalid.');
    return parsed.origin;
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTPS')) throw error;
    throw new Error('Trusted origin is malformed.');
  }
}

export function validateTrustedOrigins(origins: string[]): string[] {
  return [...new Set(origins.map((origin) => normalizeTrustedOrigin(origin)))];
}

export function buildPortalTrustedOrigins(primaryUrl: string, configuredOrigins: string[] = []): string[] {
  const primary = originFromPortalUrl(primaryUrl);
  const extras = validateTrustedOrigins(configuredOrigins);
  return [...new Set([primary, ...extras])];
}

export function isPortalNavigationAllowed(url: string, trustedOrigins: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return trustedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}

/** Untrusted HTTPS navigations open externally; HTTP and malformed URLs are blocked. */
export function resolveUntrustedNavigation(url: string): 'open-external' | 'block' {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return 'open-external';
    return 'block';
  } catch {
    return 'block';
  }
}

export function handlePortalNavigation(
  url: string,
  trustedOrigins: string[],
): { action: 'allow' } | { action: 'open-external' } | { action: 'block' } {
  if (isPortalNavigationAllowed(url, trustedOrigins)) return { action: 'allow' };
  const fallback = resolveUntrustedNavigation(url);
  if (fallback === 'open-external') return { action: 'open-external' };
  return { action: 'block' };
}

/** @deprecated Use buildPortalTrustedOrigins */
export function portalAllowedOrigins(url: string): string[] {
  return [originFromPortalUrl(url)];
}
