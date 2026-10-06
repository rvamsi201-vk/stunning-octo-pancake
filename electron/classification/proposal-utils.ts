import type { ClassificationProposal } from './classifier.js';

export function isActionableClassificationProposal(proposal: ClassificationProposal): boolean {
  if (proposal.kind === 'new-course') return true;
  if (proposal.kind === 'review') return Boolean(proposal.proposedDueAt);
  return ['assessment', 'deadline', 'activity', 'class-session', 'item'].includes(proposal.kind);
}

/** Keep one primary actionable proposal per email; avoid duplicate nested cards. */
export function consolidateClassificationProposals(proposals: ClassificationProposal[]): ClassificationProposal[] {
  const actionable = proposals.filter(isActionableClassificationProposal);
  const primary = [...actionable].sort((a, b) => b.confidence - a.confidence)[0];
  const newCourse = proposals.find((proposal) => proposal.kind === 'new-course');
  if (primary) {
    if (primary.courseId) return [primary];
    return newCourse ? [primary, newCourse] : [primary];
  }
  return newCourse ? [newCourse] : [];
}
