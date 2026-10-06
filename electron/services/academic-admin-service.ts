import crypto from 'node:crypto';
import type { LocalDatabase } from '../database/client.js';
import type { Area } from '../../shared/contracts.js';

type Row = Record<string, unknown>;
const nowIso = () => new Date().toISOString();

export type TermStatus = 'upcoming' | 'active' | 'completed' | 'archived';
export type AssessmentAdminType = 'assignment' | 'quiz' | 'exam' | 'activity' | 'peer_review' | 'project' | 'other';

export interface InstitutionRecord {
  id: string;
  name: string;
  shortName: Area;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TermRecord {
  id: string;
  institutionId: string;
  programId: string;
  name: string;
  code: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: TermStatus;
  moduleUnitLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseAdminRecord {
  id: string;
  institutionId: string;
  termId: string;
  code: string;
  name: string;
  credits: number | null;
  notes: string;
  active: boolean;
  gradingConfig: string | null;
  termName: string;
  termStatus: TermStatus;
  moduleUnitLabel: string;
}

function mapInstitution(row: Row): InstitutionRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: String(row.shortName) as Area,
    archived: Boolean(row.archived),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function defaultProgramId(db: LocalDatabase, institutionId: string): string {
  const row = db.prepare('SELECT id FROM programs WHERE institution_id=? ORDER BY created_at LIMIT 1').get(institutionId) as Row | undefined;
  if (row?.id) return String(row.id);
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare('INSERT INTO programs (id,institution_id,name,active,created_at,updated_at) VALUES (?,?,?,1,?,?)').run(id, institutionId, 'Default programme', now, now);
  return id;
}

export class AcademicAdminService {
  constructor(private readonly db: LocalDatabase) {}

  listInstitutions(includeArchived = false): InstitutionRecord[] {
    const rows = this.db.prepare(`SELECT id,name,short_name shortName,archived,created_at createdAt,updated_at updatedAt FROM institutions ${includeArchived ? '' : 'WHERE archived=0'} ORDER BY name`).all() as Row[];
    return rows.map(mapInstitution);
  }

  createInstitution(input: { name: string; shortName: Area }) {
    const existing = this.db.prepare('SELECT id FROM institutions WHERE short_name=?').get(input.shortName);
    if (existing) throw new Error('An institution with this area code already exists.');
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db.prepare('INSERT INTO institutions (id,name,short_name,archived,created_at,updated_at) VALUES (?,?,?,0,?,?)').run(id, input.name.trim(), input.shortName, now, now);
    defaultProgramId(this.db, id);
    return mapInstitution(this.db.prepare('SELECT id,name,short_name shortName,archived,created_at createdAt,updated_at updatedAt FROM institutions WHERE id=?').get(id) as Row);
  }

  updateInstitution(input: { id: string; name: string; shortName: Area }) {
    const now = nowIso();
    this.db.prepare('UPDATE institutions SET name=?,short_name=?,updated_at=? WHERE id=?').run(input.name.trim(), input.shortName, now, input.id);
    return mapInstitution(this.db.prepare('SELECT id,name,short_name shortName,archived,created_at createdAt,updated_at updatedAt FROM institutions WHERE id=?').get(input.id) as Row);
  }

  archiveInstitution(id: string) {
    const now = nowIso();
    this.db.prepare('UPDATE institutions SET archived=1,updated_at=? WHERE id=?').run(now, id);
  }

  listTerms(institutionId: string): TermRecord[] {
    return (this.db.prepare(`
      SELECT id,institution_id institutionId,program_id programId,name,code,starts_at startsAt,ends_at endsAt,status,module_unit_label moduleUnitLabel,created_at createdAt,updated_at updatedAt
      FROM terms WHERE institution_id=? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, starts_at DESC
    `).all(institutionId) as Row[]).map((row) => ({
      id: String(row.id),
      institutionId: String(row.institutionId),
      programId: String(row.programId),
      name: String(row.name),
      code: row.code ? String(row.code) : null,
      startsAt: row.startsAt ? String(row.startsAt) : null,
      endsAt: row.endsAt ? String(row.endsAt) : null,
      status: String(row.status) as TermStatus,
      moduleUnitLabel: String(row.moduleUnitLabel ?? 'week'),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    }));
  }

  createTerm(input: { institutionId: string; name: string; code?: string | null; startsAt?: string | null; endsAt?: string | null; status?: TermStatus; moduleUnitLabel?: string }) {
    const id = crypto.randomUUID();
    const now = nowIso();
    const programId = defaultProgramId(this.db, input.institutionId);
    const status = input.status ?? 'upcoming';
    this.db.prepare(`
      INSERT INTO terms (id,program_id,institution_id,name,code,starts_at,ends_at,status,module_unit_label,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, programId, input.institutionId, input.name.trim(), input.code?.trim() || null, input.startsAt ?? null, input.endsAt ?? null, status, input.moduleUnitLabel ?? 'week', now, now);
    return this.listTerms(input.institutionId).find((term) => term.id === id)!;
  }

  updateTerm(input: { id: string; name?: string; code?: string | null; startsAt?: string | null; endsAt?: string | null; moduleUnitLabel?: string }) {
    const existing = this.db.prepare('SELECT name,code,starts_at startsAt,ends_at endsAt,module_unit_label moduleUnitLabel FROM terms WHERE id=?').get(input.id) as Row;
    const now = nowIso();
    this.db.prepare(`
      UPDATE terms SET name=?,code=?,starts_at=?,ends_at=?,module_unit_label=?,updated_at=? WHERE id=?
    `).run(
      (input.name ?? String(existing.name)).trim(),
      input.code !== undefined ? input.code?.trim() || null : (existing.code == null ? null : String(existing.code)),
      input.startsAt !== undefined ? input.startsAt ?? null : (existing.startsAt == null ? null : String(existing.startsAt)),
      input.endsAt !== undefined ? input.endsAt ?? null : (existing.endsAt == null ? null : String(existing.endsAt)),
      input.moduleUnitLabel ?? String(existing.moduleUnitLabel ?? 'week'),
      now,
      input.id,
    );
    const institutionId = (this.db.prepare('SELECT institution_id institutionId FROM terms WHERE id=?').get(input.id) as Row).institutionId;
    return this.listTerms(String(institutionId)).find((term) => term.id === input.id)!;
  }

  setTermStatus(id: string, status: TermStatus) {
    const now = nowIso();
    this.db.prepare('UPDATE terms SET status=?,updated_at=? WHERE id=?').run(status, now, id);
    const institutionId = (this.db.prepare('SELECT institution_id institutionId FROM terms WHERE id=?').get(id) as Row).institutionId;
    return this.listTerms(String(institutionId)).find((term) => term.id === id)!;
  }

  listCourses(institutionId: string, termId?: string): CourseAdminRecord[] {
    const rows = this.db.prepare(`
      SELECT c.id,c.institution_id institutionId,c.term_id termId,c.code,c.name,c.credits,c.notes,c.active,c.grading_config gradingConfig,
        t.name termName,t.status termStatus,t.module_unit_label moduleUnitLabel
      FROM courses c JOIN terms t ON t.id=c.term_id
      WHERE c.institution_id=? ${termId ? 'AND c.term_id=?' : ''}
      ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, c.code, c.name
    `).all(...(termId ? [institutionId, termId] : [institutionId])) as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      institutionId: String(row.institutionId),
      termId: String(row.termId),
      code: String(row.code ?? ''),
      name: String(row.name),
      credits: row.credits == null ? null : Number(row.credits),
      notes: String(row.notes ?? ''),
      active: Boolean(row.active),
      gradingConfig: row.gradingConfig ? String(row.gradingConfig) : null,
      termName: String(row.termName),
      termStatus: String(row.termStatus) as TermStatus,
      moduleUnitLabel: String(row.moduleUnitLabel ?? 'week'),
    }));
  }

  createCourse(input: { institutionId: string; termId: string; code?: string; name: string; credits?: number | null; notes?: string; gradingConfig?: string | null }) {
    const id = crypto.randomUUID();
    const now = nowIso();
    const code = input.code?.trim() ?? '';
    this.db.prepare(`
      INSERT INTO courses (id,institution_id,term_id,code,name,credits,active,grading_config,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,1,?,?,?,?)
    `).run(id, input.institutionId, input.termId, code, input.name.trim(), input.credits ?? null, input.gradingConfig ?? null, input.notes?.trim() ?? '', now, now);
    if (code) this.db.prepare('INSERT OR IGNORE INTO course_match_aliases (id,course_id,alias,created_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), id, code, now);
    return this.listCourses(input.institutionId).find((course) => course.id === id)!;
  }

  updateCourse(input: { id: string; code?: string; name?: string; credits?: number | null; notes?: string; gradingConfig?: string | null; termId?: string }) {
    const now = nowIso();
    const existing = this.db.prepare('SELECT institution_id institutionId,code,name,credits,notes,grading_config gradingConfig,term_id termId FROM courses WHERE id=?').get(input.id) as Row;
    this.db.prepare(`
      UPDATE courses SET code=?,name=?,credits=?,notes=?,grading_config=?,term_id=COALESCE(?,term_id),updated_at=? WHERE id=?
    `).run(
      input.code !== undefined ? input.code.trim() : String(existing.code ?? ''),
      (input.name ?? String(existing.name)).trim(),
      input.credits !== undefined ? input.credits ?? null : (existing.credits == null ? null : Number(existing.credits)),
      input.notes !== undefined ? input.notes.trim() : String(existing.notes ?? ''),
      input.gradingConfig !== undefined ? input.gradingConfig ?? null : (existing.gradingConfig == null ? null : String(existing.gradingConfig)),
      input.termId ?? null,
      now,
      input.id,
    );
    const code = input.code !== undefined ? input.code.trim() : String(existing.code ?? '');
    if (code && code !== String(existing.code ?? '')) {
      this.db.prepare('INSERT OR IGNORE INTO course_match_aliases (id,course_id,alias,created_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), input.id, code, now);
    }
    return this.listCourses(String(existing.institutionId)).find((course) => course.id === input.id)!;
  }

  archiveCourse(id: string) {
    const now = nowIso();
    this.db.prepare('UPDATE courses SET active=0,updated_at=? WHERE id=?').run(now, id);
  }

  listModules(courseId: string) {
    return (this.db.prepare(`
      SELECT id,course_id courseId,week_number weekNumber,title,topics,completed,archived
      FROM course_modules WHERE course_id=? AND archived=0 ORDER BY week_number
    `).all(courseId) as Row[]).map((row) => ({
      id: String(row.id),
      courseId: String(row.courseId),
      weekNumber: Number(row.weekNumber),
      title: String(row.title),
      topics: JSON.parse(String(row.topics)) as string[],
      completed: Boolean(row.completed),
    }));
  }

  createModule(input: { courseId: string; weekNumber: number; title: string; topics?: string[] }) {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO course_modules (id,course_id,week_number,title,topics,completed,archived,created_at,updated_at)
      VALUES (?,?,?,?,?,0,0,?,?)
    `).run(id, input.courseId, input.weekNumber, input.title.trim(), JSON.stringify(input.topics ?? []), now, now);
    return this.listModules(input.courseId).find((module) => module.id === id)!;
  }

  updateModule(input: { id: string; weekNumber: number; title: string; topics?: string[] }) {
    const now = nowIso();
    const courseId = (this.db.prepare('SELECT course_id courseId FROM course_modules WHERE id=?').get(input.id) as Row).courseId;
    this.db.prepare('UPDATE course_modules SET week_number=?,title=?,topics=?,updated_at=? WHERE id=?').run(input.weekNumber, input.title.trim(), JSON.stringify(input.topics ?? []), now, input.id);
    return this.listModules(String(courseId)).find((module) => module.id === input.id)!;
  }

  archiveModule(id: string) {
    const now = nowIso();
    this.db.prepare('UPDATE course_modules SET archived=1,updated_at=? WHERE id=?').run(now, id);
  }

  reorderModules(courseId: string, orderedIds: string[]) {
    const now = nowIso();
    this.db.transaction(() => {
      orderedIds.forEach((id, index) => {
        this.db.prepare('UPDATE course_modules SET week_number=?,updated_at=? WHERE id=? AND course_id=?').run(index + 1, now, id, courseId);
      });
    })();
    return this.listModules(courseId);
  }

  listAssessments(courseId: string) {
    return (this.db.prepare(`
      SELECT id,course_id courseId,type,title,scheduled_at scheduledAt,release_at releaseAt,peer_review_at peerReviewAt,score,maximum_score maximumScore,status,notes,source_url sourceUrl
      FROM assessments WHERE course_id=? AND status!='archived' ORDER BY COALESCE(scheduled_at,release_at),title
    `).all(courseId) as Row[]).map((row) => ({
      id: String(row.id),
      courseId: String(row.courseId),
      type: String(row.type),
      title: String(row.title),
      scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
      releaseAt: row.releaseAt ? String(row.releaseAt) : null,
      peerReviewAt: row.peerReviewAt ? String(row.peerReviewAt) : null,
      score: row.score == null ? null : Number(row.score),
      maximumScore: row.maximumScore == null ? null : Number(row.maximumScore),
      status: String(row.status),
      notes: String(row.notes ?? ''),
      sourceUrl: row.sourceUrl ? String(row.sourceUrl) : null,
    }));
  }

  createAssessment(input: {
    courseId: string;
    type: AssessmentAdminType;
    title: string;
    scheduledAt?: string | null;
    releaseAt?: string | null;
    peerReviewAt?: string | null;
    maximumScore?: number | null;
    notes?: string;
    sourceUrl?: string | null;
  }) {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO assessments (id,course_id,type,title,scheduled_at,release_at,peer_review_at,score,maximum_score,status,notes,source_url,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,NULL,?, ?, ?, ?, ?, ?)
    `).run(id, input.courseId, input.type, input.title.trim(), input.scheduledAt ?? null, input.releaseAt ?? null, input.peerReviewAt ?? null, input.maximumScore ?? 100, 'scheduled', input.notes?.trim() ?? '', input.sourceUrl ?? null, now, now);
    return this.listAssessments(input.courseId).find((assessment) => assessment.id === id)!;
  }

  updateAssessment(input: {
    id: string;
    type: AssessmentAdminType;
    title: string;
    scheduledAt?: string | null;
    releaseAt?: string | null;
    peerReviewAt?: string | null;
    score?: number | null;
    maximumScore?: number | null;
    status?: string;
    notes?: string;
    sourceUrl?: string | null;
  }) {
    const now = nowIso();
    const courseId = (this.db.prepare('SELECT course_id courseId FROM assessments WHERE id=?').get(input.id) as Row).courseId;
    this.db.prepare(`
      UPDATE assessments SET type=?,title=?,scheduled_at=?,release_at=?,peer_review_at=?,score=?,maximum_score=?,status=?,notes=?,source_url=?,updated_at=? WHERE id=?
    `).run(input.type, input.title.trim(), input.scheduledAt ?? null, input.releaseAt ?? null, input.peerReviewAt ?? null, input.score ?? null, input.maximumScore ?? 100, input.status ?? 'scheduled', input.notes?.trim() ?? '', input.sourceUrl ?? null, now, input.id);
    return this.listAssessments(String(courseId)).find((assessment) => assessment.id === input.id)!;
  }

  archiveAssessment(id: string) {
    const now = nowIso();
    this.db.prepare("UPDATE assessments SET status='archived',updated_at=? WHERE id=?").run(now, id);
  }
}
