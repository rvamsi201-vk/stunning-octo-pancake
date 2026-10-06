import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase, seedIds } from '../database/seed.js';
import { AcademicAdminService } from './academic-admin-service.js';
import { CommandCentreService } from './command-centre-service.js';

describe('academic admin service', () => {
  let dir = '';
  let db: LocalDatabase;
  let admin: AcademicAdminService;
  let command: CommandCentreService;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cc-academic-admin-'));
    db = new LocalDatabase(path.join(dir, 'test.sqlite'));
    runMigrations(db);
    seedDatabase(db);
    admin = new AcademicAdminService(db);
    command = new CommandCentreService(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('preserves IITM seed courses after migration', () => {
    const courses = admin.listCourses(seedIds.iitm);
    expect(courses.some((course) => course.code === 'MA1003')).toBe(true);
    expect(courses.some((course) => course.code === 'MA1004')).toBe(true);
    const terms = admin.listTerms(seedIds.iitm);
    expect(terms.some((term) => term.id === seedIds.iitmTerm)).toBe(true);
  });

  it('creates institution, term, course, module, and assessment', () => {
    const institution = admin.createInstitution({ name: 'Test College', shortName: 'EXORA' });
    const term = admin.createTerm({ institutionId: institution.id, name: 'Spring 2027', status: 'active', moduleUnitLabel: 'module' });
    const course = admin.createCourse({ institutionId: institution.id, termId: term.id, name: 'Applied Ethics', code: 'AE101', credits: 3 });
    const module = admin.createModule({ courseId: course.id, weekNumber: 1, title: 'Intro', topics: ['Overview'] });
    const assessment = admin.createAssessment({ courseId: course.id, type: 'assignment', title: 'Essay 1' });

    expect(admin.listTerms(institution.id).some((entry) => entry.id === term.id)).toBe(true);
    expect(admin.listCourses(institution.id, term.id)[0].name).toBe('Applied Ethics');
    expect(admin.listModules(course.id)[0].title).toBe(module.title);
    expect(admin.listAssessments(course.id)[0].title).toBe(assessment.title);
  });

  it('archives courses and keeps completed terms readable historically', () => {
    const term = admin.createTerm({ institutionId: seedIds.iitm, name: 'Jan 2025 Term', status: 'completed' });
    const course = admin.createCourse({ institutionId: seedIds.iitm, termId: term.id, name: 'History Course', code: 'HIST01' });
    admin.archiveCourse(course.id);

    const historical = command.getCourses('IITM', { includeHistorical: true });
    expect(historical.some((entry) => entry.id === course.id)).toBe(true);
    expect(historical.find((entry) => entry.id === course.id)?.active).toBe(false);

    const currentOnly = command.getCourses('IITM');
    expect(currentOnly.some((entry) => entry.id === course.id)).toBe(false);
  });

  it('loads generic course page data for a newly created course', () => {
    const term = admin.createTerm({ institutionId: seedIds.manipal, name: 'Active Term', status: 'active', moduleUnitLabel: 'module' });
    const course = admin.createCourse({ institutionId: seedIds.manipal, termId: term.id, name: 'Clinical Skills', credits: 2 });
    admin.createModule({ courseId: course.id, weekNumber: 1, title: 'Foundations', topics: ['Basics'] });

    const loaded = command.getCourseById(course.id);
    expect(loaded?.name).toBe('Clinical Skills');
    expect(loaded?.modules.length).toBe(1);
    expect(loaded?.moduleUnitLabel).toBe('module');
  });
});
