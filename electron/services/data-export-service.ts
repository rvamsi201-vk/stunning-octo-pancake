import type { LocalDatabase } from '../database/client.js';

const SECRET_TABLES = new Set(['integration_accounts']);

export interface ExportPayload {
  exportedAt: string;
  institutions: unknown[];
  terms: unknown[];
  courses: unknown[];
  modules: unknown[];
  assessments: unknown[];
  items: unknown[];
}

export class DataExportService {
  constructor(private readonly db: LocalDatabase) {}

  buildJsonExport(): ExportPayload {
    const institutions = this.db.prepare('SELECT id,name,short_name shortName,archived,created_at createdAt,updated_at updatedAt FROM institutions').all();
    const terms = this.db
      .prepare(
        'SELECT id,institution_id institutionId,program_id programId,name,code,starts_at startsAt,ends_at endsAt,status,module_unit_label moduleUnitLabel,created_at createdAt,updated_at updatedAt FROM terms',
      )
      .all();
    const courses = this.db
      .prepare(
        'SELECT id,institution_id institutionId,term_id termId,code,name,credits,active,grading_config gradingConfig,notes,created_at createdAt,updated_at updatedAt FROM courses',
      )
      .all();
    const modules = this.db
      .prepare(
        'SELECT id,course_id courseId,week_number weekNumber,title,topics,completed,archived,created_at createdAt,updated_at updatedAt FROM course_modules WHERE archived=0',
      )
      .all();
    const assessments = this.db
      .prepare(
        "SELECT id,course_id courseId,type,title,scheduled_at scheduledAt,release_at releaseAt,peer_review_at peerReviewAt,score,maximum_score maximumScore,status,notes,source_url sourceUrl,created_at createdAt,updated_at updatedAt FROM assessments WHERE status!='archived'",
      )
      .all();
    const items = this.db
      .prepare(
        'SELECT id,title,description,area,course_id courseId,type,status,priority,due_at dueAt,source,source_url sourceUrl,external_record_id externalRecordId,completed_at completedAt,created_at createdAt,updated_at updatedAt FROM items',
      )
      .all();
    for (const table of SECRET_TABLES) {
      if (this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)) {
        // Explicitly never export integration account rows or credentials.
        void table;
      }
    }
    return {
      exportedAt: new Date().toISOString(),
      institutions,
      terms,
      courses,
      modules: modules.map((row: Record<string, unknown>) => ({ ...row, topics: JSON.parse(String(row.topics)) })),
      assessments,
      items,
    };
  }
}
