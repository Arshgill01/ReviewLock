import { describe, expect, it } from 'vitest';
import {
  inferEmbeddedSubreddit,
  normalizeSubredditName,
  subredditFromDevvitGlobal,
  subredditFromUrl,
} from './runtimeContext';

describe('runtime context helpers', () => {
  it('normalizes only valid subreddit names', () => {
    expect(normalizeSubredditName(' reviewlock_dev ')).toBe('reviewlock_dev');
    expect(normalizeSubredditName('reviewlock-dev')).toBeUndefined();
    expect(normalizeSubredditName('re')).toBeUndefined();
  });

  it('extracts subreddit names from Reddit post URLs', () => {
    expect(
      subredditFromUrl(
        'https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/',
      ),
    ).toBe('reviewlock_dev');
  });

  it('falls back to the embedding referrer when the WebView URL has no subreddit path', () => {
    expect(
      inferEmbeddedSubreddit(
        'https://reviewlock-i1a3xr-0-0-1-16-webview.devvit.net/index.html',
        'https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/',
      ),
    ).toBe('reviewlock_dev');
  });

  it('prefers the Devvit WebView context when the WebView URL has no subreddit path', () => {
    expect(
      subredditFromDevvitGlobal({
        context: {
          subredditName: 'reviewlock_dev',
        },
      }),
    ).toBe('reviewlock_dev');

    expect(
      inferEmbeddedSubreddit(
        'https://reviewlock-i1a3xr-0-0-2-4-webview.devvit.net/index.html',
        undefined,
        {
          context: {
            subredditName: 'reviewlock_dev',
          },
        },
      ),
    ).toBe('reviewlock_dev');
  });

  it('ignores malformed Devvit globals before checking Reddit URLs', () => {
    expect(subredditFromDevvitGlobal([])).toBeUndefined();
    expect(subredditFromDevvitGlobal({ context: 'reviewlock_dev' })).toBeUndefined();
    expect(
      subredditFromDevvitGlobal({
        context: {
          subredditName: ['reviewlock_dev'],
        },
      }),
    ).toBeUndefined();

    expect(
      inferEmbeddedSubreddit(
        'https://reviewlock-i1a3xr-0-0-2-4-webview.devvit.net/index.html',
        'https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/',
        {
          context: {
            subredditName: 'reviewlock-dev',
          },
        },
      ),
    ).toBe('reviewlock_dev');
  });

  it('rejects malformed Devvit context even when it has object-like nested fields', () => {
    expect(
      inferEmbeddedSubreddit(
        'https://reviewlock-i1a3xr-0-0-2-4-webview.devvit.net/index.html',
        'https://www.reddit.com/r/reviewlock_dev/comments/1tm8nak/reviewlock_dashboard/',
        {
          context: Object.assign(['reviewlock_dev'], { subredditName: 'reviewlock_dev' }),
        },
      ),
    ).toBe('reviewlock_dev');
  });
});
