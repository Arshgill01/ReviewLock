const SUBREDDIT_NAME_RE = /^[A-Za-z0-9_]{3,21}$/;
const SUBREDDIT_PATH_RE = /\/r\/([A-Za-z0-9_]{3,21})(?:[/?#]|$)/;

type DevvitRuntimeGlobal = {
  context?: {
    subredditName?: unknown;
  };
};

export const normalizeSubredditName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return SUBREDDIT_NAME_RE.test(trimmed) ? trimmed : undefined;
};

export const subredditFromDevvitGlobal = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return normalizeSubredditName((value as DevvitRuntimeGlobal).context?.subredditName);
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
