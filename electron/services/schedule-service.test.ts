import { describe, expect, it } from 'vitest';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase } from '../database/seed.js';
import { CommandCentreService } from './command-centre-service.js';
import { assessmentCoveredByItem } from './schedule-service.js';

describe('ScheduleService', () => {
  it('deduplicates assessments already represented by linked items', () => {
    const covered = assessmentCoveredByItem(
      { courseId: '40000000-0000-4000-8000-000000000001', title: 'Extra Activity 1', scheduledAt: '2026-10-31T23:59:00.000+05:30' },
      {
        id: 'x',
        title: 'Extra Activity 1 submission',
        description: '',
        area: 'IITM',
        courseId: '40000000-0000-4000-8000-000000000001',
        type: 'assignment',
        status: 'todo',
        priority: 'normal',
        dueAt: '2026-10-31T18:00:00.000Z',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    );
    expect(covered).toBe(true);
  });

  it('builds upcoming buckets without duplicate assessment entries', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    seedDatabase(db);
    const service = new CommandCentreService(db);
    const view = service.getUpcomingView(30);
    const ids = view.buckets.flatMap((bucket) => bucket.entries.map((entry) => entry.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(view.buckets.some((bucket) => bucket.entries.length > 0)).toBe(true);
  });
});
