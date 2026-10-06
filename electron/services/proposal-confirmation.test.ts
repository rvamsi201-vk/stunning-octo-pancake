import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase, seedIds } from '../database/seed.js';
import { CommandCentreService } from './command-centre-service.js';
import { confirmAcademicProposal, findMatchingAssessment, normalizeTitle, titlesMatch } from './proposal-confirmation.js';

describe('proposal confirmation', () => {
  let dir = '';
  let db: LocalDatabase;
  let command: CommandCentreService;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cc-proposal-'));
    db = new LocalDatabase(path.join(dir, 'test.sqlite'));
    runMigrations(db);
    seedDatabase(db);
    command = new CommandCentreService(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function insertExternal(title: string, sourceUrl: string) {
    const now = new Date().toISOString();
    const externalId = '90000000-0000-4000-8000-000000000001';
    db.prepare(`INSERT INTO external_records (id,provider,provider_account_id,provider_record_id,provider_resource_id,type,title,sender,occurred_at,detected_due_at,source_url,classification_state,raw_metadata,area,routing_state,routing_reason,archived,created_at,updated_at)
      VALUES (?,?,NULL,?,?, 'mail',?,?,?,NULL,?,'needs_review','{}','IITM','included','test',0,?,?)`)
      .run(externalId, 'google', 'mail-test', 'resource-test', title, 'course-team@study.iitm.ac.in', now, sourceUrl, now, now);
    return externalId;
  }

  function insertProposal(externalRecordId: string, input: { kind: string; title: string; confidence?: number; courseId?: string; proposedDueAt?: string | null; proposedData?: Record<string, unknown>; reasons?: string[] }) {
    const now = new Date().toISOString();
    const id = '91000000-0000-4000-8000-000000000001';
    db.prepare(`INSERT INTO review_proposals (id,external_record_id,kind,confidence,title,course_id,institution_id,proposed_due_at,proposed_data,reasons,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?)`)
      .run(
        id,
        externalRecordId,
        input.kind,
        input.confidence ?? 0.9,
        input.title,
        input.courseId ?? seedIds.math,
        seedIds.iitm,
        input.proposedDueAt ?? null,
        JSON.stringify(input.proposedData ?? { itemType: 'assignment' }),
        JSON.stringify(input.reasons ?? ['Matched database course MA1003']),
        now,
        now,
      );
    return id;
  }

  it('matches existing seeded assessments deterministically', () => {
    const match = findMatchingAssessment(db, seedIds.math, 'activity', 'MA1003 Extra Activity 1 deadline 2026-10-31');
    expect(match?.title).toBe('Extra Activity 1');
    expect(titlesMatch('Quiz 1 reminder', 'Quiz 1')).toBe(true);
    expect(normalizeTitle('MA1003 — Quiz 1')).toContain('ma1003 quiz 1');
  });

  it('confirms an assignment into the correct course and upcoming list', () => {
    const externalId = insertExternal('MA1003 assignment due 2026-11-20', 'https://mail.google.com/mail/u/0/#all/message-1');
    const proposalId = insertProposal(externalId, {
      kind: 'deadline',
      title: 'MA1003 assignment due 2026-10-25',
      proposedDueAt: '2026-10-25T23:59:00.000Z',
      proposedData: { itemType: 'assignment' },
    });
    const proposal = db.prepare('SELECT p.*,e.area,e.source_url FROM review_proposals p JOIN external_records e ON e.id=p.external_record_id WHERE p.id=?').get(proposalId) as Record<string, unknown>;

    const result = confirmAcademicProposal(db, command, proposal);
    expect(result.outcome).toBe('created');

    const item = db.prepare('SELECT course_id courseId,external_record_id externalRecordId,source,source_url sourceUrl,due_at dueAt FROM items WHERE external_record_id=?').get(externalId) as Record<string, unknown>;
    expect(item.courseId).toBe(seedIds.math);
    expect(item.externalRecordId).toBe(externalId);
    expect(item.source).toBe('inbox-email');
    expect(item.sourceUrl).toBe('https://mail.google.com/mail/u/0/#all/message-1');

    const upcoming = command.getUpcoming(30).some((entry) => entry.id === result.itemId);
    expect(upcoming).toBe(true);
  });

  it('links an existing assessment instead of creating a duplicate', () => {
    const before = (db.prepare('SELECT count(*) n FROM assessments WHERE course_id=?').get(seedIds.math) as { n: number }).n;
    const externalId = insertExternal('Extra Activity 1 submission due 2026-10-31', 'https://mail.google.com/mail/u/0/#all/message-2');
    const proposalId = insertProposal(externalId, {
      kind: 'activity',
      title: 'Extra Activity 1 submission due 2026-10-31',
      proposedDueAt: '2026-10-31T23:59:00.000Z',
      proposedData: { itemType: 'activity' },
    });
    const proposal = db.prepare('SELECT p.*,e.area,e.source_url FROM review_proposals p JOIN external_records e ON e.id=p.external_record_id WHERE p.id=?').get(proposalId) as Record<string, unknown>;

    const result = confirmAcademicProposal(db, command, proposal);
    const after = (db.prepare('SELECT count(*) n FROM assessments WHERE course_id=?').get(seedIds.math) as { n: number }).n;
    expect(after).toBe(before);
    expect(result.assessmentId).toBeTruthy();
    const assessment = db.prepare('SELECT source_url sourceUrl FROM assessments WHERE id=?').get(result.assessmentId!) as { sourceUrl: string };
    expect(assessment.sourceUrl).toContain('mail.google.com');
  });

  it('is idempotent when confirmed twice', () => {
    const externalId = insertExternal('MA1003 assignment due 2026-11-20', 'https://mail.google.com/mail/u/0/#all/message-3');
    const proposalId = insertProposal(externalId, {
      kind: 'deadline',
      title: 'MA1003 assignment due 2026-10-25',
      proposedDueAt: '2026-10-25T23:59:00.000Z',
    });
    const proposal = db.prepare('SELECT p.*,e.area,e.source_url FROM review_proposals p JOIN external_records e ON e.id=p.external_record_id WHERE p.id=?').get(proposalId) as Record<string, unknown>;
    confirmAcademicProposal(db, command, proposal);
    confirmAcademicProposal(db, command, proposal);
    expect((db.prepare('SELECT count(*) n FROM items WHERE external_record_id=?').get(externalId) as { n: number }).n).toBe(1);
  });

  it('creates nothing for ignored proposals', () => {
    const externalId = insertExternal('MA1003 assignment due 2026-11-20', 'https://mail.google.com/mail/u/0/#all/message-4');
    const proposalId = insertProposal(externalId, { kind: 'deadline', title: 'MA1003 assignment due 2026-11-20', proposedDueAt: '2026-11-20T23:59:00.000Z' });
    db.prepare("UPDATE review_proposals SET status='ignored' WHERE id=?").run(proposalId);
    const proposal = db.prepare('SELECT p.*,e.area,e.source_url FROM review_proposals p JOIN external_records e ON e.id=p.external_record_id WHERE p.id=?').get(proposalId) as Record<string, unknown>;
    const result = confirmAcademicProposal(db, command, proposal);
    expect(result.outcome).toBe('idempotent');
    expect((db.prepare('SELECT count(*) n FROM items').get() as { n: number }).n).toBeGreaterThan(0);
    expect((db.prepare('SELECT count(*) n FROM items WHERE external_record_id=?').get(externalId) as { n: number }).n).toBe(0);
  });

  it('does not manufacture a task for informational academic review proposals', () => {
    const externalId = insertExternal('Course logistics update', 'https://mail.google.com/mail/u/0/#all/message-5');
    const proposalId = insertProposal(externalId, { kind: 'review', title: 'Course logistics update', confidence: 0.3, proposedData: { itemType: 'task' } });
    const proposal = db.prepare('SELECT p.*,e.area,e.source_url FROM review_proposals p JOIN external_records e ON e.id=p.external_record_id WHERE p.id=?').get(proposalId) as Record<string, unknown>;
    const result = confirmAcademicProposal(db, command, proposal);
    expect(result.outcome).toBe('informational');
    expect((db.prepare('SELECT count(*) n FROM items WHERE external_record_id=?').get(externalId) as { n: number }).n).toBe(0);
  });
});
