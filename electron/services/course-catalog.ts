import type { LocalDatabase } from '../database/client.js';
import type { CourseReference } from '../classification/classifier.js';

type Row = Record<string, unknown>;

/** Courses eligible for inbox classification: active course in active/upcoming term. */
export function loadMatchableCourses(db: LocalDatabase, institutionId: string): CourseReference[] {
  const rows = db.prepare(`
    SELECT c.id, c.institution_id institutionId, c.code, c.name
    FROM courses c
    JOIN terms t ON t.id = c.term_id
    WHERE c.active = 1
      AND t.status IN ('active', 'upcoming')
      AND c.institution_id = ?
    ORDER BY c.code, c.name
  `).all(institutionId) as Row[];

  const aliasStmt = db.prepare('SELECT alias FROM course_match_aliases WHERE course_id=? ORDER BY alias');
  return rows.map((row) => {
    const aliases = (aliasStmt.all(String(row.id)) as Row[]).map((entry) => String(entry.alias));
    const code = String(row.code ?? '').trim();
    const name = String(row.name);
    const derived = [code, name].filter(Boolean);
    return {
      id: String(row.id),
      institutionId: String(row.institutionId),
      code,
      name,
      aliases: [...new Set([...aliases, ...derived.filter((value) => value !== code && value !== name)])],
    };
  });
}
