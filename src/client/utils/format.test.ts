import { describe, expect, it } from 'vitest';
import {
  displayThingId,
  escapeAttr,
  escapeText,
  labelFromToken,
  safeRedditPermalinkHref,
} from './format';

describe('client format helpers', () => {
  it('escapes text content without over-escaping quotes', () => {
    expect(escapeText('A&B <tag> "quote"')).toBe('A&amp;B &lt;tag&gt; "quote"');
  });

  it('escapes attribute values including quotes', () => {
    expect(escapeAttr(`lock" onclick='x'`)).toBe('lock&quot; onclick=&#039;x&#039;');
  });

  it('formats enum tokens as readable labels', () => {
    expect(labelFromToken('content_changed')).toBe('content changed');
  });

  it('only removes canonical thing prefixes from target ids', () => {
    expect(displayThingId('t3_reviewed')).toBe('reviewed');
    expect(displayThingId('t1_comment')).toBe('comment');
    expect(displayThingId('prefix_t3_reviewed')).toBe('prefix_t3_reviewed');
  });

  it('allows only safe Reddit comment permalinks', () => {
    expect(safeRedditPermalinkHref('/r/reviewlock/comments/abc123/title/')).toBe(
      'https://www.reddit.com/r/reviewlock/comments/abc123/title/',
    );
    expect(safeRedditPermalinkHref('https://www.reddit.com/r/reviewlock/comments/abc123/title/')).toBe(
      'https://www.reddit.com/r/reviewlock/comments/abc123/title/',
    );
    expect(safeRedditPermalinkHref('javascript:alert(1)')).toBeNull();
    expect(safeRedditPermalinkHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeRedditPermalinkHref('https://reddit.example/r/reviewlock/comments/abc123')).toBeNull();
    expect(safeRedditPermalinkHref('//reddit.example/r/reviewlock/comments/abc123')).toBeNull();
    expect(safeRedditPermalinkHref('/r/reviewlock/about/modqueue')).toBeNull();
  });
});
