import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DeterministicClassifier } from '../classification/classifier.js';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase, seedIds } from '../database/seed.js';
import { AcademicAdminService } from './academic-admin-service.js';
import { loadMatchableCourses } from './course-catalog.js';

describe('course catalog matching', () => {
  let dir = '';
  let db: LocalDatabase;
  let admin: AcademicAdminService;
  const classifier = new DeterministicClassifier();

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cc-course-catalog-'));
    db = new LocalDatabase(path.join(dir, 'test.sqlite'));
    runMigrations(db);
    seedDatabase(db);
    admin = new AcademicAdminService(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('includes dynamically created courses in classifier matching', () => {
    const term = admin.createTerm({ institutionId: seedIds.iitm, name: 'Jan 2027 Term', status: 'active' });
    const course = admin.createCourse({ institutionId: seedIds.iitm, termId: term.id, name: 'Future Systems', code: 'FS2027' });
    const catalog = loadMatchableCourses(db, seedIds.iitm);
    expect(catalog.some((entry) => entry.id === course.id)).toBe(true);

    const proposal = classifier.classify(
      { providerResourceId: 'mail-1', type: 'mail', title: 'FS2027 assignment due 2027-03-15', occurredAt: '2027-01-01T00:00:00.000Z' },
      catalog,
      seedIds.iitm,
      { academicSource: true },
    )[0];
    expect(proposal.courseId).toBe(course.id);
  });

  it('excludes archived courses from matchable catalog', () => {
    const term = admin.createTerm({ institutionId: seedIds.iitm, name: 'Archive Term', status: 'active' });
    const course = admin.createCourse({ institutionId: seedIds.iitm, termId: term.id, name: 'Retired Subject', code: 'RET999' });
    admin.archiveCourse(course.id);
    const catalog = loadMatchableCourses(db, seedIds.iitm);
    expect(catalog.some((entry) => entry.id === course.id)).toBe(false);
  });

  it('still lists seeded MA1003 in matchable courses for upcoming IITM term', () => {
    const catalog = loadMatchableCourses(db, seedIds.iitm);
    expect(catalog.some((entry) => entry.code === 'MA1003')).toBe(true);
  });
});
