import crypto from 'node:crypto';
import type { LocalDatabase } from '../database/client.js';
import type { Area, ItemType, Priority } from '../../shared/contracts.js';
import type { CommandCentreService } from './command-centre-service.js';

type Row = Record<string, any>;

export interface ProposalConfirmEdits {
  title?: string;
  dueAt?: string | null;
  type?: ItemType;
  courseId?: string | null;
  priority?: Priority;
}

export interface ConfirmProposalResult {
  outcome: 'created' | 'informational' | 'idempotent' | 'new-course';
  itemId?: string;
  assessmentId?: string | null;
}

export function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function titlesMatch(candidate: string, target: string): boolean {
  const left = normalizeTitle(candidate);
  const right = normalizeTitle(target);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function isActionableProposalKind(kind: string, proposedDueAt: string | null | undefined): boolean {
  if (kind === 'new-course') return true;
  if (kind === 'review') return Boolean(proposedDueAt);
  return ['assessment', 'deadline', 'activity', 'class-session', 'item'].includes(kind);
}

export function findMatchingAssessment(db: LocalDatabase, courseId: string, proposalKind: string, title: string): Row | undefined {
  const assessments = db.prepare('SELECT * FROM assessments WHERE course_id=?').all(courseId) as Row[];
  const direct = assessments.find((row) => titlesMatch(String(row.title), title));
  if (direct) return direct;

  const activityNumber = title.match(/extra activity\s*(\d+)/i);
  if (activityNumber) {
    const label = `Extra Activity ${activityNumber[1]}`;
    const numbered = assessments.find((row) => normalizeTitle(String(row.title)) === normalizeTitle(label));
    if (numbered) return numbered;
  }

  if (proposalKind === 'assessment') {
    if (/\bquiz\s*1\b/i.test(title)) return assessments.find((row) => row.title === 'Quiz 1');
    if (/\bquiz\s*2\b/i.test(title)) return assessments.find((row) => row.title === 'Quiz 2');
    if (/end\s*term|\bfinal\b/i.test(title)) return assessments.find((row) => row.title === 'End Term');
  }

  return undefined;
}

function mapAssessmentType(proposalKind: string, itemType: ItemType): string {
  if (proposalKind === 'activity') return 'activity';
  if (proposalKind === 'assessment' || itemType === 'exam') return itemType === 'exam' ? 'exam' : 'quiz';
  if (proposalKind === 'deadline') return 'activity';
  return 'activity';
}

function shouldUpdateScheduledAt(existingScheduledAt: string | null | undefined, proposedDueAt: string | null | undefined, userEditedDue: boolean): boolean {
  if (!proposedDueAt) return false;
  if (userEditedDue) return true;
  return !existingScheduledAt;
}

export function linkOrUpdateAssessment(
  db: LocalDatabase,
  input: {
    courseId: string;
    proposalKind: string;
    title: string;
    itemType: ItemType;
    dueAt: string | null | undefined;
    sourceUrl: string | null | undefined;
    userEditedDue: boolean;
  },
): string | null {
  const existing = findMatchingAssessment(db, input.courseId, input.proposalKind, input.title);
  const now = new Date().toISOString();
  if (existing) {
    const nextScheduled = shouldUpdateScheduledAt(existing.scheduled_at, input.dueAt, input.userEditedDue) ? input.dueAt ?? existing.scheduled_at : existing.scheduled_at;
    const nextSource = existing.source_url ?? input.sourceUrl ?? null;
    db.prepare('UPDATE assessments SET scheduled_at=?,source_url=?,updated_at=? WHERE id=?').run(nextScheduled, nextSource, now, existing.id);
    return String(existing.id);
  }

  if (!input.dueAt && input.proposalKind !== 'assessment') return null;

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO assessments (id,course_id,type,title,scheduled_at,release_at,peer_review_at,score,maximum_score,status,notes,source_url,created_at,updated_at) VALUES (?,?,?,?,?,NULL,NULL,NULL,100,?,?,?,?,?)')
    .run(id, input.courseId, mapAssessmentType(input.proposalKind, input.itemType), input.title, input.dueAt ?? null, 'scheduled', 'Created from routed academic email.', input.sourceUrl ?? null, now, now);
  return id;
}

export function finalizeConfirmedProposal(db: LocalDatabase, proposalId: string, externalRecordId: string): void {
  const now = new Date().toISOString();
  db.prepare("UPDATE review_proposals SET status='confirmed',updated_at=? WHERE id=?").run(now, proposalId);
  db.prepare("UPDATE external_records SET classification_state='confirmed',archived=1,updated_at=? WHERE id=?").run(now, externalRecordId);
}

export function confirmAcademicProposal(
  db: LocalDatabase,
  commandCentre: CommandCentreService,
  proposal: Row,
  edits?: ProposalConfirmEdits,
): ConfirmProposalResult {
  if (proposal.status !== 'pending') return { outcome: 'idempotent' };

  const data = JSON.parse(proposal.proposed_data || '{}') as Record<string, unknown>;
  const externalRecordId = String(proposal.external_record_id);
  const existingItem = db.prepare('SELECT id FROM items WHERE external_record_id=?').get(externalRecordId) as Row | undefined;
  if (existingItem) {
    finalizeConfirmedProposal(db, String(proposal.id), externalRecordId);
    return { outcome: 'idempotent', itemId: String(existingItem.id) };
  }

  const proposedDueAt = proposal.proposed_due_at as string | null | undefined;
  if (!isActionableProposalKind(String(proposal.kind), proposedDueAt)) {
    finalizeConfirmedProposal(db, String(proposal.id), externalRecordId);
    return { outcome: 'informational' };
  }

  const area = proposal.area as Area;
  const courseId = edits?.courseId === undefined ? (proposal.course_id as string | null) : edits.courseId;
  const title = edits?.title ?? String(proposal.title);
  const itemType = (edits?.type ?? (data.itemType as ItemType | undefined) ?? 'task') as ItemType;
  const dueAt = edits?.dueAt === undefined ? proposedDueAt ?? null : edits.dueAt;
  const priority = (edits?.priority ?? (data.priority as Priority | undefined) ?? 'normal') as Priority;
  const sourceUrl = proposal.source_url as string | null | undefined;
  const userEditedDue = edits?.dueAt !== undefined;
  const areaLabel = area === 'IITM' ? 'IIT Madras' : area === 'MANIPAL' ? 'Manipal' : area;

  let assessmentId: string | null = null;
  if (courseId && ['assessment', 'deadline', 'activity', 'class-session'].includes(String(proposal.kind))) {
    assessmentId = linkOrUpdateAssessment(db, {
      courseId,
      proposalKind: String(proposal.kind),
      title,
      itemType,
      dueAt,
      sourceUrl,
      userEditedDue,
    });
  }

  let effectiveDue = dueAt;
  if (!effectiveDue && assessmentId) {
    const assessment = db.prepare('SELECT scheduled_at FROM assessments WHERE id=?').get(assessmentId) as Row | undefined;
    effectiveDue = (assessment?.scheduled_at as string | null | undefined) ?? null;
  }

  const item = commandCentre.createInboxItem({
    title,
    description: `Created from ${areaLabel} email.`,
    area,
    courseId,
    type: itemType,
    status: 'todo',
    priority,
    dueAt: effectiveDue,
    sourceUrl: sourceUrl ?? null,
    externalRecordId,
    source: 'inbox-email',
  });

  finalizeConfirmedProposal(db, String(proposal.id), externalRecordId);
  return { outcome: 'created', itemId: item.id, assessmentId };
}
