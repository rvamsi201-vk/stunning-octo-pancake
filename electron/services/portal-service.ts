import crypto from 'node:crypto';
import type { LocalDatabase } from '../database/client.js';
import type { Area } from '../../shared/contracts.js';
import { validateTrustedOrigins } from '../portals/portal-navigation-policy.js';

type Row = Record<string, unknown>;

export interface PortalRecord {
  id: string;
  name: string;
  url: string | null;
  area: Area;
  sortOrder: number;
  enabled: boolean;
  archived: boolean;
  trustedOrigins: string[];
  createdAt: string;
  updatedAt: string;
}

const HTTPS_URL = /^https:\/\/.+/i;

export function validatePortalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!HTTPS_URL.test(trimmed)) throw new Error('Portal URLs must use HTTPS.');
  return trimmed;
}

function parseTrustedOrigins(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw)) as string[];
    return Array.isArray(parsed) ? validateTrustedOrigins(parsed.filter(Boolean)) : [];
  } catch {
    return [];
  }
}

export class PortalService {
  constructor(private readonly db: LocalDatabase) {}

  list(includeArchived = false): PortalRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id,name,url,area,sort_order sortOrder,enabled,archived,trusted_origins trustedOrigins,created_at createdAt,updated_at updatedAt
        FROM portals ${includeArchived ? '' : 'WHERE archived=0'} ORDER BY sort_order, name`,
      )
      .all() as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      url: row.url ? String(row.url) : null,
      area: String(row.area) as Area,
      sortOrder: Number(row.sortOrder ?? 0),
      enabled: Boolean(row.enabled),
      archived: Boolean(row.archived),
      trustedOrigins: parseTrustedOrigins(row.trustedOrigins),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    }));
  }

  create(input: { name: string; url?: string | null; area: Area; trustedOrigins?: string[] }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sortOrder = Number((this.db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 next FROM portals').get() as Row).next ?? 1);
    const url = validatePortalUrl(input.url);
    const trustedOrigins = JSON.stringify(validateTrustedOrigins(input.trustedOrigins ?? []));
    this.db
      .prepare(
        'INSERT INTO portals (id,name,url,area,sort_order,enabled,archived,trusted_origins,created_at,updated_at) VALUES (?,?,?,?,?,1,0,?,?,?)',
      )
      .run(id, input.name.trim(), url, input.area, sortOrder, trustedOrigins, now, now);
    return this.list(true).find((portal) => portal.id === id)!;
  }

  update(input: { id: string; name?: string; url?: string | null; area?: Area; enabled?: boolean; trustedOrigins?: string[] }) {
    const existing = this.list(true).find((portal) => portal.id === input.id);
    if (!existing) throw new Error('Portal not found');
    const now = new Date().toISOString();
    const url = input.url !== undefined ? validatePortalUrl(input.url) : existing.url;
    const trustedOrigins = JSON.stringify(
      validateTrustedOrigins(input.trustedOrigins ?? existing.trustedOrigins),
    );
    this.db
      .prepare('UPDATE portals SET name=?,url=?,area=?,enabled=?,trusted_origins=?,updated_at=? WHERE id=?')
      .run(
        input.name?.trim() ?? existing.name,
        url,
        input.area ?? existing.area,
        input.enabled === undefined ? (existing.enabled ? 1 : 0) : input.enabled ? 1 : 0,
        trustedOrigins,
        now,
        input.id,
      );
    return this.list(true).find((portal) => portal.id === input.id)!;
  }

  archive(id: string) {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE portals SET archived=1,enabled=0,updated_at=? WHERE id=?').run(now, id);
  }

  reorder(orderedIds: string[]) {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      orderedIds.forEach((id, index) => {
        this.db.prepare('UPDATE portals SET sort_order=?,updated_at=? WHERE id=?').run(index, now, id);
      });
    })();
    return this.list();
  }
}
