import type { Area } from '@shared/contracts';

export function formatModuleLabel(unit: string | undefined, weekNumber: number) {
  const normalized = (unit ?? 'week').toLowerCase();
  const label = normalized === 'week' ? 'Week' : normalized === 'module' ? 'Module' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `${label} ${weekNumber}`;
}

export function courseAreaPath(area: Area, courseId: string) {
  return `/academics/${area.toLowerCase()}/course/${courseId}`;
}

export function parseGradingKind(config: string | null | undefined) {
  if (!config) return null;
  try {
    return (JSON.parse(config) as { kind?: string }).kind ?? null;
  } catch {
    return null;
  }
}

export function moduleProgressLabel(unit: string | undefined) {
  return (unit ?? 'week').toLowerCase() === 'module' ? 'modules' : 'weeks';
}
