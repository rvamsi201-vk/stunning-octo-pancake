import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface MainEnvironmentOptions {
  mainModuleDir: string;
  isPackaged: boolean;
  resourcesPath: string;
  overridePath?: string;
}

const PACKAGED_OAUTH_ENV_FILE = 'google-oauth.env';
const ALLOWED_OAUTH_ENV_KEYS = new Set(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

/**
 * Loads environment configuration only into Electron main's process.env.
 * Values are deliberately never returned or logged.
 */
export function loadMainEnvironment(options: MainEnvironmentOptions): boolean {
  if (options.overridePath) {
    const override = path.resolve(options.overridePath);
    if (existsSync(override)) {
      return options.isPackaged ? loadPackagedOAuthEnvFile(override) : loadDevelopmentEnvFile(override);
    }
  }

  if (options.isPackaged) {
    const packagedOAuthEnv = path.join(options.resourcesPath, PACKAGED_OAUTH_ENV_FILE);
    return loadPackagedOAuthEnvFile(packagedOAuthEnv);
  }

  const developmentRoot = path.resolve(options.mainModuleDir, '../../..');
  return loadDevelopmentEnvFile(path.join(developmentRoot, '.env'));
}

function loadDevelopmentEnvFile(envFile: string): boolean {
  if (!existsSync(envFile)) return false;
  process.loadEnvFile(envFile);
  return true;
}

/** Main-process-only Google OAuth keys for packaged builds. */
function loadPackagedOAuthEnvFile(envFile: string): boolean {
  if (!existsSync(envFile)) return false;

  let loaded = false;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!ALLOWED_OAUTH_ENV_KEYS.has(key)) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.length === 0) continue;
    process.env[key] = value;
    loaded = true;
  }

  return loaded;
}
