export type ClientNoticeKind =
  | 'api_error'
  | 'contract_error'
  | 'network_unavailable'
  | 'runtime_dependency'
  | 'runtime_unavailable'
  | 'static_preview'
  | 'subreddit_context'
  | 'unknown';

export interface ClientNotice {
  kind: ClientNoticeKind;
  title: string;
  message: string;
  action: string;
}

export const classifyClientNotice = (
  error: unknown,
  fallback = 'ReviewLock could not refresh dashboard state.',
): ClientNotice => {
  const message = errorMessage(error) || fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes('subreddit scope does not match') ||
    lower.includes('dashboard subreddit context is required') ||
    lower.includes('runtime smoke subreddit context is required') ||
    lower.includes('subreddit_isolation_failed')
  ) {
    return {
      kind: 'subreddit_context',
      title: 'Subreddit context mismatch',
      message,
      action: 'Reload ReviewLock from the target subreddit, then retry live mode.',
    };
  }

  if (
    lower.includes('upgrade required') ||
    lower.includes('devvit context') ||
    lower.includes('runtime capability') ||
    lower.includes('not available in this webview')
  ) {
    return {
      kind: 'runtime_unavailable',
      title: 'Devvit runtime unavailable',
      message,
      action: 'Open the installed Devvit playtest WebView or switch to labeled demo data.',
    };
  }

  if (
    lower.includes('redis adapter is not configured') ||
    lower.includes('dependencies are not configured') ||
    lower.includes('reddit adapter is not configured')
  ) {
    return {
      kind: 'runtime_dependency',
      title: 'Runtime dependency unavailable',
      message,
      action: 'Run runtime verification after the Devvit app reloads, then retry.',
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  ) {
    return {
      kind: 'network_unavailable',
      title: 'Network request failed',
      message,
      action: 'Check the Reddit WebView connection and retry the refresh.',
    };
  }

  if (
    lower.includes('response was not valid json') ||
    lower.includes('unexpected token') ||
    lower.includes('<!doctype') ||
    lower.includes('returned 404')
  ) {
    return {
      kind: 'static_preview',
      title: 'Live API unavailable',
      message,
      action: 'Open ReviewLock through Devvit playtest for live data, or use demo mode.',
    };
  }

  if (lower.includes('api contract error')) {
    return {
      kind: 'contract_error',
      title: 'Unexpected API response',
      message,
      action: 'Retry once. If it repeats, keep live actions paused and record the runtime proof gap.',
    };
  }

  if (lower.includes('api error')) {
    return {
      kind: 'api_error',
      title: 'Dashboard request failed',
      message,
      action: 'Review the error, retry, and avoid live mutations until the refresh succeeds.',
    };
  }

  return {
    kind: 'unknown',
    title: 'Dashboard request failed',
    message,
    action: 'Retry once. If it repeats, keep the visible state and record the failure.',
  };
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
};
