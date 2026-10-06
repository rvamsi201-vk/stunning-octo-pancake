import { describe, expect, it } from 'vitest';
import { calculateBaseT } from './grading.js';

describe('calculateBaseT', () => {
  it('selects the stronger deterministic formula', () => expect(calculateBaseT({ finalExam: 80, quiz1: 70, quiz2: 90 })).toBe(80.5));
  it('does not add bonus to the underlying pass score', () => expect(calculateBaseT({ finalExam: 50, quiz1: 50, quiz2: 50, bonus: 20 })).toBe(50));
});
