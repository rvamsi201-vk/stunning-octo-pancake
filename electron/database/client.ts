import { DatabaseSync } from 'node:sqlite';

/** Thin local adapter around Node's built-in SQLite driver. It keeps database
 * mechanics in main and avoids shipping a native ABI-dependent addon. */
export class LocalDatabase {
  private readonly inner: DatabaseSync;
  constructor(path: string) { this.inner = new DatabaseSync(path); }
  exec(sql: string) { this.inner.exec(sql); }
  prepare(sql: string) { return this.inner.prepare(sql); }
  pragma(statement: string, options?: { simple?: boolean }) {
    if (/^user_version\s*=/.test(statement)) { this.inner.exec(`PRAGMA ${statement}`); return; }
    const row = this.inner.prepare(`PRAGMA ${statement}`).get() as Record<string, unknown> | undefined;
    return options?.simple && row ? Object.values(row)[0] : row;
  }
  transaction<T>(fn: () => T) { return () => { this.inner.exec('BEGIN IMMEDIATE'); try { const result=fn(); this.inner.exec('COMMIT'); return result; } catch(error) { this.inner.exec('ROLLBACK'); throw error; } }; }
  backup(destination: string) {
    try { this.inner.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* WAL may be unavailable in some test environments. */ }
    const escaped = destination.replaceAll("'", "''");
    this.inner.exec(`VACUUM INTO '${escaped}'`);
  }
  close() { this.inner.close(); }
}
