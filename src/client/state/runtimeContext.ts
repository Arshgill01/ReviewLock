const SUBREDDIT_NAME_RE = /^[A-Za-z0-9_]{3,21}$/;
const SUBREDDIT_PATH_RE = /\/r\/([A-Za-z0-9_]{3,21})(?:[/?#]|$)/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const normalizeSubredditName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return SUBREDDIT_NAME_RE.test(trimmed) ? trimmed : undefined;
};

export const subredditFromDevvitGlobal = (value: unknown): string | undefined => {
  if (!isRecord(value) || !isRecord(value.context)) {
    return undefined;
  }

  return normalizeSubredditName(value.context.subredditName);
};

export const subredditFromUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const match = SUBREDDIT_PATH_RE.exec(value);
  return normalizeSubredditName(match?.[1]);
};

export const inferEmbeddedSubreddit = (
  locationHref: string,
  referrer?: string,
  devvitGlobal?: unknown,
): string | undefined =>
  subredditFromDevvitGlobal(devvitGlobal) ??
  subredditFromUrl(locationHref) ??
  subredditFromUrl(referrer);
