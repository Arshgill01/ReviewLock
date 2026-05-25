import { describe, expect, it } from 'vitest';
import { classifyClientNotice } from './clientNotice';

describe('classifyClientNotice', () => {
  it('labels subreddit scope failures with a reload action', () => {
    const notice = classifyClientNotice(
      'API error: Dashboard subreddit scope does not match the Devvit runtime subreddit.',
    );

    expect(notice).toMatchObject({
      kind: 'subreddit_context',
      title: 'Subreddit context mismatch',
    });
    expect(notice.action).toContain('target subreddit');
  });

  it('labels unavailable Devvit runtime dependencies separately', () => {
    const notice = classifyClientNotice('API error: Redis adapter is not configured.');

    expect(notice).toMatchObject({
      kind: 'runtime_dependency',
      title: 'Runtime dependency unavailable',
    });
    expect(notice.action).toContain('Run runtime verification');
  });

  it('labels static preview contract failures without implying live proof', () => {
    const notice = classifyClientNotice(
      'API contract error at /api/overview: response was not valid JSON',
    );

    expect(notice).toMatchObject({
      kind: 'static_preview',
      title: 'Live API unavailable',
    });
    expect(notice.action).toContain('Devvit playtest');
  });

  it('keeps unknown failures retryable and non-destructive', () => {
    const notice = classifyClientNotice(new Error('unexpected dashboard failure'));

    expect(notice).toMatchObject({
      kind: 'unknown',
      title: 'Dashboard request failed',
      message: 'unexpected dashboard failure',
    });
    expect(notice.action).toContain('Retry once');
  });
});
