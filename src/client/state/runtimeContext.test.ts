import { describe, expect, it } from 'vitest';
import { inferEmbeddedSubreddit, subredditFromUrl } from './runtimeContext';

describe('runtime context helpers', () => {
  it('extracts subreddit names from Reddit post URLs', () => {
    expect(subredditFromUrl('https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/')).toBe(
      'reviewlock_dev',
    );
  });

  it('falls back to the embedding referrer when the WebView URL has no subreddit path', () => {
    expect(
      inferEmbeddedSubreddit(
        'https://reviewlock-i1a3xr-0-0-1-16-webview.devvit.net/index.html',
        'https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/',
      ),
    ).toBe('reviewlock_dev');
  });
});
