const SUBREDDIT_PATH_RE = /\/r\/([A-Za-z0-9_]{3,21})(?:[/?#]|$)/;

export const subredditFromUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const match = SUBREDDIT_PATH_RE.exec(value);
  return match?.[1];
};

export const inferEmbeddedSubreddit = (locationHref: string, referrer?: string): string | undefined =>
  subredditFromUrl(locationHref) ?? subredditFromUrl(referrer);
