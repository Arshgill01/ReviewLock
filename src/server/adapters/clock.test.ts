import { describe, expect, it } from 'vitest';
import { fixedClock, systemClock } from './clock';

describe('clock adapters', () => {
  it('returns fixed time in tests', () => {
    expect(fixedClock('2026-05-24T00:00:00.000Z').now()).toBe('2026-05-24T00:00:00.000Z');
  });

  it('returns an ISO-ish system time', () => {
    expect(systemClock.now()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
