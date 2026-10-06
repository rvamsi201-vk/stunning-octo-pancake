import type { LocalDatabase } from '../database/client.js';
import type { ReminderCandidate } from './notification-scheduler.js';

export function reminderOccurrenceKey(candidate: ReminderCandidate): string {
  return `${candidate.id}:${candidate.dueAt}:${candidate.leadMinutes}`;
}

export class ReminderDeliveryService {
  constructor(private readonly db: LocalDatabase) {}

  wasDelivered(occurrenceKey: string): boolean {
    const row = this.db.prepare('SELECT occurrence_key FROM reminder_deliveries WHERE occurrence_key=?').get(occurrenceKey);
    return Boolean(row);
  }

  markDelivered(occurrenceKey: string): void {
    const now = new Date().toISOString();
    this.db.prepare('INSERT OR IGNORE INTO reminder_deliveries (occurrence_key,delivered_at) VALUES (?,?)').run(occurrenceKey, now);
  }
}
