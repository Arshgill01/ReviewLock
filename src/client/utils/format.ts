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
