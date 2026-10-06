import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_USER_DATA_DIR, PRODUCTION_USER_DATA_DIR, resolveUserDataDirectoryName } from './app-paths.js';

describe('resolveUserDataDirectoryName', () => {
  it('uses the canonical production folder when packaged', () => {
    expect(resolveUserDataDirectoryName(true)).toBe(PRODUCTION_USER_DATA_DIR);
  });

  it('uses an isolated development folder when not packaged', () => {
    expect(resolveUserDataDirectoryName(false)).toBe(DEVELOPMENT_USER_DATA_DIR);
  });
});
