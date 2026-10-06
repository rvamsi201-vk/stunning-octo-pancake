import type { LocalDatabase } from './client.js';

const migrations = [
  `
  CREATE TABLE IF NOT EXISTS institutions (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS programs (id TEXT PRIMARY KEY, institution_id TEXT NOT NULL REFERENCES institutions(id), name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS terms (id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), name TEXT NOT NULL, starts_at TEXT, ends_at TEXT, status TEXT NOT NULL CHECK(status IN ('upcoming','current','archived')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, institution_id TEXT NOT NULL REFERENCES institutions(id), term_id TEXT NOT NULL REFERENCES terms(id), code TEXT NOT NULL, name TEXT NOT NULL, credits REAL, active INTEGER NOT NULL DEFAULT 1, grading_config TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(term_id, code));
  CREATE TABLE IF NOT EXISTS course_modules (id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id), week_number INTEGER NOT NULL, title TEXT NOT NULL, topics TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(course_id, week_number));
  CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id), type TEXT NOT NULL, title TEXT NOT NULL, scheduled_at TEXT, release_at TEXT, peer_review_at TEXT, score REAL, maximum_score REAL, status TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', source_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(course_id, title));
  CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', area TEXT NOT NULL CHECK(area IN ('IITM','MANIPAL','EXORA','PERSONAL')), course_id TEXT REFERENCES courses(id), type TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, due_at TEXT, source TEXT NOT NULL DEFAULT 'manual', source_url TEXT, external_record_id TEXT, completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS items_due_idx ON items(due_at, status);
  CREATE INDEX IF NOT EXISTS items_area_idx ON items(area, status);
  CREATE TABLE IF NOT EXISTS external_records (id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_account_id TEXT, provider_record_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, sender TEXT, occurred_at TEXT NOT NULL, detected_due_at TEXT, source_url TEXT, classification_state TEXT NOT NULL, raw_metadata TEXT, area TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(provider, provider_record_id));
  CREATE TABLE IF NOT EXISTS integration_accounts (id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL, email TEXT, area TEXT NOT NULL, scopes TEXT NOT NULL, status TEXT NOT NULL, last_sync_at TEXT, last_sync_error TEXT, metadata TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS portals (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT, area TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `,
  `
  ALTER TABLE integration_accounts ADD COLUMN provider_account_id TEXT;
  ALTER TABLE integration_accounts ADD COLUMN institution_id TEXT REFERENCES institutions(id);
  ALTER TABLE integration_accounts ADD COLUMN last_sync_attempt_at TEXT;
  ALTER TABLE integration_accounts ADD COLUMN sync_state TEXT NOT NULL DEFAULT '{}';
  CREATE UNIQUE INDEX IF NOT EXISTS integration_provider_account_idx ON integration_accounts(provider, provider_account_id);

  ALTER TABLE external_records ADD COLUMN snippet TEXT;
  ALTER TABLE external_records ADD COLUMN content TEXT;
  ALTER TABLE external_records ADD COLUMN end_at TEXT;
  ALTER TABLE external_records ADD COLUMN location TEXT;
  ALTER TABLE external_records ADD COLUMN calendar_id TEXT;
  ALTER TABLE external_records ADD COLUMN provider_status TEXT NOT NULL DEFAULT 'active';
  ALTER TABLE external_records ADD COLUMN provider_updated_at TEXT;
  ALTER TABLE external_records ADD COLUMN provider_resource_id TEXT;
  CREATE INDEX IF NOT EXISTS external_account_idx ON external_records(provider_account_id, occurred_at);

  CREATE TABLE IF NOT EXISTS review_proposals (
    id TEXT PRIMARY KEY,
    external_record_id TEXT NOT NULL REFERENCES external_records(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    confidence REAL NOT NULL,
    title TEXT NOT NULL,
    course_id TEXT REFERENCES courses(id),
    institution_id TEXT REFERENCES institutions(id),
    proposed_due_at TEXT,
    proposed_data TEXT NOT NULL DEFAULT '{}',
    reasons TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK(status IN ('pending','confirmed','ignored')) DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(external_record_id, kind)
  );
  CREATE INDEX IF NOT EXISTS proposals_status_idx ON review_proposals(status, created_at);
  `,
  `
  ALTER TABLE external_records ADD COLUMN routing_state TEXT NOT NULL DEFAULT 'included';
  ALTER TABLE external_records ADD COLUMN routing_reason TEXT;

  CREATE TABLE IF NOT EXISTS institution_mail_domains (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    domain TEXT NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL,
    UNIQUE(institution_id, domain)
  );

  CREATE TABLE IF NOT EXISTS mail_routing_rules (
    id TEXT PRIMARY KEY,
    integration_account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK(action IN ('include','ignore')),
    match_type TEXT NOT NULL CHECK(match_type IN ('sender','sender-domain','recipient','label','institution-domain')),
    match_value TEXT NOT NULL,
    target_area TEXT,
    target_institution_id TEXT REFERENCES institutions(id),
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mail_routing_rules_account_idx ON mail_routing_rules(integration_account_id, priority, created_at);

  INSERT OR IGNORE INTO institution_mail_domains (id,institution_id,domain,created_at)
    SELECT lower(hex(randomblob(16))),id,'iitm.ac.in',datetime('now') FROM institutions WHERE short_name='IITM';
  INSERT OR IGNORE INTO institution_mail_domains (id,institution_id,domain,created_at)
    SELECT lower(hex(randomblob(16))),id,'study.iitm.ac.in',datetime('now') FROM institutions WHERE short_name='IITM';
  `,
  `
  CREATE UNIQUE INDEX IF NOT EXISTS items_external_record_idx ON items(external_record_id) WHERE external_record_id IS NOT NULL;
  `,
  `
  ALTER TABLE institutions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE courses ADD COLUMN notes TEXT NOT NULL DEFAULT '';
  ALTER TABLE course_modules ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE IF NOT EXISTS course_match_aliases (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    alias TEXT NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL,
    UNIQUE(course_id, alias)
  );
  PRAGMA foreign_keys=OFF;
  CREATE TABLE terms_v2 (
    id TEXT PRIMARY KEY,
    program_id TEXT NOT NULL REFERENCES programs(id),
    institution_id TEXT NOT NULL REFERENCES institutions(id),
    name TEXT NOT NULL,
    code TEXT,
    starts_at TEXT,
    ends_at TEXT,
    status TEXT NOT NULL,
    module_unit_label TEXT NOT NULL DEFAULT 'week',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO terms_v2 (id,program_id,institution_id,name,code,starts_at,ends_at,status,module_unit_label,created_at,updated_at)
    SELECT t.id,t.program_id,p.institution_id,t.name,NULL,t.starts_at,t.ends_at,
      CASE WHEN t.status='current' THEN 'active' WHEN t.status='archived' THEN 'archived' WHEN t.status='upcoming' THEN 'upcoming' ELSE 'completed' END,
      'week',t.created_at,t.updated_at
    FROM terms t JOIN programs p ON p.id=t.program_id;
  DROP TABLE terms;
  ALTER TABLE terms_v2 RENAME TO terms;
  PRAGMA foreign_keys=ON;
  INSERT OR IGNORE INTO course_match_aliases (id,course_id,alias,created_at)
    SELECT lower(hex(randomblob(16))),id,code,datetime('now') FROM courses WHERE trim(code)!='';
  `,
];

export function runMigrations(db: LocalDatabase) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const current = db.pragma('user_version', { simple: true }) as number;
  migrations.slice(current).forEach((sql, index) => {
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${current + index + 1}`);
    })();
  });
}
