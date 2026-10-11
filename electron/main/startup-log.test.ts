import { describe, expect, it } from 'vitest';
import { formatStartupError } from './startup-log.js';

describe('startup log', () => {
  it('formats Error instances with stack traces', () => {
    const error = new Error('migration failed');
    expect(formatStartupError(error)).toContain('migration failed');
  });
});
