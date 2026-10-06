import { addDays, endOfDay, endOfMonth, formatISO, isWithinInterval, startOfDay, startOfMonth } from 'date-fns';
import type { LocalDatabase } from '../database/client.js';
import type { Area, ExternalRecord, Item } from '../../shared/contracts.js';

type Row = Record<string, unknown>;

export type ScheduleEntryKind = 'item' | 'assessment' | 'calendar-event';

export interface ScheduleEntry {
  id: string;
  kind: ScheduleEntryKind;
  title: string;
  area: Area;
  startsAt: string;
  endsAt: string | null;
  item?: Item;
  assessmentId?: string;
  courseId?: string;
  courseName?: string;
  assessmentType?: string;
  sourceUrl?: string | null;
  calendarRecordId?: string;
  location?: string | null;
}

export interface TodayView {
  overdue: Item[];
  dueToday: Item[];
  scheduledToday: ScheduleEntry[];
  plannedToday: Item[];
  capacity: string;
}

export interface UpcomingBucket {
  label: 'next-7' | 'next-30' | 'later';
  entries: ScheduleEntry[];
}

export interface UpcomingView {
  buckets: UpcomingBucket[];
  capacity: string;
}

export interface CalendarDaySummary {
  date: string;
  entries: ScheduleEntry[];
}

export interface CalendarMonthView {
  year: number;
  month: number;
  days: CalendarDaySummary[];
  selectedDate: string;
  selectedAgenda: ScheduleEntry[];
}

const normalizeTitle = (value: string) => value.toLowerCase().replace(/\W+/g, '');

export function assessmentCoveredByItem(
  assessment: { courseId: string; title: string; scheduledAt: string | null },
  item: Item,
): boolean {
  if (!assessment.scheduledAt || !item.dueAt || item.status === 'done') return false;
  if (item.courseId !== assessment.courseId) return false;
  if (assessment.scheduledAt.slice(0, 10) !== item.dueAt.slice(0, 10)) return false;
  const a = normalizeTitle(assessment.title);
  const b = normalizeTitle(item.title);
  return b.includes(a) || a.includes(b) || item.type === 'assignment' || item.type === 'exam';
}

export class ScheduleService {
  constructor(
    private readonly db: LocalDatabase,
    private readonly mapItem: (row: Row) => Item,
    private readonly itemQuery: (where: string, params?: unknown[]) => Item[],
    private readonly getSetting: (key: string) => string | null,
  ) {}

  private openItems(area?: Area): Item[] {
    const clauses = ["i.status != 'done'"];
    const params: unknown[] = [];
    if (area) {
      clauses.push('i.area=?');
      params.push(area);
    }
    return this.itemQuery(clauses.join(' AND '), params);
  }

  private assessments(area?: Area): Array<{
    id: string;
    courseId: string;
    courseName: string;
    area: Area;
    type: string;
    title: string;
    scheduledAt: string | null;
    sourceUrl: string | null;
  }> {
    const filters = ["a.status != 'archived'", 'c.active=1', "t.status IN ('active','upcoming')"];
    const params: string[] = [];
    if (area) {
      filters.push('i.short_name=?');
      params.push(area);
    }
    const rows = this.db
      .prepare(
        `SELECT a.id,a.course_id courseId,a.type,a.title,a.scheduled_at scheduledAt,a.source_url sourceUrl,
          c.name courseName,i.short_name area
        FROM assessments a
        JOIN courses c ON c.id=a.course_id
        JOIN institutions i ON i.id=c.institution_id
        JOIN terms t ON t.id=c.term_id
        WHERE ${filters.join(' AND ')} AND COALESCE(a.scheduled_at,a.release_at) IS NOT NULL`,
      )
      .all(...params) as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      courseId: String(row.courseId),
      courseName: String(row.courseName),
      area: String(row.area) as Area,
      type: String(row.type),
      title: String(row.title),
      scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
      sourceUrl: row.sourceUrl ? String(row.sourceUrl) : null,
    }));
  }

  private calendarEvents(area?: Area, from?: Date, to?: Date): ExternalRecord[] {
    const clauses = ["e.type='calendar-event'", 'e.archived=0', "e.routing_state!='excluded'"];
    const params: string[] = [];
    if (area) {
      clauses.push('e.area=?');
      params.push(area);
    }
    if (from && to) {
      clauses.push('e.occurred_at <= ? AND COALESCE(e.end_at,e.occurred_at) >= ?');
      params.push(to.toISOString(), from.toISOString());
    }
    const rows = this.db
      .prepare(
        `SELECT e.id,e.provider,e.type,e.title,e.sender,e.occurred_at occurredAt,e.end_at endAt,e.source_url sourceUrl,e.location,e.area
        FROM external_records e WHERE ${clauses.join(' AND ')} ORDER BY e.occurred_at`,
      )
      .all(...params) as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      provider: String(row.provider),
      type: String(row.type),
      title: String(row.title),
      sender: row.sender ? String(row.sender) : null,
      occurredAt: String(row.occurredAt),
      endAt: row.endAt ? String(row.endAt) : null,
      sourceUrl: row.sourceUrl ? String(row.sourceUrl) : null,
      location: row.location ? String(row.location) : null,
      area: String(row.area) as Area,
      detectedDueAt: null,
      classificationState: 'synced',
      archived: false,
    }));
  }

  private itemToEntry(item: Item): ScheduleEntry {
    return {
      id: item.id,
      kind: 'item',
      title: item.title,
      area: item.area,
      startsAt: item.dueAt ?? item.updatedAt,
      endsAt: item.dueAt ?? null,
      item,
      courseId: item.courseId ?? undefined,
      courseName: item.courseName ?? undefined,
      sourceUrl: item.sourceUrl ?? null,
    };
  }

  private buildEntries(options: { area?: Area; from: Date; to: Date }): ScheduleEntry[] {
    const items = this.openItems(options.area).filter((item) => {
      if (!item.dueAt) return false;
      const due = new Date(item.dueAt);
      return isWithinInterval(due, { start: options.from, end: options.to });
    });
    const itemEntries = items.map((item) => this.itemToEntry(item));
    const covered = new Set<string>();
    for (const assessment of this.assessments(options.area)) {
      if (!assessment.scheduledAt) continue;
      const when = new Date(assessment.scheduledAt);
      if (!isWithinInterval(when, { start: options.from, end: options.to })) continue;
      if (items.some((item) => assessmentCoveredByItem(assessment, item))) {
        covered.add(assessment.id);
      }
    }
    const assessmentEntries = this.assessments(options.area)
      .filter((a) => a.scheduledAt && !covered.has(a.id))
      .filter((a) => isWithinInterval(new Date(a.scheduledAt!), { start: options.from, end: options.to }))
      .map((a) => ({
        id: `assessment:${a.id}`,
        kind: 'assessment' as const,
        title: a.title,
        area: a.area,
        startsAt: a.scheduledAt!,
        endsAt: a.scheduledAt,
        assessmentId: a.id,
        courseId: a.courseId,
        courseName: a.courseName,
        assessmentType: a.type,
        sourceUrl: a.sourceUrl,
      }));
    const calendarEntries = this.calendarEvents(options.area, options.from, options.to).map((event) => ({
      id: `calendar:${event.id}`,
      kind: 'calendar-event' as const,
      title: event.title,
      area: event.area,
      startsAt: event.occurredAt,
      endsAt: event.endAt ?? event.occurredAt,
      calendarRecordId: event.id,
      sourceUrl: event.sourceUrl,
      location: event.location,
    }));
    return [...itemEntries, ...assessmentEntries, ...calendarEntries].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  getTodayView(area?: Area): TodayView {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const open = this.openItems(area);
    const overdue = open
      .filter((item) => item.dueAt && new Date(item.dueAt) < todayStart)
      .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    const dueToday = open.filter((item) => item.dueAt && isWithinInterval(new Date(item.dueAt), { start: todayStart, end: todayEnd }));
    const scheduledTypes = new Set(['class', 'meeting', 'recording', 'reminder']);
    const scheduledToday = this.buildEntries({ area, from: todayStart, to: todayEnd }).filter(
      (entry) => entry.kind !== 'item' || scheduledTypes.has(entry.item?.type ?? ''),
    );
    const plannedToday = dueToday.filter((item) => !scheduledTypes.has(item.type));
    return {
      overdue,
      dueToday,
      scheduledToday,
      plannedToday,
      capacity: this.getSetting('dailyCapacity') ?? 'normal',
    };
  }

  getUpcomingView(days: 7 | 14 | 30, area?: Area): UpcomingView {
    const now = startOfDay(new Date());
    const end7 = endOfDay(addDays(now, 7));
    const end30 = endOfDay(addDays(now, 30));
    const horizon = endOfDay(addDays(now, days));
    const all = this.buildEntries({ area, from: now, to: horizon });
    const buckets: UpcomingBucket[] = [
      { label: 'next-7', entries: all.filter((e) => new Date(e.startsAt) <= end7) },
      { label: 'next-30', entries: all.filter((e) => new Date(e.startsAt) > end7 && new Date(e.startsAt) <= end30) },
      { label: 'later', entries: all.filter((e) => new Date(e.startsAt) > end30) },
    ];
    if (days === 7) return { buckets: [buckets[0]], capacity: this.getSetting('dailyCapacity') ?? 'normal' };
    if (days === 14) return { buckets: [buckets[0], { label: 'next-30', entries: buckets[1].entries }], capacity: this.getSetting('dailyCapacity') ?? 'normal' };
    return { buckets, capacity: this.getSetting('dailyCapacity') ?? 'normal' };
  }

  getCalendarMonth(year: number, month: number, selectedDate: string, area?: Area): CalendarMonthView {
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(monthStart);
    const entries = this.buildEntries({ area, from: monthStart, to: monthEnd });
    const days: CalendarDaySummary[] = [];
    for (let cursor = monthStart; cursor <= monthEnd; cursor = addDays(cursor, 1)) {
      const key = formatISO(cursor, { representation: 'date' });
      days.push({
        date: key,
        entries: entries.filter((entry) => entry.startsAt.slice(0, 10) === key),
      });
    }
    const selectedAgenda = entries.filter((entry) => entry.startsAt.slice(0, 10) === selectedDate);
    return { year, month, days, selectedDate, selectedAgenda };
  }
}
