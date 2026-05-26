export const escapeText = (value: string | number | undefined | null): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

export const escapeAttr = (value: string | number | undefined | null): string =>
  escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export const labelFromToken = (value: string): string => value.replaceAll('_', ' ');

export const formatLocalDate = (value: string): string => new Date(value).toLocaleDateString();

export const formatLocalDateTime = (value: string): string => new Date(value).toLocaleString();

export const displayThingId = (targetId: string): string =>
  targetId.replace(/^t1_/, '').replace(/^t3_/, '');

const redditHosts = new Set(['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com']);

const isSafeRedditPath = (path: string): boolean =>
  /^\/r\/[A-Za-z0-9_]+\/comments\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9._~!$&()*+,;=:@%/-]*)?$/.test(
    path,
  );

export const safeRedditPermalinkHref = (value: string | undefined | null): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('/')) {
    return isSafeRedditPath(raw) ? raw : null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !redditHosts.has(url.hostname.toLowerCase())) {
      return null;
    }

    const pathWithQuery = `${url.pathname}${url.search}`;
    return isSafeRedditPath(url.pathname) ? pathWithQuery : null;
  } catch {
    return null;
  }
};
