import type { LocalDatabase } from './client.js';

const ids = {
  iitm: '10000000-0000-4000-8000-000000000001', manipal: '10000000-0000-4000-8000-000000000002',
  iitmProgram: '20000000-0000-4000-8000-000000000001', manipalProgram: '20000000-0000-4000-8000-000000000002',
  iitmTerm: '30000000-0000-4000-8000-000000000001', manipalTerm: '30000000-0000-4000-8000-000000000002',
  math: '40000000-0000-4000-8000-000000000001', stats: '40000000-0000-4000-8000-000000000002',
};

const mathWeeks = [
  ['Vectors and matrices', 'Vectors; Matrices; Systems of linear equations; Determinants'],
  ['Solving linear equations', "Determinants; Cramer's Rule; Invertible coefficient matrices; Echelon form; Row reduction; Gaussian elimination"],
  ['Vector spaces', 'Properties; Linear dependence and independence'],
  ['Basis and dimension', 'Finding bases; Rank and dimension; Gaussian elimination'],
  ['Rank, nullity and transformations', 'Rank and nullity; Linear transformations; Null space; Bases; Linear mappings'],
  ['Linear transformations', 'Kernel and images; Ordered bases and matrices; Bases for kernel and image'],
  ['Equivalent and similar matrices', 'Inner products; Affine subspaces and mappings; Lengths and angles; Norms'],
  ['Orthogonality', 'Orthonormality; Gram-Schmidt; Projections; Orthogonal transformations and rotations'],
  ['Multivariable functions', 'Partial derivatives; Limits; Continuity; Directional derivatives; Gradients'],
  ['Directional optimization', 'Ascent and descent; Tangent hyperplanes; Critical points; Steepest ascent and descent'],
  ['Higher-order analysis', 'Higher-order partials; Hessian; Local extrema; Differentiability; Review'],
];
const statsWeeks = [
  'Multiple random variables', 'Independence, functions of random variables and visualization',
  'Expectations, variance, standard deviation, covariance, correlation and inequalities', 'Continuous random variables and density',
  'Multiple continuous RVs, limit theorems, Gaussian RVs, probability models and data', 'Refresher',
  'Estimation and Inference I', 'Estimation and Inference II', 'Bayesian estimation', 'Hypothesis Testing I', 'Hypothesis Testing II', 'Revision',
].map((title) => [title, title]);

export function seedDatabase(db: LocalDatabase) {
  const now = new Date().toISOString();
  const insertInstitution = db.prepare('INSERT OR IGNORE INTO institutions (id,name,short_name,archived,created_at,updated_at) VALUES (?,?,?,0,?,?)');
  const insertProgram = db.prepare('INSERT OR IGNORE INTO programs VALUES (?, ?, ?, 1, ?, ?)');
  const insertTerm = db.prepare('INSERT OR IGNORE INTO terms (id,program_id,institution_id,name,code,starts_at,ends_at,status,module_unit_label,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const insertCourse = db.prepare('INSERT OR IGNORE INTO courses (id,institution_id,term_id,code,name,credits,active,grading_config,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?)');
  const insertModule = db.prepare('INSERT OR IGNORE INTO course_modules (id,course_id,week_number,title,topics,completed,archived,created_at,updated_at) VALUES (?,?,?,?,?,0,0,?,?)');
  const insertAssessment = db.prepare('INSERT OR IGNORE INTO assessments VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 100, ?, ?, NULL, ?, ?)');
  const insertItem = db.prepare('INSERT OR IGNORE INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertExternal = db.prepare('INSERT OR IGNORE INTO external_records (id,provider,provider_account_id,provider_record_id,type,title,sender,occurred_at,detected_due_at,source_url,classification_state,raw_metadata,area,archived,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertPortal = db.prepare('INSERT OR IGNORE INTO portals VALUES (?, ?, ?, ?, 1, ?, ?)');
  const insertInstitutionDomain = db.prepare('INSERT OR IGNORE INTO institution_mail_domains (id,institution_id,domain,created_at) VALUES (?,?,?,?)');
  const grading = JSON.stringify({ kind: 'max-of-two', formulas: ['0.6*F + 0.3*max(Q1,Q2)', '0.45*F + 0.25*Q1 + 0.3*Q2'], bonusSeparate: true });

  db.transaction(() => {
    insertInstitution.run(ids.iitm, 'IIT Madras', 'IITM', now, now);
    insertInstitution.run(ids.manipal, 'Manipal University Jaipur', 'MANIPAL', now, now);
    insertInstitutionDomain.run('a1000000-0000-4000-8000-000000000001',ids.iitm,'iitm.ac.in',now);
    insertInstitutionDomain.run('a1000000-0000-4000-8000-000000000002',ids.iitm,'study.iitm.ac.in',now);
    insertProgram.run(ids.iitmProgram, ids.iitm, 'BS in Data Science and Applications', now, now);
    insertProgram.run(ids.manipalProgram, ids.manipal, 'Current programme', now, now);
    insertTerm.run(ids.iitmTerm, ids.iitmProgram, ids.iitm, 'October 2026 Term', null, '2026-10-02T00:00:00.000+05:30', '2027-01-10T23:59:59.000+05:30', 'upcoming', 'week', now, now);
    insertTerm.run(ids.manipalTerm, ids.manipalProgram, ids.manipal, 'Current Term', null, '2026-09-01T00:00:00.000+05:30', null, 'active', 'module', now, now);
    insertCourse.run(ids.math, ids.iitm, ids.iitmTerm, 'MA1003', 'Mathematics for Data Science II', 4, grading, '', now, now);
    insertCourse.run(ids.stats, ids.iitm, ids.iitmTerm, 'MA1004', 'Statistics for Data Science II', 4, grading, '', now, now);
    mathWeeks.forEach(([title, topics], i) => insertModule.run(`51000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ids.math, i + 1, title, JSON.stringify(topics.split('; ')), now, now));
    statsWeeks.forEach(([title, topics], i) => insertModule.run(`52000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ids.stats, i + 1, title, JSON.stringify([topics]), now, now));

    const common = [['Quiz 1', 'quiz', '2026-11-15T09:00:00.000+05:30'], ['Quiz 2', 'quiz', '2026-12-05T09:00:00.000+05:30'], ['End Term', 'exam', '2027-01-10T09:00:00.000+05:30']];
    common.forEach(([title, type, date], i) => { insertAssessment.run(`61000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ids.math, type, title, date, null, null, 'scheduled', '', now, now); insertAssessment.run(`62000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ids.stats, type, title, date, null, null, 'scheduled', '', now, now); });
    [['Extra Activity 1','2026-10-23','2026-10-31'],['Extra Activity 2','2026-11-06','2026-11-14'],['Extra Activity 3','2026-11-27','2026-12-05']].forEach(([title, release, due], i) => insertAssessment.run(`63000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ids.math, 'activity', title, `${due}T23:59:00.000+05:30`, `${release}T00:00:00.000+05:30`, null, 'scheduled', '', now, now));
    [['2026-10-02','2026-10-14','2026-10-18'],['2026-10-16','2026-10-28','2026-11-01'],['2026-10-30','2026-11-11','2026-11-18'],['2026-11-13','2026-11-25','2026-11-29'],['2026-11-27','2026-12-09','2026-12-13']].forEach(([release, due, peer], i) => insertAssessment.run(`64000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ids.stats, 'activity', `Extra Activity ${i + 1}`, `${due}T23:59:00.000+05:30`, `${release}T00:00:00.000+05:30`, `${peer}T23:59:00.000+05:30`, 'scheduled', 'Submission and peer review are tracked separately.', now, now));

    const sessions = [['Technical Communication','2026-09-27T16:30:00.000+05:30'],['Fundamentals of Mathematics','2026-09-27T18:30:00.000+05:30'],['Environmental Science','2026-09-27T20:30:00.000+05:30']];
    sessions.forEach(([title, due], i) => insertItem.run(`71000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, title, 'Live class. If missed, mark as recording required.', 'MANIPAL', null, 'class', 'todo', 'high', due, 'seed', null, null, null, now, now));
    insertItem.run('72000000-0000-4000-8000-000000000001', 'Review weekly priorities', 'Set a clear plan for the week.', 'PERSONAL', null, 'task', 'todo', 'normal', '2026-09-27T10:00:00.000+05:30', 'seed', null, null, null, now, now);
    insertItem.run('72000000-0000-4000-8000-000000000002', 'Prepare Exora status notes', '', 'EXORA', null, 'task', 'todo', 'high', '2026-09-28T11:00:00.000+05:30', 'seed', null, null, null, now, now);
    insertExternal.run('81000000-0000-4000-8000-000000000001', 'mock-google', 'iitm-account', 'mail-001', 'mail', 'MA1003 Extra Activity announcement', 'course-team@study.iitm.ac.in', '2026-09-26T09:15:00.000+05:30', '2026-10-31T23:59:00.000+05:30', null, 'needs_review', null, 'IITM', 0, now, now);
    insertExternal.run('81000000-0000-4000-8000-000000000002', 'mock-microsoft', 'manipal-account', 'mail-002', 'mail', 'Live session resources available', 'faculty@manipal.edu', '2026-09-26T12:30:00.000+05:30', null, null, 'needs_review', null, 'MANIPAL', 0, now, now);
    [['IITM Portal','IITM'],['IITM Gmail','IITM'],['Manipal LMS','MANIPAL'],['Manipal Outlook','MANIPAL'],['Manipal Teams','MANIPAL'],['ChatGPT','PERSONAL'],['Exora Tools','EXORA']].forEach(([name, area], i) => insertPortal.run(`91000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name, null, area, now, now));
    db.prepare("INSERT OR IGNORE INTO app_settings VALUES ('dailyCapacity', 'normal', ?)").run(now);
    db.prepare("INSERT OR IGNORE INTO app_settings VALUES ('appearance', 'system', ?)").run(now);
  })();
}

export { ids as seedIds };
