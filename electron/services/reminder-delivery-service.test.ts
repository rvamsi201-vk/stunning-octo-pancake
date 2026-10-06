import { describe, expect, it } from 'vitest';
import { LocalDatabase } from '../database/client.js';
import { runMigrations } from '../database/migrations.js';
import { parseNotificationPreferences, remindersDueNow, type ReminderCandidate } from './notification-scheduler.js';
import { ReminderDeliveryService, reminderOccurrenceKey } from './reminder-delivery-service.js';

const candidate = (dueAt: string): ReminderCandidate => ({
  id: 'item:11111111-1111-4111-8111-111111111111',
  title: 'Submit assignment',
  area: 'IITM',
  dueAt,
  kind: 'task',
  leadMinutes: 60,
});

describe('ReminderDeliveryService', () => {
  it('delivers the same occurrence only once across service restarts', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    const dueAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const prefs = parseNotificationPreferences({ notificationsEnabled: 'true', notificationLeadMinutes: '60' });
    const now = new Date();
    const item = candidate(dueAt);
    const key = reminderOccurrenceKey(item);

    const firstSession = new ReminderDeliveryService(db);
    const first = remindersDueNow([item], now, prefs, (occurrence) => firstSession.wasDelivered(occurrence), reminderOccurrenceKey);
    expect(first).toHaveLength(1);
    firstSession.markDelivered(key);

    const secondSession = new ReminderDeliveryService(db);
    const again = remindersDueNow([item], now, prefs, (occurrence) => secondSession.wasDelivered(occurrence), reminderOccurrenceKey);
    expect(again).toHaveLength(0);
  });

  it('allows a new occurrence after due time changes', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    const prefs = parseNotificationPreferences({ notificationsEnabled: 'true', notificationLeadMinutes: '60' });
    const deliveries = new ReminderDeliveryService(db);
    const original = candidate(new Date(Date.now() + 20 * 60_000).toISOString());
    const updated = candidate(new Date(Date.now() + 40 * 60_000).toISOString());
    deliveries.markDelivered(reminderOccurrenceKey(original));
    const due = remindersDueNow([updated], new Date(), prefs, (key) => deliveries.wasDelivered(key), reminderOccurrenceKey);
    expect(due).toHaveLength(1);
  });

  it('delivers nothing when notifications are disabled', () => {
    const db = new LocalDatabase(':memory:');
    runMigrations(db);
    const prefs = parseNotificationPreferences({ notificationsEnabled: 'false', notificationLeadMinutes: '60' });
    const deliveries = new ReminderDeliveryService(db);
    const due = remindersDueNow(
      [candidate(new Date(Date.now() + 20 * 60_000).toISOString())],
      new Date(),
      prefs,
      (key) => deliveries.wasDelivered(key),
      reminderOccurrenceKey,
    );
    expect(due).toHaveLength(0);
  });
});
