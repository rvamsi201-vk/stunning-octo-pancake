import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadMainEnvironment } from './load-env.js';

const TEST_KEY = 'COMMAND_CENTRE_ENV_LOADER_TEST';

describe('loadMainEnvironment', () => {
  let directory = '';
  afterEach(() => {
    delete process.env[TEST_KEY];
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.SECRET_SHOULD_NOT_LOAD;
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('loads the project-root .env without depending on the current working directory', () => {
    directory = mkdtempSync(path.join(tmpdir(), 'cc-env-'));
    const projectRoot = path.join(directory, 'project');
    const compiledMainDir = path.join(projectRoot, 'dist-electron', 'electron', 'main');
    const unrelatedWorkingDir = path.join(directory, 'unrelated');
    mkdirSync(compiledMainDir, { recursive: true });
    mkdirSync(unrelatedWorkingDir, { recursive: true });
    writeFileSync(path.join(projectRoot, '.env'), `${TEST_KEY}=detected\n`);
    const previous = process.cwd();
    process.chdir(unrelatedWorkingDir);
    try {
      expect(loadMainEnvironment({ mainModuleDir: compiledMainDir, isPackaged: false, resourcesPath: directory })).toBe(true);
      expect(process.env[TEST_KEY]).toBe('detected');
    } finally {
      process.chdir(previous);
    }
  });

  it('loads only Google OAuth keys from packaged google-oauth.env', () => {
    directory = mkdtempSync(path.join(tmpdir(), 'cc-packaged-env-'));
    const resourcesPath = path.join(directory, 'resources');
    mkdirSync(resourcesPath, { recursive: true });
    writeFileSync(
      path.join(resourcesPath, 'google-oauth.env'),
      [
        'GOOGLE_OAUTH_CLIENT_ID=desktop-client-id.apps.googleusercontent.com',
        'GOOGLE_OAUTH_CLIENT_SECRET=',
        'SECRET_SHOULD_NOT_LOAD=never',
      ].join('\n'),
    );

    expect(loadMainEnvironment({ mainModuleDir: directory, isPackaged: true, resourcesPath })).toBe(true);
    expect(process.env.GOOGLE_OAUTH_CLIENT_ID).toBe('desktop-client-id.apps.googleusercontent.com');
    expect(process.env.GOOGLE_OAUTH_CLIENT_SECRET).toBeUndefined();
    expect(process.env.SECRET_SHOULD_NOT_LOAD).toBeUndefined();
  });
});
