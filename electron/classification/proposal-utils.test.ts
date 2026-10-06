import { describe, expect, it } from 'vitest';
import type { ClassificationProposal } from './classifier.js';
import { consolidateClassificationProposals } from './proposal-utils.js';

describe('consolidateClassificationProposals', () => {
  it('returns only the primary actionable proposal when a course is matched', () => {
    const proposals: ClassificationProposal[] = [
      { kind: 'deadline', confidence: 0.9, title: 'MA1003 assignment', courseId: 'course-1', institutionId: 'inst-1', proposedDueAt: '2026-11-01T00:00:00.000Z', proposedData: { itemType: 'assignment' }, reasons: [] },
      { kind: 'new-course', confidence: 0.7, title: 'New course MA1003', institutionId: 'inst-1', proposedData: { code: 'MA1003' }, reasons: [] },
    ];
    expect(consolidateClassificationProposals(proposals)).toHaveLength(1);
    expect(consolidateClassificationProposals(proposals)[0]?.kind).toBe('deadline');
  });
});
