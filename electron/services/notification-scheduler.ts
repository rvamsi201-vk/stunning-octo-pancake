import { addMinutes, isBefore } from 'date-fns';
import type { Item } from '../../shared/contracts.js';

export interface ReminderCandidate {
  id: string;
  title: string;
  area: Item['area'];
  dueAt: string;
  kind: 'task' | 'assessment' | 'calendar-event';
  leadMinutes: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  leadMinutes: number;
}

export function parseNotificationPreferences(settings: Record<string, string | null>): NotificationPreferences {
  const enabled = (settings.notificationsEnabled ?? 'true') !== 'false';
  const lead = Number(settings.notificationLeadMinutes ?? '60');
  return { enabled, leadMinutes: Number.isFinite(lead) && lead > 0 ? lead : 60 };
}

export function remindersDueNow(
  candidates: ReminderCandidate[],
  now: Date,
  preferences: NotificationPreferences,
  isDelivered: (occurrenceKey: string) => boolean,
  occurrenceKey: (candidate: ReminderCandidate) => string,
): ReminderCandidate[] {
  if (!preferences.enabled) return [];
  return candidates.filter((candidate) => {
    if (isDelivered(occurrenceKey(candidate))) return false;
    const fireAt = addMinutes(new Date(candidate.dueAt), -candidate.leadMinutes);
    return isBefore(fireAt, now) && isBefore(now, new Date(candidate.dueAt));
  });
}
