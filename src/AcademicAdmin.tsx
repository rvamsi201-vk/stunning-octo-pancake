import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react';
import type { Area, Assessment, CourseAdmin, CourseModule, InstitutionAdmin, TermAdmin } from '@shared/contracts';

const api = window.commandCentre;
const areaNames: Record<Area, string> = { IITM: 'IIT Madras', MANIPAL: 'Manipal', EXORA: 'Exora', PERSONAL: 'Personal' };
const assessmentTypes = ['assignment', 'quiz', 'exam', 'activity', 'peer_review', 'project', 'other'] as const;
const termStatuses = ['upcoming', 'active', 'completed', 'archived'] as const;

function paramToArea(param?: string): Area | null {
  if (!param) return null;
  const key = param.toUpperCase();
  if (key === 'IITM' || key === 'MANIPAL' || key === 'EXORA' || key === 'PERSONAL') return key;
  return null;
}

function fromLocalDatetime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function AcademicManagePage() {
  const { area: areaParam } = useParams();
  const navigate = useNavigate();
  const scopedArea = paramToArea(areaParam);
  const [institutions, setInstitutions] = useState<InstitutionAdmin[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [terms, setTerms] = useState<TermAdmin[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [courses, setCourses] = useState<CourseAdmin[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const institution = useMemo(() => institutions.find((entry) => entry.id === selectedInstitutionId), [institutions, selectedInstitutionId]);
  const selectedTerm = useMemo(() => terms.find((entry) => entry.id === selectedTermId), [terms, selectedTermId]);
  const selectedCourse = useMemo(() => courses.find((entry) => entry.id === selectedCourseId), [courses, selectedCourseId]);

  const reloadInstitutions = useCallback(async () => {
    const rows = await api.listAdminInstitutions(true);
    setInstitutions(rows);
    if (scopedArea) {
      const match = rows.find((row) => row.shortName === scopedArea && !row.archived);
      if (match) setSelectedInstitutionId(match.id);
    } else if (!selectedInstitutionId && rows.length) {
      setSelectedInstitutionId(rows.find((row) => !row.archived)?.id ?? rows[0].id);
    }
  }, [scopedArea, selectedInstitutionId]);

  const reloadTerms = useCallback(async () => {
    if (!selectedInstitutionId) return;
    setTerms(await api.listAdminTerms(selectedInstitutionId));
  }, [selectedInstitutionId]);

  const reloadCourses = useCallback(async () => {
    if (!selectedInstitutionId) return;
    setCourses(await api.listAdminCourses(selectedInstitutionId, selectedTermId || undefined));
  }, [selectedInstitutionId, selectedTermId]);

  const reloadCourseDetail = useCallback(async () => {
    if (!selectedCourseId) {
      setModules([]);
      setAssessments([]);
      return;
    }
    const [moduleRows, assessmentRows] = await Promise.all([api.listAdminModules(selectedCourseId), api.listAdminAssessments(selectedCourseId)]);
    setModules(moduleRows);
    setAssessments(assessmentRows);
  }, [selectedCourseId]);

  useEffect(() => {
    reloadInstitutions().catch(() => setError('Could not load institutions.'));
  }, [reloadInstitutions]);

  useEffect(() => {
    if (!selectedInstitutionId) return;
    reloadTerms().catch(() => setError('Could not load terms.'));
  }, [selectedInstitutionId, reloadTerms]);

  useEffect(() => {
    reloadCourses().catch(() => setError('Could not load courses.'));
  }, [reloadCourses]);

  useEffect(() => {
    reloadCourseDetail().catch(() => setError('Could not load course structure.'));
  }, [reloadCourseDetail]);

  async function run<T>(action: () => Promise<T>) {
    setBusy(true);
    setError('');
    try {
      return await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function createTerm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedInstitutionId) return;
    const data = new FormData(e.currentTarget);
    await run(async () => {
      await api.createAdminTerm({
        institutionId: selectedInstitutionId,
        name: String(data.get('name') ?? ''),
        code: String(data.get('code') ?? '') || null,
        startsAt: fromLocalDatetime(String(data.get('startsAt') ?? '')),
        endsAt: fromLocalDatetime(String(data.get('endsAt') ?? '')),
        moduleUnitLabel: String(data.get('moduleUnitLabel') ?? 'week') || 'week',
        status: (String(data.get('status') ?? 'upcoming') as TermAdmin['status']) || 'upcoming',
      });
      e.currentTarget.reset();
      await reloadTerms();
    });
  }

  async function createCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedInstitutionId || !selectedTermId) return;
    const data = new FormData(e.currentTarget);
    await run(async () => {
      const created = await api.createAdminCourse({
        institutionId: selectedInstitutionId,
        termId: selectedTermId,
        code: String(data.get('code') ?? '') || undefined,
        name: String(data.get('name') ?? ''),
        credits: data.get('credits') ? Number(data.get('credits')) : null,
        notes: String(data.get('notes') ?? ''),
      });
      e.currentTarget.reset();
      await reloadCourses();
      setSelectedCourseId(created.id);
    });
  }

  async function createModule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCourseId) return;
    const data = new FormData(e.currentTarget);
    await run(async () => {
      await api.createAdminModule({
        courseId: selectedCourseId,
        weekNumber: Number(data.get('weekNumber') ?? modules.length + 1),
        title: String(data.get('title') ?? ''),
        topics: String(data.get('topics') ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      e.currentTarget.reset();
      await reloadCourseDetail();
    });
  }

  async function createAssessment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCourseId) return;
    const data = new FormData(e.currentTarget);
    await run(async () => {
      await api.createAdminAssessment({
        courseId: selectedCourseId,
        type: String(data.get('type') ?? 'assignment') as (typeof assessmentTypes)[number],
        title: String(data.get('title') ?? ''),
        scheduledAt: fromLocalDatetime(String(data.get('scheduledAt') ?? '')),
        releaseAt: fromLocalDatetime(String(data.get('releaseAt') ?? '')),
        peerReviewAt: fromLocalDatetime(String(data.get('peerReviewAt') ?? '')),
        maximumScore: data.get('maximumScore') ? Number(data.get('maximumScore')) : 100,
        notes: String(data.get('notes') ?? ''),
        sourceUrl: String(data.get('sourceUrl') ?? '') || null,
      });
      e.currentTarget.reset();
      await reloadCourseDetail();
    });
  }

  async function moveModule(id: string, direction: -1 | 1) {
    const index = modules.findIndex((module) => module.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= modules.length || !selectedCourseId) return;
    const ordered = [...modules];
    const [removed] = ordered.splice(index, 1);
    ordered.splice(target, 0, removed);
    await run(async () => {
      await api.reorderAdminModules({ courseId: selectedCourseId, orderedIds: ordered.map((module) => module.id) });
      await reloadCourseDetail();
    });
  }

  const backPath = institution ? `/academics/${institution.shortName.toLowerCase()}` : '/academics/iitm';

  return (
    <div className="page admin-page">
      <div className="page-heading">
        <div>
          <Link className="admin-back" to={backPath}>
            <ChevronLeft size={15} /> Back to academics
          </Link>
          <span className="eyebrow">Administration</span>
          <h2>Manage academic structure</h2>
          <p>Create terms, courses, modules, and assessments without changing code.</p>
        </div>
        {!scopedArea && (
          <Link className="primary compact" to="/academics/iitm">
            <Settings2 size={15} /> Daily view
          </Link>
        )}
      </div>
      {error && <div className="state error admin-error">{error}</div>}

      {!scopedArea && (
        <section className="admin-panel">
          <h3>Institutions</h3>
          <div className="admin-columns">
            <div className="admin-list">
              {institutions.map((row) => (
                <button key={row.id} className={row.id === selectedInstitutionId ? 'active' : ''} onClick={() => setSelectedInstitutionId(row.id)}>
                  <strong>{row.name}</strong>
                  <span>
                    {areaNames[row.shortName]} {row.archived ? '· archived' : ''}
                  </span>
                </button>
              ))}
            </div>
            <form
              className="admin-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                await run(async () => {
                  await api.createAdminInstitution({ name: String(data.get('name') ?? ''), shortName: String(data.get('shortName') ?? 'EXORA') as Area });
                  e.currentTarget.reset();
                  await reloadInstitutions();
                });
              }}
            >
              <strong>Add institution</strong>
              <label>
                Name
                <input name="name" required disabled={busy} placeholder="University name" />
              </label>
              <label>
                Area code
                <select name="shortName" defaultValue="EXORA" disabled={busy}>
                  {(['IITM', 'MANIPAL', 'EXORA', 'PERSONAL'] as Area[]).map((value) => (
                    <option key={value} value={value}>
                      {areaNames[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary compact" type="submit" disabled={busy}>
                <Plus size={14} /> Create institution
              </button>
            </form>
          </div>
          {institution && (
            <div className="admin-actions">
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const name = window.prompt('Institution name', institution.name);
                    if (!name?.trim()) return;
                    await api.updateAdminInstitution({ id: institution.id, name: name.trim(), shortName: institution.shortName });
                    await reloadInstitutions();
                  })
                }
              >
                Edit institution
              </button>
              <button
                disabled={busy || institution.archived}
                onClick={() =>
                  run(async () => {
                    if (!window.confirm(`Archive “${institution.name}”? Existing academic records remain readable.`)) return;
                    await api.archiveAdminInstitution(institution.id);
                    await reloadInstitutions();
                  })
                }
              >
                Archive institution
              </button>
            </div>
          )}
        </section>
      )}

      {institution && (
        <section className="admin-panel">
          <h3>{institution.name}</h3>
          <p className="admin-help">Terms in upcoming or active status participate in inbox course matching by default.</p>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h3>Terms</h3>
        </div>
        <div className="admin-columns">
          <div className="admin-list">
            {terms.map((term) => (
              <button key={term.id} className={term.id === selectedTermId ? 'active' : ''} onClick={() => { setSelectedTermId(term.id); setSelectedCourseId(''); }}>
                <strong>{term.name}</strong>
                <span>
                  {term.status} · {term.moduleUnitLabel}s
                </span>
              </button>
            ))}
            {!terms.length && <p className="admin-empty">No terms yet.</p>}
          </div>
          <form className="admin-form" onSubmit={createTerm}>
            <strong>Add term</strong>
            <label>
              Name
              <input name="name" required placeholder="Jan 2027 Term" disabled={!selectedInstitutionId || busy} />
            </label>
            <label>
              Code
              <input name="code" placeholder="Optional" disabled={!selectedInstitutionId || busy} />
            </label>
            <div className="form-grid">
              <label>
                Starts
                <input name="startsAt" type="datetime-local" disabled={!selectedInstitutionId || busy} />
              </label>
              <label>
                Ends
                <input name="endsAt" type="datetime-local" disabled={!selectedInstitutionId || busy} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Status
                <select name="status" defaultValue="upcoming" disabled={!selectedInstitutionId || busy}>
                  {termStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Module label
                <select name="moduleUnitLabel" defaultValue={selectedTerm?.moduleUnitLabel ?? 'week'} disabled={!selectedInstitutionId || busy}>
                  <option value="week">Week</option>
                  <option value="module">Module</option>
                </select>
              </label>
            </div>
            <button className="primary compact" type="submit" disabled={!selectedInstitutionId || busy}>
              <Plus size={14} /> Create term
            </button>
          </form>
        </div>
        {selectedTerm && (
          <div className="admin-actions">
            {termStatuses.map((status) => (
              <button
                key={status}
                disabled={busy || selectedTerm.status === status}
                onClick={() =>
                  run(async () => {
                    if (!window.confirm(`Mark “${selectedTerm.name}” as ${status}? Historical records are kept.`)) return;
                    await api.setAdminTermStatus({ id: selectedTerm.id, status });
                    await reloadTerms();
                  })
                }
              >
                Mark {status}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h3>Courses {selectedTerm ? `· ${selectedTerm.name}` : ''}</h3>
        </div>
        <div className="admin-columns">
          <div className="admin-list">
            {courses.map((course) => (
              <button key={course.id} className={course.id === selectedCourseId ? 'active' : ''} onClick={() => setSelectedCourseId(course.id)}>
                <strong>{course.code ? `${course.code} · ` : ''}{course.name}</strong>
                <span>
                  {course.termName} · {course.active ? 'active' : 'archived'}
                </span>
              </button>
            ))}
            {!courses.length && <p className="admin-empty">{selectedTermId ? 'No courses in this term.' : 'Select a term to manage courses.'}</p>}
          </div>
          <form className="admin-form" onSubmit={createCourse}>
            <strong>Add course</strong>
            <label>
              Name
              <input name="name" required disabled={!selectedTermId || busy} />
            </label>
            <label>
              Code
              <input name="code" placeholder="Optional" disabled={!selectedTermId || busy} />
            </label>
            <div className="form-grid">
              <label>
                Credits
                <input name="credits" type="number" min="0" step="0.5" disabled={!selectedTermId || busy} />
              </label>
              <label>
                Notes
                <input name="notes" disabled={!selectedTermId || busy} />
              </label>
            </div>
            <button className="primary compact" type="submit" disabled={!selectedTermId || busy}>
              <Plus size={14} /> Create course
            </button>
          </form>
        </div>
        {selectedCourse && (
          <div className="admin-actions">
            <button
              disabled={busy || !selectedCourse.active}
              onClick={() =>
                run(async () => {
                  if (!window.confirm(`Archive “${selectedCourse.name}”? It will be excluded from inbox matching.`)) return;
                  await api.archiveAdminCourse(selectedCourse.id);
                  await reloadCourses();
                })
              }
            >
              Archive course
            </button>
            {institution && (
              <button onClick={() => navigate(`/academics/${institution.shortName.toLowerCase()}/course/${selectedCourse.id}`)}>
                Open course page <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </section>

      {selectedCourse && (
        <>
          <section className="admin-panel">
            <h3>
              {selectedCourse.moduleUnitLabel === 'module' ? 'Modules' : 'Weeks'} · {selectedCourse.name}
            </h3>
            <div className="admin-columns">
              <div className="admin-list admin-list-tight">
                {modules.map((module, index) => (
                  <div key={module.id} className="admin-row">
                    <span>
                      #{module.weekNumber} {module.title}
                    </span>
                    <div>
                      <button type="button" disabled={busy || index === 0} onClick={() => moveModule(module.id, -1)}>
                        ↑
                      </button>
                      <button type="button" disabled={busy || index === modules.length - 1} onClick={() => moveModule(module.id, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            if (!window.confirm(`Archive module “${module.title}”?`)) return;
                            await api.archiveAdminModule(module.id);
                            await reloadCourseDetail();
                          })
                        }
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form className="admin-form" onSubmit={createModule}>
                <strong>Add {selectedCourse.moduleUnitLabel}</strong>
                <label>
                  Order
                  <input name="weekNumber" type="number" min="1" defaultValue={modules.length + 1} disabled={busy} />
                </label>
                <label>
                  Title
                  <input name="title" required disabled={busy} />
                </label>
                <label>
                  Topics (one per line)
                  <textarea name="topics" rows={3} disabled={busy} />
                </label>
                <button className="primary compact" type="submit" disabled={busy}>
                  <Plus size={14} /> Add
                </button>
              </form>
            </div>
          </section>

          <section className="admin-panel">
            <h3>Assessments / activities</h3>
            <div className="admin-columns">
              <div className="admin-list admin-list-tight">
                {assessments.map((assessment) => (
                  <div key={assessment.id} className="admin-row">
                    <span>
                      {assessment.type} · {assessment.title}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (!window.confirm(`Archive “${assessment.title}”?`)) return;
                          await api.archiveAdminAssessment(assessment.id);
                          await reloadCourseDetail();
                        })
                      }
                    >
                      Archive
                    </button>
                  </div>
                ))}
              </div>
              <form className="admin-form" onSubmit={createAssessment}>
                <strong>Add assessment</strong>
                <label>
                  Title
                  <input name="title" required disabled={busy} />
                </label>
                <label>
                  Type
                  <select name="type" defaultValue="assignment" disabled={busy}>
                    {assessmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Scheduled
                    <input name="scheduledAt" type="datetime-local" disabled={busy} />
                  </label>
                  <label>
                    Release
                    <input name="releaseAt" type="datetime-local" disabled={busy} />
                  </label>
                </div>
                <label>
                  Due / peer review
                  <input name="peerReviewAt" type="datetime-local" disabled={busy} />
                </label>
                <div className="form-grid">
                  <label>
                    Max score
                    <input name="maximumScore" type="number" min="0" defaultValue={100} disabled={busy} />
                  </label>
                  <label>
                    Source URL
                    <input name="sourceUrl" type="url" placeholder="https://…" disabled={busy} />
                  </label>
                </div>
                <label>
                  Notes
                  <input name="notes" disabled={busy} />
                </label>
                <button className="primary compact" type="submit" disabled={busy}>
                  <Plus size={14} /> Add assessment
                </button>
              </form>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function ManageAcademicsLink({ area }: { area: Area }) {
  return (
    <Link className="manage-academics" to={`/academics/${area.toLowerCase()}/manage`}>
      <Settings2 size={14} /> Manage
    </Link>
  );
}
