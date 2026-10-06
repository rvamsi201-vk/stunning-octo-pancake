import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import { Archive, BookOpen, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, Clock3, Command, ExternalLink, FileDown, Gauge, GraduationCap, Home, Inbox, LayoutGrid, ListTodo, Moon, Plus, Search, Settings, Sun, UserRound, Video, X } from 'lucide-react';
import { AcademicManagePage, ManageAcademicsLink } from './AcademicAdmin';
import { PortalHubPage, PortalSettingsSection } from './PortalHub';
import { AreaWorkspacePage, CalendarPage, TodayPage, UpcomingPage } from './SchedulePages';
import { courseAreaPath, formatModuleLabel, moduleProgressLabel, parseGradingKind } from './academic-utils';
import type { AcademicOverview, Area, Assessment, Course, ExternalRecord, IntegrationAccount, Item, ItemInput, ItemType, MailRoutingRule, Priority, ReviewProposal, SearchResult } from '@shared/contracts';

const areaNames: Record<Area, string> = { IITM: 'IIT Madras', MANIPAL: 'Manipal', EXORA: 'Exora', PERSONAL: 'Personal' };
const areaClass: Record<Area,string> = { IITM:'iitm', MANIPAL:'manipal', EXORA:'exora', PERSONAL:'personal' };
const api = window.commandCentre;

function useLoad<T>(loader:()=>Promise<T>, deps:unknown[]=[]){ const [data,setData]=useState<T>(); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ const reload=useCallback(()=>{setLoading(true);setError('');loader().then(setData).catch(()=>setError('Could not load this view. Your local data is safe.')).finally(()=>setLoading(false));},deps); useEffect(reload,[reload]); return {data,error,loading,reload}; }
function PageState({loading,error,children}:{loading:boolean;error:string;children:ReactNode}){ if(loading)return <div className="state"><span className="spinner"/>Loading…</div>; if(error)return <div className="state error">{error}</div>; return <>{children}</>; }
function Empty({title,detail}:{title:string;detail:string}){return <div className="empty"><Circle size={18}/><strong>{title}</strong><span>{detail}</span></div>}
function Badge({area}:{area:Area}){return <span className={`area-badge ${areaClass[area]}`}>{areaNames[area]}</span>}
function formatDue(value:string|null|undefined){if(!value)return 'No date';const date=new Date(value);return isToday(date)?format(date,"'Today' · HH:mm"):format(date,'EEE, d MMM · HH:mm')}

function ItemRow({item,onChange,onEdit}:{item:Item;onChange?:()=>void;onEdit?:(item:Item)=>void}){const done=item.status==='done';return <div className={`item-row ${done?'is-done':''}`}>
  <button className="complete" aria-label={done?'Completed':'Mark complete'} onClick={async()=>{if(!done){await api.completeItem(item.id);onChange?.();}}}>{done?<CheckCircle2 size={17}/>:<Circle size={17}/>}</button>
  <button className="item-main" onClick={()=>onEdit?.(item)}><span className="item-title">{item.title}</span><span className="item-meta"><Badge area={item.area}/>{item.courseName&&<span>{item.courseName}</span>}<span className={item.dueAt&&isPast(new Date(item.dueAt))&&!done?'overdue':''}>{formatDue(item.dueAt)}</span></span></button>
  <span className={`priority p-${item.priority}`}>{item.priority}</span>
</div>}
function Section({title,count,action,children}:{title:string;count?:number;action?:ReactNode;children:ReactNode}){return <section className="section"><div className="section-head"><h2>{title}{count!==undefined&&<span>{count}</span>}</h2>{action}</div>{children}</section>}

const nav = [
  {to:'/',label:'Home',icon:Home},{to:'/today',label:'Today',icon:ListTodo},{to:'/upcoming',label:'Upcoming',icon:Clock3},{to:'/inbox',label:'Inbox',icon:Inbox},{to:'/calendar',label:'Calendar',icon:CalendarDays},
];
function Sidebar(){return <aside className="sidebar"><div className="traffic-space"/><div className="brand"><span className="brand-mark"><Command size={15}/></span><span>Command Centre</span></div><nav>{nav.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'}><Icon size={16}/><span>{label}</span></NavLink>)}<div className="nav-label">Academics</div><NavLink to="/academics/iitm"><GraduationCap size={16}/><span>IIT Madras</span></NavLink><NavLink to="/academics/manipal"><BookOpen size={16}/><span>Manipal</span></NavLink><div className="nav-label">Work</div><NavLink to="/area/exora"><BriefcaseBusiness size={16}/><span>Exora</span></NavLink><NavLink to="/area/personal"><UserRound size={16}/><span>Personal</span></NavLink><div className="nav-label">Portals</div><NavLink to="/portals"><LayoutGrid size={16}/><span>Portal Hub</span></NavLink></nav><div className="sidebar-bottom"><NavLink to="/settings"><Settings size={16}/><span>Settings</span></NavLink><div className="shortcut-hint"><span>Search</span><kbd>⌘ K</kbd></div></div></aside>}
function Topbar({onAdd,onSearch}:{onAdd:()=>void;onSearch:()=>void}){const location=useLocation();const title=location.pathname==='/'?'Home':location.pathname.split('/').filter(Boolean).pop()?.replaceAll('-',' ')??'Home';return <header className="topbar"><h1>{title}</h1><div><button className="search-trigger" onClick={onSearch}><Search size={15}/>Search <kbd>⌘K</kbd></button><button className="primary compact" onClick={onAdd}><Plus size={15}/>New <kbd>N</kbd></button></div></header>}

function QuickAdd({item,onClose,onSaved}:{item?:Item;onClose:()=>void;onSaved:()=>void}){const [courses,setCourses]=useState<Course[]>([]);const [expanded,setExpanded]=useState(Boolean(item));const [form,setForm]=useState({title:item?.title??'',description:item?.description??'',area:item?.area??'PERSONAL',courseId:item?.courseId??'',type:item?.type??'task',priority:item?.priority??'normal',dueAt:item?.dueAt?item.dueAt.slice(0,16):''});useEffect(()=>{api.getCourses().then(setCourses)},[]);async function submit(e:FormEvent){e.preventDefault();const input={...form,courseId:form.courseId||null,dueAt:form.dueAt?new Date(form.dueAt).toISOString():null,status:item?.status??'todo'} as ItemInput;if(item)await api.updateItem({id:item.id,...input});else await api.createItem(input);onSaved();onClose();}return <div className="overlay" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><form className="modal quick-add" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">{item?'Edit item':'Quick add'}</span><h2>{item?'Update obligation':'Capture an obligation'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div><label>Title<input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What needs doing?"/></label><div className="form-grid"><label>Area<select value={form.area} onChange={e=>setForm({...form,area:e.target.value as Area,courseId:''})}>{Object.entries(areaNames).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Due date and time<input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label></div>{expanded&&<><label>Notes<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Optional context"/></label><div className="form-grid"><label>Course / project<select value={form.courseId} onChange={e=>setForm({...form,courseId:e.target.value})}><option value="">None</option>{courses.filter(c=>['IITM','MANIPAL'].includes(form.area)?c.institutionName.toUpperCase().includes(form.area==='IITM'?'IIT':'MANIPAL'):true).map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value as ItemInput['type']})}>{['task','assignment','class','exam','activity','reminder','meeting','recording'].map(v=><option key={v}>{v}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as ItemInput['priority']})}>{['low','normal','high','urgent'].map(v=><option key={v}>{v}</option>)}</select></label></div></>}{!expanded&&<button type="button" className="link-button" onClick={()=>setExpanded(true)}>More options</button>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">{item?'Save changes':'Add item'}</button></div></form></div>}

function CommandPalette({onClose,onAdd}:{onClose:()=>void;onAdd:()=>void}){const navigate=useNavigate();const [query,setQuery]=useState('');const [results,setResults]=useState<SearchResult[]>([]);useEffect(()=>{const timer=setTimeout(()=>api.search(query).then(setResults),120);return()=>clearTimeout(timer)},[query]);const destinations=[['Home','/'],['Today','/today'],['Upcoming','/upcoming'],['Inbox','/inbox'],['Calendar','/calendar'],['IIT Madras','/academics/iitm'],['Manipal','/academics/manipal'],['Exora','/area/exora'],['Personal','/area/personal'],['Portal Hub','/portals'],['Settings','/settings']].filter(([name])=>name.toLowerCase().includes(query.toLowerCase()));const actions=[['New task',()=>onAdd()],['Sync Google',async()=>{const accounts=await api.getIntegrationAccounts();for(const account of accounts)await api.syncIntegration(account.id)}],['Open academic management',()=>navigate('/academics/manage')],['Change daily capacity',async()=>{const current=await api.getSetting('dailyCapacity');const next=current==='normal'?'low':current==='low'?'recovery':'normal';await api.setSetting('dailyCapacity',next)}]] as const;const visibleActions=actions.filter(([label])=>label.toLowerCase().includes(query.toLowerCase()));return <div className="overlay palette-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="palette"><div className="palette-input"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tasks, courses, assessments and inbox…"/><kbd>esc</kbd></div><div className="palette-results">{visibleActions.length>0&&<div className="result-group"><span>Actions</span>{visibleActions.map(([label,run])=><button key={label} onClick={async()=>{await run();onClose()}}><Plus size={15}/><strong>{label}</strong></button>)}</div>}{destinations.length>0&&<div className="result-group"><span>Navigate</span>{destinations.map(([name,path])=><button key={path} onClick={()=>{navigate(path);onClose()}}><LayoutGrid size={15}/><strong>{name}</strong><ChevronRight size={14}/></button>)}</div>}{results.length>0&&<div className="result-group"><span>Results</span>{results.map(r=><button key={`${r.kind}-${r.id}`} onClick={()=>{if(r.route)navigate(r.route);onClose()}}><Search size={15}/><span><strong>{r.title}</strong><small>{r.kind} · {r.subtitle}</small></span><Badge area={r.area}/></button>)}</div>}{query&&results.length===0&&destinations.length===0&&visibleActions.length===0&&<Empty title="No results" detail="Try a title, course code, or sender."/>}</div></div></div>}

function HomePage({refresh,onEdit}:{refresh:number;onEdit:(i:Item)=>void}){const navigate=useNavigate();const {data,error,loading,reload}=useLoad(()=>api.getDashboard(),[refresh]);return <PageState loading={loading} error={error}><div className="page dashboard">{data&&<><div className="hero-line"><div><span className="eyebrow">{format(new Date(),'EEEE, d MMMM')}</span><h2>{data.overdue.length?`${data.overdue.length} overdue · ${data.today.length} for today`:'Your day is clear'}</h2><p>Capacity is <strong>{data.capacity}</strong>. Prioritisation only — nothing is hidden or postponed automatically.</p></div><Capacity value={data.capacity} onChange={reload}/></div><div className="dashboard-grid"><div><Section title="Today" count={data.today.length}>{data.today.length?data.today.slice(0,6).map(i=><ItemRow key={i.id} item={i} onChange={reload} onEdit={onEdit}/>):<Empty title="No obligations today" detail="Use quick add when something comes up."/>}</Section><Section title="Coming soon" count={data.upcoming.length}>{data.upcoming.slice(0,5).map(i=><ItemRow key={i.id} item={i} onChange={reload} onEdit={onEdit}/>)}</Section><Section title="Exora & personal">{[...(data.work??[]),...(data.personal??[])].slice(0,4).map(i=><ItemRow key={i.id} item={i} onChange={reload} onEdit={onEdit}/>)}</Section></div><div><Section title="Overdue" count={data.overdue.length}>{data.overdue.length?data.overdue.slice(0,5).map(i=><ItemRow key={i.id} item={i} onChange={reload} onEdit={onEdit}/>):<Empty title="Nothing overdue" detail="You are caught up."/>}</Section><Section title="Needs review" count={data.inbox.length} action={<button className="link-button" onClick={()=>navigate('/inbox')}>Open inbox</button>}><div className="compact-list">{data.inbox.length?data.inbox.slice(0,4).map(r=><button key={r.id} className="compact-link" onClick={()=>navigate('/inbox')}><span className="dot"/><span>{r.title}</span><Badge area={r.area}/></button>):<Empty title="Inbox is clear" detail="No proposals waiting for confirmation."/>}</div></Section><Section title="Academic snapshot"><div className="course-summary">{data.courses.slice(0,4).map(c=>{const complete=c.modules.filter(m=>m.completed).length;return <div key={c.id}><div><strong>{c.code||c.name}</strong><span>{c.name}</span></div><span>{complete}/{c.modules.length||1} units</span><div className="progress"><i style={{width:`${complete/(c.modules.length||1)*100}%`}}/></div></div>})}</div>{data.upcomingAssessments&&data.upcomingAssessments.length>0&&<div className="compact-list">{data.upcomingAssessments.map(a=><div key={a.id}><span className="dot"/><span>{a.title}</span><small>{a.course.code}</small></div>)}</div>}</Section></div></div></>}</div></PageState>}
function Capacity({value,onChange}:{value:string;onChange:()=>void}){return <div className="capacity"><Gauge size={16}/>{['normal','low','recovery'].map(v=><button className={value===v?'active':''} key={v} onClick={async()=>{await api.setSetting('dailyCapacity',v);onChange()}}>{v}</button>)}</div>}

function proposalKindLabel(kind:string){return ({deadline:'Assignment deadline',activity:'Activity',assessment:'Exam / quiz','class-session':'Class session',item:'Task',review:'Review','new-course':'New course'}[kind]??kind)}
function proposalTypeLabel(proposal:ReviewProposal){return String(proposal.proposedData?.itemType??proposal.kind)}
function ProposalEditModal({proposal,record,courses,onClose,onSave}:{proposal:ReviewProposal;record:ExternalRecord;courses:Course[];onClose:()=>void;onSave:(edits:NonNullable<Parameters<typeof api.actOnProposal>[0]['edits']>)=>Promise<void>}){const [form,setForm]=useState({title:proposal.title,courseId:proposal.courseId??'',type:(proposal.proposedData?.itemType as ItemType|undefined)??'assignment',priority:'normal' as Priority,dueAt:proposal.proposedDueAt?proposal.proposedDueAt.slice(0,16):''});const filtered=courses.filter(c=>c.institutionName.toUpperCase().includes(record.area==='IITM'?'IIT':record.area==='MANIPAL'?'MANIPAL':record.area));return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal quick-add" onSubmit={async e=>{e.preventDefault();await onSave({title:form.title,courseId:form.courseId||null,type:form.type,priority:form.priority,dueAt:form.dueAt?new Date(form.dueAt).toISOString():null});onClose()}}><div className="modal-head"><div><span className="eyebrow">Edit proposal</span><h2>Confirm with corrections</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div><label>Title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-grid"><label>Course<select value={form.courseId} onChange={e=>setForm({...form,courseId:e.target.value})}><option value="">Select course</option>{filtered.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value as ItemType})}>{['task','assignment','class','exam','activity','reminder','meeting','recording'].map(v=><option key={v}>{v}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}>{['low','normal','high','urgent'].map(v=><option key={v}>{v}</option>)}</select></label></div><label>Due date and time<input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Confirm</button></div></form></div>}
function InboxPage({onChanged}:{onChanged:()=>void}){const [area,setArea]=useState<Area|''>('');const [query,setQuery]=useState('');const [state,setState]=useState<'needs_review'|'confirmed'|'ignored'>('needs_review');const [courses,setCourses]=useState<Course[]>([]);const [editing,setEditing]=useState<{proposal:ReviewProposal;record:ExternalRecord}|null>(null);const [toast,setToast]=useState('');const {data=[],error,loading,reload}=useLoad(()=>api.getInbox({area:area||undefined,state,query:query||undefined}),[area,state,query]);useEffect(()=>{api.getCourses().then(setCourses)},[]);useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2400);return()=>clearTimeout(timer)},[toast]);async function act(record:ExternalRecord,action:'archive'|'create-task'|'confirm-deadline'){await api.actOnExternalRecord({id:record.id,action});reload();onChanged()}async function submitProposal(proposal:ReviewProposal,action:'confirm'|'ignore',edits?:NonNullable<Parameters<typeof api.actOnProposal>[0]['edits']>){await api.actOnProposal({id:proposal.id,action,edits});setToast(action==='confirm'?'Added to your academic records.':'Proposal ignored.');reload();onChanged()}return <PageState loading={loading} error={error}><div className="page"><div className="page-heading inbox-heading"><div><span className="eyebrow">Triage, don’t automate</span><h2>Inbox</h2><p>Review routed academic proposals, confirm once, and keep the source email linked.</p></div><div className="inbox-filters"><div className="filter-row"><button className={!area?'active':''} onClick={()=>setArea('')}>All</button>{(Object.keys(areaNames) as Area[]).map(value=><button key={value} className={area===value?'active':''} onClick={()=>setArea(value)}>{areaNames[value]}</button>)}</div><div className="filter-row"><button className={state==='needs_review'?'active':''} onClick={()=>setState('needs_review')}>Needs review</button><button className={state==='confirmed'?'active':''} onClick={()=>setState('confirmed')}>Confirmed</button><button className={state==='ignored'?'active':''} onClick={()=>setState('ignored')}>Ignored</button></div></div></div><div className="search-trigger inbox-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, sender, or snippet"/></div>{toast&&<div className="toast-banner">{toast}</div>}{data.length?data.map(r=>{const proposal=r.proposals?.[0];return <article className="inbox-card" key={r.id}><div className="inbox-icon"><Inbox size={17}/></div><div><div className="inbox-top"><Badge area={r.area}/><span>{r.provider}{r.accountEmail&&` · ${r.accountEmail}`}</span><time>{format(new Date(r.occurredAt),'d MMM · HH:mm')}</time></div><h3>{r.title}</h3><p className="record-source">{r.sender??'Unknown sender'}{r.location&&` · ${r.location}`}</p>{r.snippet&&<p className="record-snippet">{r.snippet}</p>}{proposal&&<div className="proposal proposal-card"><div className="proposal-meta"><span>{proposal.institutionName??areaNames[r.area]}</span>{proposal.courseName&&<span>{proposal.courseName}</span>}<span>{proposalKindLabel(proposal.kind)}</span><span>{proposalTypeLabel(proposal)}</span>{proposal.proposedDueAt&&<span>{formatDue(proposal.proposedDueAt)}</span>}{proposal.confidence>=0.75&&proposal.reasons[0]&&<span className="proposal-reason">{proposal.reasons[0]}</span>}</div><strong>{proposal.kind==='new-course'?`Add course ${String(proposal.proposedData.code??'')}`:proposal.title}</strong><p className="record-source">From email: {r.title}</p><div className="actions"><button onClick={()=>submitProposal(proposal,'confirm')}><Check size={14}/>{proposal.kind==='new-course'?'Add course':'Confirm'}</button><button onClick={()=>setEditing({proposal,record:r})}>Edit</button><button onClick={()=>submitProposal(proposal,'ignore')}><Archive size={14}/>Ignore</button><button disabled={!r.sourceUrl} onClick={()=>r.sourceUrl&&api.openOriginal(r.sourceUrl)}><ExternalLink size={14}/>Open original</button></div></div>}{state==='needs_review'&&!proposal&&<div className="actions"><button onClick={()=>act(r,'create-task')}><Plus size={14}/>Create task</button><button disabled={!r.sourceUrl} onClick={()=>r.sourceUrl&&api.openOriginal(r.sourceUrl)}><ExternalLink size={14}/>Open original</button><button onClick={()=>act(r,'archive')}><Archive size={14}/>Archive</button></div>}</div></article>}):<Empty title="No records in this view" detail="Try another Area or review state."/>}{editing&&<ProposalEditModal proposal={editing.proposal} record={editing.record} courses={courses} onClose={()=>setEditing(null)} onSave={edits=>submitProposal(editing.proposal,'confirm',edits)}/>}</div></PageState>}

function paramToArea(param?: string): Area {
  const key = (param ?? 'iitm').toUpperCase();
  if (key === 'MANIPAL') return 'MANIPAL';
  if (key === 'EXORA') return 'EXORA';
  if (key === 'PERSONAL') return 'PERSONAL';
  return 'IITM';
}

function AcademicPage({ institution }: { institution: 'IITM' | 'MANIPAL' }) {
  const { data, error, loading, reload } = useLoad(() => api.getAcademicOverview(institution), [institution]);
  if (institution === 'MANIPAL') return <PageState loading={loading} error={error}>{data ? <ManipalOverview data={data} reload={reload} /> : null}</PageState>;
  return <PageState loading={loading} error={error}>{data ? <IitmOverview data={data} /> : null}</PageState>;
}

function institutionCourseGrid(data: AcademicOverview, area: Area, navigate: ReturnType<typeof useNavigate>) {
  return (
    <div className="course-grid">
      {data.courses.map((c) => {
        const complete = c.modules.filter((m) => m.completed).length;
        const next = c.assessments.find((a) => a.scheduledAt && new Date(a.scheduledAt) > new Date());
        const moduleCount = c.modules.length || 1;
        const unitWord = moduleProgressLabel(c.moduleUnitLabel);
        return (
          <button className="course-card" key={c.id} onClick={() => navigate(courseAreaPath(area, c.id))}>
            <div className="course-code">
              {c.code || c.name}
              <ChevronRight size={17} />
            </div>
            <h3>{c.name}</h3>
            <p>
              {c.credits} credits · {complete} of {c.modules.length} {unitWord} complete
            </p>
            <div className="progress">
              <i style={{ width: `${(complete / moduleCount) * 100}%` }} />
            </div>
            {next && (
              <div className="next-assessment">
                <CalendarDays size={14} />
                <span>Next: {next.title}</span>
                <strong>{format(new Date(next.scheduledAt!), 'd MMM')}</strong>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function IitmOverview({ data }: { data: AcademicOverview }) {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="institution-head">
        <div>
          <Badge area="IITM" />
          <h2>{data.institution.name}</h2>
          <p>
            {data.term?.name} · starts {data.term?.startsAt && format(new Date(data.term.startsAt), 'd MMMM yyyy')}
          </p>
        </div>
        <div className="institution-actions">
          <ManageAcademicsLink area="IITM" />
          <div className="term-state">{data.term?.status}</div>
        </div>
      </div>
      {institutionCourseGrid(data, 'IITM', navigate)}
      <Section title="Upcoming assessments">
        <div className="timeline-list">
          {data.courses
            .flatMap((c) => c.assessments.map((a) => ({ ...a, course: c })))
            .filter((a) => a.scheduledAt)
            .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
            .map((a) => (
              <div key={a.id}>
                <span>{format(new Date(a.scheduledAt!), 'd MMM')}</span>
                <i />
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.course.code || a.course.name} · {a.type}
                  </small>
                </div>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}

function ManipalOverview({ data, reload }: { data: AcademicOverview; reload: () => void }) {
  const navigate = useNavigate();
  async function recording(item: Item) {
    await api.updateItem({ id: item.id, type: 'recording', status: 'todo', description: 'Missed live session — recording required.' });
    reload();
  }
  return (
    <div className="page">
      <div className="institution-head">
        <div>
          <Badge area="MANIPAL" />
          <h2>{data.institution.name}</h2>
          <p>{data.term?.name ?? 'Live learning and recording follow-through'}</p>
        </div>
        <div className="institution-actions">
          <ManageAcademicsLink area="MANIPAL" />
          {data.term && <div className="term-state">{data.term.status}</div>}
        </div>
      </div>
      {data.courses.length > 0 && institutionCourseGrid(data, 'MANIPAL', navigate)}
      <Section title="Live sessions" count={data.items.filter((i) => i.type === 'class').length}>
        {data.items.filter((i) => i.type === 'class').map((i) => (
          <div className="session-row" key={i.id}>
            <div className="session-time">
              <strong>{format(new Date(i.dueAt!), 'HH:mm')}</strong>
              <span>{format(new Date(i.dueAt!), 'd MMM')}</span>
            </div>
            <div>
              <h3>{i.title}</h3>
              <p>{i.status === 'done' ? 'Completed' : isPast(new Date(i.dueAt!)) ? 'Session passed · choose follow-up' : 'Live attendance planned'}</p>
            </div>
            <div className="actions">
              {i.status !== 'done' && (
                <>
                  <button onClick={() => api.completeItem(i.id).then(reload)}>
                    <Check size={14} />
                    Attended
                  </button>
                  <button onClick={() => recording(i)}>
                    <Video size={14} />
                    Recording required
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Section>
      <Section title="Recording queue" count={data.items.filter((i) => i.type === 'recording' && i.status !== 'done').length}>
        {data.items.filter((i) => i.type === 'recording' && i.status !== 'done').length ? (
          data.items
            .filter((i) => i.type === 'recording' && i.status !== 'done')
            .map((i) => (
              <div className="session-row" key={i.id}>
                <Video size={18} />
                <div>
                  <h3>{i.title}</h3>
                  <p>Remains actionable until watched</p>
                </div>
                <button onClick={() => api.completeItem(i.id).then(reload)}>Mark watched</button>
              </div>
            ))
        ) : (
          <Empty title="No recordings waiting" detail="Missed sessions can be moved here." />
        )}
      </Section>
    </div>
  );
}

function CoursePage() {
  const { courseId } = useParams();
  const { data: course, error, loading, reload } = useLoad(() => (courseId ? api.getCourse(courseId) : Promise.resolve(null)), [courseId]);
  return (
    <PageState loading={loading} error={error}>
      {course ? <CourseView course={course} reload={reload} /> : <div className="page"><Empty title="Course not found" detail="It may have been archived or belongs to another institution." /></div>}
    </PageState>
  );
}

function CourseView({ course, reload }: { course: Course; reload: () => void }) {
  const area = (course.institutionShortName ?? paramToArea(undefined)) as Area;
  const progressTitle = (course.moduleUnitLabel ?? 'week') === 'module' ? 'Module progress' : 'Weekly progress';
  const { data: courseItems = [] } = useLoad(() => api.getItems({ area }), [course.id, area]);
  const upcomingWork = courseItems.filter((i) => i.courseId === course.id && i.status !== 'done' && i.dueAt).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  const scores = Object.fromEntries(course.assessments.map((a) => [a.title, a.score ?? 0]));
  const [scenario, setScenario] = useState({ q1: Number(scores['Quiz 1'] ?? 0), q2: Number(scores['Quiz 2'] ?? 0), final: Number(scores['End Term'] ?? 0) });
  const showTScore = parseGradingKind(course.gradingConfig) === 'max-of-two';
  const base = Math.max(0.6 * scenario.final + 0.3 * Math.max(scenario.q1, scenario.q2), 0.45 * scenario.final + 0.25 * scenario.q1 + 0.3 * scenario.q2);
  async function score(a: Assessment, value: string) {
    await api.setAssessmentScore(a.id, value === '' ? null : Number(value));
    reload();
  }
  return (
    <div className="page course-page">
      <div className="course-hero">
        <span className="course-code">{course.code || course.name}</span>
        <h2>{course.name}</h2>
        <p>
          {course.termName} · {course.credits} credits · {course.institutionName}
        </p>
        {course.notes && <p className="record-source">{course.notes}</p>}
      </div>
      <div className="course-layout">
        <div>
          <Section title="Upcoming work" count={upcomingWork.length}>
            {upcomingWork.length ? (
              upcomingWork.map((item) => (
                <div className="session-row" key={item.id}>
                  <div className="session-time">
                    <strong>{format(new Date(item.dueAt!), 'HH:mm')}</strong>
                    <span>{format(new Date(item.dueAt!), 'd MMM')}</span>
                  </div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.type}
                      {item.sourceUrl && (
                        <>
                          {' '}
                          ·{' '}
                          <button className="link-button" onClick={() => api.openOriginal(item.sourceUrl!)}>
                            Open original
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Empty title="No confirmed work yet" detail="Confirm an academic inbox proposal to add course deadlines here." />
            )}
          </Section>
          <Section title={progressTitle} count={course.modules.filter((m) => m.completed).length}>
            <div className="modules">
              {course.modules.map((m) => (
                <label key={m.id} className={m.completed ? 'complete' : ''}>
                  <input
                    type="checkbox"
                    checked={m.completed}
                    onChange={async (e) => {
                      await api.setModuleCompletion(m.id, e.target.checked);
                      reload();
                    }}
                  />
                  <span className="week">{formatModuleLabel(course.moduleUnitLabel, m.weekNumber)}</span>
                  <span>
                    <strong>{m.title}</strong>
                    <small>{m.topics.join(' · ')}</small>
                  </span>
                  <CheckCircle2 size={17} />
                </label>
              ))}
            </div>
          </Section>
        </div>
        <aside>
          <Section title="Assessments / activities">
            <div className="assessments">
              {course.assessments.map((a) => (
                <div key={a.id}>
                  <div>
                    <strong>{a.title}</strong>
                    <span>
                      {a.scheduledAt ? format(new Date(a.scheduledAt), 'd MMM yyyy') : 'Unscheduled'}
                      {a.peerReviewAt && ` · review ${format(new Date(a.peerReviewAt), 'd MMM')}`}
                      {a.sourceUrl && (
                        <>
                          {' '}
                          ·{' '}
                          <button className="link-button" onClick={() => api.openOriginal(a.sourceUrl!)}>
                            Source email
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  <label>
                    Score
                    <input type="number" min="0" max={a.maximumScore ?? 100} placeholder="—" defaultValue={a.score ?? ''} onBlur={(e) => score(a, e.target.value)} />
                  </label>
                </div>
              ))}
            </div>
          </Section>
          {showTScore && (
            <Section title="T-score scenario">
              <div className="calculator">
                {[
                  ['Quiz 1', 'q1'],
                  ['Quiz 2', 'q2'],
                  ['End term', 'final'],
                ].map(([label, key]) => (
                  <label key={key}>
                    {label}
                    <input type="number" min="0" max="100" value={scenario[key as keyof typeof scenario]} onChange={(e) => setScenario({ ...scenario, [key]: Number(e.target.value) })} />
                  </label>
                ))}
                <div className="score-result">
                  <span>Base T</span>
                  <strong>{base.toFixed(2)}</strong>
                </div>
                <p>Higher of the two configured formulas. Bonus is tracked separately and never establishes the underlying pass.</p>
              </div>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

function MailRules({account}:{account:IntegrationAccount}){const {data=[],reload}=useLoad(()=>api.getMailRoutingRules(account.id),[account.id]);const [action,setAction]=useState<'include'|'ignore'>('include');const [matchType,setMatchType]=useState<MailRoutingRule['matchType']>('sender-domain');const [value,setValue]=useState('');const [target,setTarget]=useState<Area>('PERSONAL');const [busy,setBusy]=useState(false);async function add(e:FormEvent){e.preventDefault();setBusy(true);try{await api.addMailRoutingRule({accountId:account.id,action,matchType,matchValue:value,targetArea:action==='include'?target:null});setValue('');reload()}finally{setBusy(false)}}return <details className="routing-rules"><summary>Mail routing <span>{data.length} rules</span></summary><p className="routing-help">Google is the source account. Rules decide which messages enter Command Centre and where they belong.</p><form className="rule-form" onSubmit={add}><select value={action} onChange={e=>setAction(e.target.value as 'include'|'ignore')} aria-label="Rule action"><option value="include">Always include</option><option value="ignore">Always ignore</option></select><select value={matchType} onChange={e=>setMatchType(e.target.value as MailRoutingRule['matchType'])} aria-label="Rule match type"><option value="sender">Sender</option><option value="sender-domain">Sender domain</option><option value="recipient">Original recipient</option><option value="label">Gmail label</option><option value="institution-domain">Institution domain</option></select><input required value={value} onChange={e=>setValue(e.target.value)} placeholder={matchType.includes('domain')?'example.edu':'value to match'}/>{action==='include'&&<select value={target} onChange={e=>setTarget(e.target.value as Area)} aria-label="Route to area">{Object.entries(areaNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>}<button disabled={busy} type="submit"><Plus size={13}/>Add rule</button></form>{data.length>0&&<div className="rule-list">{data.map(rule=><div key={rule.id}><span className={`rule-action ${rule.action}`}>{rule.action}</span><strong>{rule.matchType}</strong><code>{rule.matchValue}</code>{rule.targetArea&&<><ChevronRight size={12}/><Badge area={rule.targetArea}/></>}<button aria-label="Delete routing rule" onClick={async()=>{await api.deleteMailRoutingRule(rule.id);reload()}}><X size={13}/></button></div>)}</div>}<button className="reevaluate" disabled={busy} onClick={async()=>{setBusy(true);try{await api.reevaluateInbox(account.id);reload()}finally{setBusy(false)}}}><Archive size={13}/>Re-evaluate Inbox</button></details>}
function ConnectedAccounts(){const {data=[],loading,error,reload}=useLoad(()=>api.getIntegrationAccounts(),[]);const [area,setArea]=useState<Area>('IITM');const [busy,setBusy]=useState('');const [notice,setNotice]=useState('');async function run(id:string,operation:()=>Promise<unknown>){setBusy(id);setNotice('');try{await operation();reload()}catch(e){setNotice(e instanceof Error?e.message:'The account operation could not be completed.')}finally{setBusy('')}}async function connect(){setBusy('connect');setNotice('');try{await api.connectGoogle({area,label:`${areaNames[area]} Google`});reload()}catch(e){setNotice(e instanceof Error?e.message:'Google sign-in was cancelled or failed.')}finally{setBusy('')}}return <Section title="Connected accounts"><div className="connect-toolbar"><select value={area} onChange={e=>setArea(e.target.value as Area)} aria-label="Initial account area">{Object.entries(areaNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button onClick={connect} disabled={Boolean(busy)}><Plus size={15}/>{busy==='connect'?'Waiting for browser…':'Connect Google Account'}</button></div>{notice&&<div className="account-error">{notice}</div>}<PageState loading={loading} error={error}>{data.length?<div className="account-list">{data.map((account:IntegrationAccount)=><div className="account-card" key={account.id}><div className="account-provider">G</div><div className="account-detail"><strong>{account.label}</strong><p>{account.email} · default {areaNames[account.area]}</p><small>{account.scopes.map(s=>s.split('/').pop()).join(' · ')}</small>{account.lastSyncAt&&<small>Last successful sync {format(new Date(account.lastSyncAt),'d MMM yyyy · HH:mm')}</small>}{account.lastSyncAttemptAt&&<small>Last attempt {format(new Date(account.lastSyncAttemptAt),'d MMM yyyy · HH:mm')}</small>}{account.lastSyncError&&<small className="account-error">{account.lastSyncError}</small>}<MailRules account={account}/></div><div className="account-controls"><span className={`sync-state ${account.status}`}>{account.status.replaceAll('_',' ')}</span><button disabled={busy===account.id} onClick={()=>run(account.id,()=>api.syncIntegration(account.id))}>Sync now</button><button disabled={busy===account.id} onClick={()=>run(account.id,()=>api.reconnectIntegration(account.id))}>Reconnect</button><button disabled={busy===account.id} onClick={()=>run(account.id,()=>api.disconnectIntegration(account.id))}>Disconnect</button></div></div>)}</div>:<Empty title="No accounts connected" detail="Connect a Google account with read-only Gmail and Calendar access."/>}</PageState></Section>}
function SettingsPage(){const navigate=useNavigate();const [appearance,setAppearance]=useState('system');const [message,setMessage]=useState('');const [notifications,setNotifications]=useState(true);const [lead,setLead]=useState('60');useEffect(()=>{api.getSetting('appearance').then(v=>setAppearance(v??'system'));api.getSetting('notificationsEnabled').then(v=>setNotifications((v??'true')!=='false'));api.getSetting('notificationLeadMinutes').then(v=>setLead(v??'60'))},[]);async function theme(value:string){setAppearance(value);await api.setSetting('appearance',value);applyTheme(value)}return <div className="page settings-page"><div className="page-heading"><div><span className="eyebrow">Local preferences</span><h2>Settings</h2></div></div><Section title="General"><div className="setting-row"><div><strong>Theme</strong><p>Use system appearance or choose explicitly.</p></div><div className="segmented"><button className={appearance==='light'?'active':''} onClick={()=>theme('light')}><Sun size={14}/>Light</button><button className={appearance==='dark'?'active':''} onClick={()=>theme('dark')}><Moon size={14}/>Dark</button><button className={appearance==='system'?'active':''} onClick={()=>theme('system')}>System</button></div></div><div className="setting-row"><div><strong>Academic administration</strong><p>Manage institutions, terms, courses, modules, and assessments.</p></div><button onClick={()=>navigate('/academics/manage')}>Open academics</button></div></Section><ConnectedAccounts/><Section title="Notifications"><div className="setting-row"><div><strong>Local reminders</strong><p>Conservative reminders for tasks and assessment deadlines.</p></div><label className="toggle"><input type="checkbox" checked={notifications} onChange={async e=>{setNotifications(e.target.checked);await api.setSetting('notificationsEnabled',e.target.checked?'true':'false')}}/>Enabled</label></div><div className="setting-row"><div><strong>Lead time (minutes)</strong><p>How long before a due time to remind you.</p></div><input className="lead-input" type="number" min={5} max={1440} value={lead} onChange={async e=>{setLead(e.target.value);await api.setSetting('notificationLeadMinutes',e.target.value)}}/></div></Section><PortalSettingsSection/><Section title="Data"><div className="setting-row"><div><strong>Export database</strong><p>Checkpointed SQLite backup via WAL-safe export.</p>{message&&<small>{message}</small>}</div><button onClick={async()=>{const path=await api.exportBackup();setMessage(path?`Backup saved to ${path}`:'Export cancelled')}}><FileDown size={15}/>Backup</button></div><div className="setting-row"><div><strong>Export JSON</strong><p>Structured export of academics and items — no OAuth secrets.</p></div><button onClick={async()=>{const path=await api.exportDataJson();setMessage(path?`JSON export saved to ${path}`:'Export cancelled')}}><FileDown size={15}/>Export JSON</button></div></Section><Section title="About"><div className="setting-row"><div><strong>Command Centre</strong><p>Version 1.0.0 · local-first personal productivity desktop app.</p></div></div></Section></div>}
function applyTheme(value:string){const dark=value==='dark'||(value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light'}

export function App(){const [add,setAdd]=useState(false);const [search,setSearch]=useState(false);const [editing,setEditing]=useState<Item>();const [refresh,setRefresh]=useState(0);useEffect(()=>{api.getSetting('appearance').then(v=>applyTheme(v??'system'));const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(true)}else if(e.key.toLowerCase()==='n'&&!e.metaKey&&!e.ctrlKey&&!['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)){e.preventDefault();setAdd(true)}else if(e.key==='Escape'){setAdd(false);setSearch(false);setEditing(undefined)}};addEventListener('keydown',handler);return()=>removeEventListener('keydown',handler)},[]);const changed=()=>setRefresh(v=>v+1);const edit=(item:Item)=>setEditing(item);return <div className="app-shell"><Sidebar/><main><Topbar onAdd={()=>setAdd(true)} onSearch={()=>setSearch(true)}/><Routes><Route path="/" element={<HomePage refresh={refresh} onEdit={edit}/>}/><Route path="/today" element={<TodayPage refresh={refresh} onEdit={edit}/>}/><Route path="/upcoming" element={<UpcomingPage refresh={refresh} onEdit={edit}/>}/><Route path="/inbox" element={<InboxPage onChanged={changed}/>}/><Route path="/calendar" element={<CalendarPage refresh={refresh}/>}/><Route path="/academics/iitm" element={<AcademicPage institution="IITM"/>}/><Route path="/academics/manipal" element={<AcademicPage institution="MANIPAL"/>}/><Route path="/academics/manage" element={<AcademicManagePage/>}/><Route path="/academics/:area/manage" element={<AcademicManagePage/>}/><Route path="/academics/:area/course/:courseId" element={<CoursePage/>}/><Route path="/academics/iitm/course/:courseId" element={<CoursePage/>}/><Route path="/area/exora" element={<AreaWorkspacePage area="EXORA" refresh={refresh} onEdit={edit}/>}/><Route path="/area/personal" element={<AreaWorkspacePage area="PERSONAL" refresh={refresh} onEdit={edit}/>}/><Route path="/portals" element={<PortalHubPage/>}/><Route path="/settings" element={<SettingsPage/>}/></Routes></main>{(add||editing)&&<QuickAdd item={editing} onClose={()=>{setAdd(false);setEditing(undefined)}} onSaved={changed}/>} {search&&<CommandPalette onClose={()=>setSearch(false)} onAdd={()=>{setSearch(false);setAdd(true)}}/>}</div>}
