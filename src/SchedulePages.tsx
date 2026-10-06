import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Area, Item, ScheduleEntry, TodayView } from '@shared/contracts';

const api = window.commandCentre;
const areaNames: Record<Area, string> = { IITM: 'IIT Madras', MANIPAL: 'Manipal', EXORA: 'Exora', PERSONAL: 'Personal' };
const areaClass: Record<Area, string> = { IITM: 'iitm', MANIPAL: 'manipal', EXORA: 'exora', PERSONAL: 'personal' };

function Badge({ area }: { area: Area }) {
  return <span className={`area-badge ${areaClass[area]}`}>{areaNames[area]}</span>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty"><strong>{title}</strong><span>{detail}</span></div>;
}
function formatDue(value: string | null | undefined) {
  if (!value) return 'No date';
  const date = new Date(value);
  return format(date, 'EEE, d MMM · HH:mm');
}

function ItemRow({ item, onChange, onEdit }: { item: Item; onChange?: () => void; onEdit?: (item: Item) => void }) {
  const done = item.status === 'done';
  return (
    <div className={`item-row ${done ? 'is-done' : ''}`}>
      <button className="complete" aria-label={done ? 'Completed' : 'Mark complete'} onClick={async () => { if (!done) { await api.completeItem(item.id); onChange?.(); } }}>{done ? <CheckCircle2 size={17} /> : <Circle size={17} />}</button>
      <button className="item-main" onClick={() => onEdit?.(item)}>
        <span className="item-title">{item.title}</span>
        <span className="item-meta"><Badge area={item.area} />{item.courseName && <span>{item.courseName}</span>}<span>{formatDue(item.dueAt)}</span></span>
      </button>
      <span className={`priority p-${item.priority}`}>{item.priority}</span>
    </div>
  );
}

function ScheduleRow({ entry, onEdit }: { entry: ScheduleEntry; onEdit?: (item: Item) => void }) {
  if (entry.kind === 'item' && entry.item) return <ItemRow item={entry.item} onEdit={onEdit} />;
  return (
    <div className="item-row">
      <div className="item-main">
        <span className="item-title">{entry.title}</span>
        <span className="item-meta">
          <Badge area={entry.area} />
          <span>{entry.kind === 'assessment' ? `Assessment · ${entry.assessmentType}` : 'Calendar event'}</span>
          <span>{formatDue(entry.startsAt)}</span>
          {entry.courseName && <span>{entry.courseName}</span>}
        </span>
      </div>
    </div>
  );
}

function AreaFilter({ area, onChange }: { area: Area | ''; onChange: (area: Area | '') => void }) {
  return (
    <div className="filter-row">
      <button className={!area ? 'active' : ''} onClick={() => onChange('')}>All</button>
      {(Object.keys(areaNames) as Area[]).map((value) => (
        <button key={value} className={area === value ? 'active' : ''} onClick={() => onChange(value)}>{areaNames[value]}</button>
      ))}
    </div>
  );
}

export function TodayPage({ refresh, onEdit }: { refresh: number; onEdit: (item: Item) => void }) {
  const [area, setArea] = useState<Area | ''>('');
  const [data, setData] = useState<TodayView>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    api.getTodayView(area || undefined).then(setData).catch(() => setError('Could not load Today.')).finally(() => setLoading(false));
  }, [area, refresh]);
  useEffect(() => { reload(); }, [reload]);
  if (loading) return <div className="state"><span className="spinner" />Loading…</div>;
  if (error || !data) return <div className="state error">{error || 'Could not load Today.'}</div>;
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">Execution</span><h2>Today</h2><p>Overdue first, then what is scheduled and what you planned for today.</p></div>
        <AreaFilter area={area} onChange={setArea} />
      </div>
      <section className="section"><div className="section-head"><h2>Overdue<span>{data.overdue.length}</span></h2></div>{data.overdue.length ? data.overdue.map((item) => <ItemRow key={item.id} item={item} onChange={reload} onEdit={onEdit} />) : <Empty title="Nothing overdue" detail="You are caught up on past deadlines." />}</section>
      <section className="section"><div className="section-head"><h2>Scheduled today<span>{data.scheduledToday.length}</span></h2></div>{data.scheduledToday.length ? data.scheduledToday.map((entry) => <ScheduleRow key={entry.id} entry={entry} onEdit={onEdit} />) : <Empty title="No timed events" detail="Classes, meetings, and calendar events appear here." />}</section>
      <section className="section"><div className="section-head"><h2>Due today<span>{data.plannedToday.length}</span></h2></div>{data.plannedToday.length ? data.plannedToday.map((item) => <ItemRow key={item.id} item={item} onChange={reload} onEdit={onEdit} />) : <Empty title="No flexible tasks due today" detail="Use Quick Add when something new appears." />}</section>
    </div>
  );
}

export function UpcomingPage({ refresh, onEdit }: { refresh: number; onEdit: (item: Item) => void }) {
  const [area, setArea] = useState<Area | ''>('');
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [buckets, setBuckets] = useState<{ label: string; entries: ScheduleEntry[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    api.getUpcomingView(days, area || undefined).then((view) => setBuckets(view.buckets)).finally(() => setLoading(false));
  }, [area, days, refresh]);
  useEffect(() => { reload(); }, [reload]);
  const labels: Record<string, string> = { 'next-7': 'Next 7 days', 'next-30': 'Next 30 days', later: 'Later' };
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">Horizon</span><h2>Upcoming</h2><p>Tasks, assessments, and calendar events in chronological order.</p></div>
        <div className="segmented">{[7, 14, 30].map((n) => <button key={n} className={days === n ? 'active' : ''} onClick={() => setDays(n as 7 | 14 | 30)}>{n} days</button>)}</div>
      </div>
      <AreaFilter area={area} onChange={setArea} />
      {loading ? <div className="state"><span className="spinner" />Loading…</div> : buckets.map((bucket) => (
        <section className="section" key={bucket.label}>
          <div className="section-head"><h2>{labels[bucket.label] ?? bucket.label}<span>{bucket.entries.length}</span></h2></div>
          {bucket.entries.length ? bucket.entries.map((entry) => <ScheduleRow key={entry.id} entry={entry} onEdit={onEdit} />) : <Empty title="Nothing here" detail="This window is clear." />}
        </section>
      ))}
    </div>
  );
}

export function CalendarPage({ refresh }: { refresh: number }) {
  const [area, setArea] = useState<Area | ''>('');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monthView, setMonthView] = useState<Awaited<ReturnType<typeof api.getCalendarMonth>>>();
  const reload = useCallback(() => {
    api.getCalendarMonth({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, selectedDate, area: area || undefined }).then(setMonthView);
  }, [cursor, selectedDate, area, refresh]);
  useEffect(() => { reload(); }, [reload]);
  const weeks = useMemo(() => {
    if (!monthView) return [];
    const chunks: typeof monthView.days[] = [];
    for (let i = 0; i < monthView.days.length; i += 7) chunks.push(monthView.days.slice(i, i + 7));
    return chunks;
  }, [monthView]);
  return (
    <div className="page calendar-page">
      <div className="page-heading">
        <div><span className="eyebrow">Unified schedule</span><h2>Calendar</h2><p>Month view with a focused agenda for the selected day.</p></div>
        <div className="calendar-nav">
          <button onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft size={16} /></button>
          <strong>{format(cursor, 'MMMM yyyy')}</strong>
          <button onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <AreaFilter area={area} onChange={setArea} />
      <div className="calendar-layout">
        <div className="month-grid">
          {weeks.map((week) => (
            <div className="month-week" key={week[0]?.date}>
              {week.map((day) => (
                <button key={day.date} className={`month-day ${selectedDate === day.date ? 'selected' : ''} ${day.entries.length ? 'has-events' : ''}`} onClick={() => setSelectedDate(day.date)}>
                  <span>{format(new Date(`${day.date}T12:00:00`), 'd')}</span>
                  {day.entries.length > 0 && <i />}
                </button>
              ))}
            </div>
          ))}
        </div>
        <aside className="day-agenda">
          <h3>{format(new Date(`${selectedDate}T12:00:00`), 'EEEE, d MMMM')}</h3>
          {monthView?.selectedAgenda.length ? monthView.selectedAgenda.map((entry) => <ScheduleRow key={entry.id} entry={entry} />) : <Empty title="Nothing scheduled" detail="Pick another day or add an item." />}
        </aside>
      </div>
    </div>
  );
}

function bucketItems(items: Item[]) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const open = items.filter((item) => item.status !== 'done');
  return {
    today: open.filter((item) => item.dueAt && new Date(item.dueAt) >= start && new Date(item.dueAt) <= end),
    upcoming: open.filter((item) => item.dueAt && new Date(item.dueAt) > end),
    waiting: open.filter((item) => item.status === 'doing'),
    someday: open.filter((item) => !item.dueAt),
    completed: items.filter((item) => item.status === 'done'),
  };
}

export function AreaWorkspacePage({ area, refresh, onEdit }: { area: 'EXORA' | 'PERSONAL'; refresh: number; onEdit: (item: Item) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const reload = useCallback(() => { api.getItems({ area }).then(setItems); }, [area, refresh]);
  useEffect(() => { reload(); }, [reload]);
  const buckets = bucketItems(items);
  const sections: Array<{ title: string; list: Item[] }> = area === 'EXORA'
    ? [
        { title: 'Today', list: buckets.today },
        { title: 'Upcoming', list: buckets.upcoming },
        { title: 'Waiting', list: buckets.waiting },
        { title: 'Someday / Backlog', list: buckets.someday },
        { title: 'Completed', list: buckets.completed },
      ]
    : [
        { title: 'Today', list: buckets.today },
        { title: 'Upcoming', list: buckets.upcoming },
        { title: 'Someday', list: buckets.someday },
        { title: 'Completed', list: buckets.completed },
      ];
  return (
    <div className="page">
      <div className="institution-head">
        <div><Badge area={area} /><h2>{areaNames[area]}</h2><p>{area === 'EXORA' ? 'Personal work management without CRM noise.' : 'Lightweight personal tasks and reminders.'}</p></div>
      </div>
      {sections.map(({ title, list }) => (
        <section className="section" key={title}>
          <div className="section-head"><h2>{title}<span>{list.length}</span></h2></div>
          {list.length ? list.map((item) => <ItemRow key={item.id} item={item} onChange={reload} onEdit={onEdit} />) : <Empty title={`No ${title.toLowerCase()} items`} detail="Use Quick Add to capture something." />}
        </section>
      ))}
    </div>
  );
}
