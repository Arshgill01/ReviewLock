import { describe, expect, it } from 'vitest';
import {
  failedSmokeResult,
  normalizeRuntimeSubreddit,
  verifiedSmokeResult,
} from './runtimeHardening';

describe('runtime hardening helpers', () => {
  it('defaults runtime smoke checks to the configured playtest subreddit', () => {
    expect(normalizeRuntimeSubreddit(undefined)).toBe('reviewlock_dev');
  });

  it('rejects invalid subreddit names before touching runtime adapters', () => {
    expect(() => normalizeRuntimeSubreddit('not a subreddit')).toThrow(/Subreddit/);
  });

  it('formats verified and failed smoke results without secrets', () => {
    expect(verifiedSmokeResult('redis', 'evidence', ['key=reviewlock:alpha:runtime:smoke:1'], 'now')).toMatchObject({
      capability: 'redis',
      status: 'verified',
      checkedAt: 'now',
    });
    expect(failedSmokeResult('redditContext', 'evidence', new Error('missing context'), 'now')).toMatchObject({
      capability: 'redditContext',
      status: 'failed',
      notes: ['missing context'],
    });
  });
});
