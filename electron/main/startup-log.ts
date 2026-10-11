import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';

export function formatStartupError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

export function logStartupError(error: unknown, userDataPath: string) {
  const message = formatStartupError(error);
  console.error('[Command Centre startup]', message);
  const logPath = path.join(userDataPath, 'startup.log');
  try {
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    /* Logging must not mask the original startup failure. */
  }
  dialog.showErrorBox(
    'Command Centre could not start',
    `The app could not finish loading your local data.\n\nYour database was not deleted. Details were written to:\n${logPath}\n\n${message.split('\n')[0]}`,
  );
  return logPath;
}

export function resolveDatabasePath(): string {
  return process.env.COMMAND_CENTRE_DB ?? path.join(app.getPath('userData'), 'command-centre.sqlite');
}
