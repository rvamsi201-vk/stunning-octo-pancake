import crypto from 'node:crypto';
import type { LocalDatabase } from '../database/client.js';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import type { AcademicOverview, Area, Course, Dashboard, ExternalRecord, Item, ItemInput, ItemStatus, SearchResult } from '../../shared/contracts.js';

type Row = Record<string, any>;
const bool = (value: unknown) => Boolean(value);

export class CommandCentreService {
  constructor(private readonly db: LocalDatabase) {}

  private mapItem(row: Row): Item { return { ...row, courseId: row.courseId ?? null, dueAt: row.dueAt ?? null, completedAt: row.completedAt ?? null } as Item; }
  private itemQuery(where = '1=1', params: any[] = []) {
    const sql = `SELECT i.id, i.title, i.description, i.area, i.course_id courseId, i.type, i.status, i.priority, i.due_at dueAt, i.source, i.source_url sourceUrl, i.external_record_id externalRecordId, i.created_at createdAt, i.updated_at updatedAt, i.completed_at completedAt, c.name courseName FROM items i LEFT JOIN courses c ON c.id=i.course_id WHERE ${where} ORDER BY CASE i.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, i.due_at`;
    return (this.db.prepare(sql).all(...params) as Row[]).map((row) => this.mapItem(row));
  }
  getToday() { const from = startOfDay(new Date()).toISOString(); const to = endOfDay(new Date()).toISOString(); return this.itemQuery('i.due_at BETWEEN ? AND ?', [from, to]); }
  getUpcoming(days: 7 | 14 | 30) { const from = startOfDay(new Date()).toISOString(); const to = endOfDay(addDays(new Date(), days)).toISOString(); return this.itemQuery("i.status != 'done' AND i.due_at BETWEEN ? AND ?", [from, to]); }
  getOverdue() { return this.itemQuery("i.status != 'done' AND i.due_at < ?", [startOfDay(new Date()).toISOString()]); }
  getItems(filters: { area?: Area; status?: ItemStatus } = {}) { const clauses = ['1=1']; const params: any[] = []; if (filters.area) { clauses.push('i.area=?'); params.push(filters.area); } if (filters.status) { clauses.push('i.status=?'); params.push(filters.status); } return this.itemQuery(clauses.join(' AND '), params); }

  getCourses(institution?: string, options: { includeHistorical?: boolean } = {}): Course[] {
    const filters = ['1=1'];
    const params: (string | number)[] = [];
    if (institution) { filters.push('i.short_name=?'); params.push(institution); }
    if (!options.includeHistorical) { filters.push('c.active=1'); filters.push("t.status IN ('active','upcoming')"); }
    const rows = this.db.prepare(`SELECT c.id,c.institution_id institutionId,i.short_name institutionShortName,i.name institutionName,c.term_id termId,t.name termName,t.module_unit_label moduleUnitLabel,c.code,c.name,c.credits,c.active,c.grading_config gradingConfig,c.notes FROM courses c JOIN institutions i ON i.id=c.institution_id JOIN terms t ON t.id=c.term_id WHERE ${filters.join(' AND ')} ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, c.code, c.name`).all(...params) as Row[];
    const moduleStmt = this.db.prepare('SELECT id,week_number weekNumber,title,topics,completed FROM course_modules WHERE course_id=? AND archived=0 ORDER BY week_number');
    const assessmentStmt = this.db.prepare("SELECT id,course_id courseId,type,title,scheduled_at scheduledAt,release_at releaseAt,peer_review_at peerReviewAt,score,maximum_score maximumScore,status,notes,source_url sourceUrl FROM assessments WHERE course_id=? AND status!='archived' ORDER BY COALESCE(scheduled_at,release_at)");
    return rows.map((row) => ({ ...row, active: bool(row.active), gradingConfig: row.gradingConfig ?? null, modules: (moduleStmt.all(row.id) as Row[]).map((m) => ({ ...m, topics: JSON.parse(m.topics), completed: bool(m.completed) })), assessments: assessmentStmt.all(row.id) as any[] } as Course));
  }
  getCourseById(courseId: string): Course | null {
    const row = this.db.prepare(`SELECT c.id,c.institution_id institutionId,i.short_name institutionShortName,i.name institutionName,c.term_id termId,t.name termName,t.module_unit_label moduleUnitLabel,c.code,c.name,c.credits,c.active,c.grading_config gradingConfig,c.notes FROM courses c JOIN institutions i ON i.id=c.institution_id JOIN terms t ON t.id=c.term_id WHERE c.id=?`).get(courseId) as Row | undefined;
    if (!row) return null;
    return this.getCourses(String(row.institutionShortName), { includeHistorical: true }).find((course) => course.id === courseId) ?? null;
  }
  getAcademicOverview(institution: string): AcademicOverview {
    const institutionRow = this.db.prepare('SELECT id,name FROM institutions WHERE short_name=?').get(institution) as Row | undefined;
    if (!institutionRow) throw new Error('Institution not found');
    const term = this.db.prepare("SELECT t.id,t.name,t.starts_at startsAt,t.status FROM terms t WHERE t.institution_id=? ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, t.starts_at DESC LIMIT 1").get(institutionRow.id) as any;
    return { institution: institutionRow as any, term: term ?? null, courses: this.getCourses(institution), items: this.getItems({ area: institution as Area }) };
  }
  getInbox(filters:{area?:Area;state?:'needs_review'|'confirmed'|'ignored'}={}): ExternalRecord[] { const clauses:string[]=[];const params:string[]=[];if(filters.area){clauses.push('e.area=?');params.push(filters.area)}if(filters.state==='confirmed')clauses.push("e.classification_state='confirmed'");else if(filters.state==='ignored')clauses.push("e.archived=1 AND e.classification_state!='confirmed'");else clauses.push('e.archived=0');const rows=this.db.prepare(`SELECT e.id,e.provider,e.provider_account_id providerAccountId,a.email accountEmail,e.type,e.title,e.sender,e.occurred_at occurredAt,e.end_at endAt,e.detected_due_at detectedDueAt,e.source_url sourceUrl,e.snippet,e.content,e.location,e.provider_status providerStatus,e.classification_state classificationState,e.routing_state routingState,e.routing_reason routingReason,e.area,e.archived FROM external_records e LEFT JOIN integration_accounts a ON a.id=e.provider_account_id WHERE ${clauses.join(' AND ')} ORDER BY e.occurred_at DESC`).all(...params) as Row[];const proposalStmt=this.db.prepare(`SELECT p.id,p.kind,p.confidence,p.title,p.course_id courseId,c.name courseName,p.institution_id institutionId,i.name institutionName,p.proposed_due_at proposedDueAt,p.proposed_data proposedData,p.reasons,p.status FROM review_proposals p LEFT JOIN courses c ON c.id=p.course_id LEFT JOIN institutions i ON i.id=p.institution_id WHERE p.external_record_id=? AND p.status='pending' ORDER BY p.confidence DESC`);return rows.map(r=>({...r,archived:bool(r.archived),proposals:(proposalStmt.all(r.id) as Row[]).map(p=>({...p,proposedData:JSON.parse(p.proposedData),reasons:JSON.parse(p.reasons)}))})) as ExternalRecord[]; }

  createItem(input: ItemInput): Item {
    return this.createInboxItem({ ...input, source: 'manual', externalRecordId: null });
  }
  createInboxItem(input: ItemInput & { source?: string; externalRecordId?: string | null }): Item {
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    this.db.prepare('INSERT INTO items (id,title,description,area,course_id,type,status,priority,due_at,source,source_url,external_record_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,input.title,input.description,input.area,input.courseId ?? null,input.type,input.status,input.priority,input.dueAt ?? null,input.source ?? 'manual',input.sourceUrl ?? null,input.externalRecordId ?? null,now,now);
    return this.itemQuery('i.id=?',[id])[0];
  }
  updateItem(input: Partial<ItemInput> & { id: string }): Item {
    const existing = this.itemQuery('i.id=?',[input.id])[0]; if (!existing) throw new Error('Item not found');
    const next = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.db.prepare('UPDATE items SET title=?,description=?,area=?,course_id=?,type=?,status=?,priority=?,due_at=?,source_url=?,completed_at=?,updated_at=? WHERE id=?').run(next.title,next.description,next.area,next.courseId ?? null,next.type,next.status,next.priority,next.dueAt ?? null,next.sourceUrl ?? null,next.status === 'done' ? (existing.completedAt ?? next.updatedAt) : null,next.updatedAt,input.id);
    return this.itemQuery('i.id=?',[input.id])[0];
  }
  completeItem(id: string) { return this.updateItem({ id, status: 'done' }); }
  setModuleCompletion(id: string, completed: boolean) { this.db.prepare('UPDATE course_modules SET completed=?,updated_at=? WHERE id=?').run(completed ? 1 : 0,new Date().toISOString(),id); }
  setAssessmentScore(id: string, score: number | null) { this.db.prepare('UPDATE assessments SET score=?,updated_at=? WHERE id=?').run(score,new Date().toISOString(),id); }
  actOnExternalRecord(input: { id: string; action: 'archive'|'create-task'|'confirm-deadline' }) {
    const record = this.db.prepare('SELECT * FROM external_records WHERE id=?').get(input.id) as Row | undefined; if (!record) throw new Error('Inbox record not found');
    if (input.action === 'archive') this.db.prepare('UPDATE external_records SET archived=1,updated_at=? WHERE id=?').run(new Date().toISOString(),input.id);
    else { this.createItem({ title: record.title, description: `Created from ${record.provider} inbox record.`, area: record.area, type: input.action === 'confirm-deadline' ? 'assignment' : 'task', status: 'todo', priority: 'normal', dueAt: record.detected_due_at, sourceUrl: record.source_url }); this.db.prepare("UPDATE external_records SET archived=1,classification_state='confirmed',updated_at=? WHERE id=?").run(new Date().toISOString(),input.id); }
  }
  search(query: string, area?: Area): SearchResult[] {
    if (!query) return [];
    const like = `%${query}%`; const areaClause = area ? ' AND area=?' : ''; const params = area ? [like,like,area] : [like,like];
    const itemRows = this.db.prepare(`SELECT id,title,COALESCE(description,'') subtitle,area FROM items WHERE (title LIKE ? OR description LIKE ?)${areaClause} LIMIT 20`).all(...params) as Row[];
    const courseRows = this.db.prepare(`SELECT c.id,c.name title,c.code||' · '||i.name subtitle,i.short_name area FROM courses c JOIN institutions i ON i.id=c.institution_id WHERE (c.name LIKE ? OR c.code LIKE ?)${area ? ' AND i.short_name=?' : ''} LIMIT 10`).all(...params) as Row[];
    const assessmentRows = this.db.prepare(`SELECT a.id,a.title,c.code||' · '||c.name subtitle,i.short_name area,c.id courseId FROM assessments a JOIN courses c ON c.id=a.course_id JOIN institutions i ON i.id=c.institution_id WHERE (a.title LIKE ? OR c.name LIKE ?)${area ? ' AND i.short_name=?' : ''} LIMIT 10`).all(...params) as Row[];
    const inboxRows = this.db.prepare(`SELECT id,title,provider subtitle,area FROM external_records WHERE archived=0 AND (title LIKE ? OR COALESCE(sender,'') LIKE ?)${areaClause} LIMIT 10`).all(...params) as Row[];
    return [...itemRows.map(r=>({...r,kind:'item'})),...courseRows.map(r=>({...r,kind:'course',route:`/academics/${String(r.area).toLowerCase()}/course/${r.id}`})),...assessmentRows.map(r=>({...r,kind:'assessment',route:`/academics/${String(r.area).toLowerCase()}/course/${r.courseId}`})),...inboxRows.map(r=>({...r,kind:'inbox',route:'/inbox'}))] as SearchResult[];
  }
  getSetting(key: string) { return (this.db.prepare('SELECT value FROM app_settings WHERE key=?').get(key) as {value:string}|undefined)?.value ?? null; }
  setSetting(key: string,value: string) { this.db.prepare('INSERT INTO app_settings VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key,value,new Date().toISOString()); }
  getDashboard(): Dashboard { return { today: this.getToday(), overdue: this.getOverdue(), upcoming: this.getUpcoming(7), inbox: this.getInbox(), courses: this.getCourses('IITM'), capacity: this.getSetting('dailyCapacity') ?? 'normal' }; }
}
