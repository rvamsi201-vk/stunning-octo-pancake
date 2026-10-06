import type { CommandCentreService } from '../services/command-centre-service.js';

// Purposeful read-only facade for a future local MCP transport. It deliberately
// exposes neither SQL nor credentials and is not started by the desktop app.
export class ReadOnlyCommandCentreAdapter {
  constructor(private readonly service: CommandCentreService) {}
  get_today() { return this.service.getToday(); }
  get_upcoming(days: 7 | 14 | 30 = 14) { return this.service.getUpcoming(days); }
  get_overdue() { return this.service.getOverdue(); }
  get_courses(institution?: string) { return this.service.getCourses(institution); }
  search_command_centre(query: string) { return this.service.search(query); }
  search_inbox(query: string) { return this.service.getInbox().filter((r) => r.title.toLowerCase().includes(query.toLowerCase())); }
}
