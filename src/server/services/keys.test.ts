import { describe, expect, it } from 'vitest';
import { key, keys } from './keys';

describe('reviewlock redis keys', () => {
  it('namespaces every key by subreddit', () => {
    expect(key('modteam', 'locks:active')).toBe('reviewlock:modteam:locks:active');
    expect(keys.lock('modteam', 'lock-1')).toBe('reviewlock:modteam:lock:lock-1');
    expect(keys.targetLock('modteam', 't3_abc')).toBe('reviewlock:modteam:target:t3_abc:lock');
  });

  it('keeps subreddits isolated', () => {
    expect(keys.config('alpha')).not.toBe(keys.config('beta'));
  });
});
