import { describe, expect, it } from 'vitest';
import { parseNotificationPreferences, remindersDueNow } from './notification-scheduler.js';
import { reminderOccurrenceKey } from './reminder-delivery-service.js';

describe('notification scheduler', () => {
  it('respects disabled notifications', () => {
    const prefs = parseNotificationPreferences({ notificationsEnabled: 'false', notificationLeadMinutes: '30' });
    const due = remindersDueNow(
      [{ id: 'item:1', title: 'Task', area: 'PERSONAL', dueAt: new Date(Date.now() + 3_600_000).toISOString(), kind: 'task', leadMinutes: 30 }],
      new Date(),
      prefs,
      () => false,
      reminderOccurrenceKey,
    );
    expect(due).toHaveLength(0);
  });

  it('fires reminders inside the lead window once', () => {
    const dueAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const prefs = parseNotificationPreferences({ notificationsEnabled: 'true', notificationLeadMinutes: '60' });
    const sent = new Set<string>();
    const first = remindersDueNow([{ id: 'item:1', title: 'Due soon', area: 'EXORA', dueAt, kind: 'task', leadMinutes: 60 }], new Date(), prefs, (key) => sent.has(key), reminderOccurrenceKey);
    expect(first).toHaveLength(1);
    sent.add(reminderOccurrenceKey({ id: 'item:1', title: 'Due soon', area: 'EXORA', dueAt, kind: 'task', leadMinutes: 60 }));
    const second = remindersDueNow([{ id: 'item:1', title: 'Due soon', area: 'EXORA', dueAt, kind: 'task', leadMinutes: 60 }], new Date(), prefs, (key) => sent.has(key), reminderOccurrenceKey);
    expect(second).toHaveLength(0);
  });
});
