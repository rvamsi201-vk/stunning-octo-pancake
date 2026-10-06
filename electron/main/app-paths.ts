import { app } from 'electron';
import path from 'node:path';

/** Canonical production Application Support folder name. */
export const PRODUCTION_USER_DATA_DIR = 'Command Centre';

/** Isolated development Application Support folder name. */
export const DEVELOPMENT_USER_DATA_DIR = 'Command Centre Dev';

export function resolveUserDataDirectoryName(isPackaged: boolean): string {
  return isPackaged ? PRODUCTION_USER_DATA_DIR : DEVELOPMENT_USER_DATA_DIR;
}

/** Sets app identity and an explicit userData path before SQLite or env loading. */
export function configureAppUserData(isPackaged: boolean = app.isPackaged): string {
  app.setName('Command Centre');
  app.name = 'Command Centre';
  process.title = 'Command Centre';
  const userDataPath = path.join(app.getPath('appData'), resolveUserDataDirectoryName(isPackaged));
  app.setPath('userData', userDataPath);
  return userDataPath;
}
