import './styles.css';
import { renderDashboardPage } from './pages/DashboardPage';
import { ReviewLockApiClient } from './state/api';
import { inferEmbeddedSubreddit } from './state/runtimeContext';
import { ReviewLockStore } from './state/store';
import { DEMO_SUBREDDIT } from '../shared/constants';

const app = document.querySelector<HTMLDivElement>('#app');
const params = new URLSearchParams(window.location.search);
const api = new ReviewLockApiClient();
const requestedSubreddit = params.get('subreddit');
const initialDemo = params.get('demo') === 'true';
const shouldInferEmbeddedSubreddit =
  !requestedSubreddit || (initialDemo && requestedSubreddit === DEMO_SUBREDDIT);
const embeddedSubreddit = shouldInferEmbeddedSubreddit
  ? inferEmbeddedSubreddit(
      window.location.href,
      document.referrer,
      (globalThis as { devvit?: unknown }).devvit,
    )
  : undefined;
const store = new ReviewLockStore(
  api,
  requestedSubreddit ?? embeddedSubreddit ?? '',
  initialDemo,
);

const render = (): void => {
  if (app) {
    app.innerHTML = renderDashboardPage(store);
  }
};

store.subscribe(render);

app?.addEventListener('click', (event) => {
  const target =
    event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;

  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === 'unlock') {
    const lockId = target.dataset.lockId;
    const targetId = target.dataset.targetId;

    if (lockId && targetId) {
      store.requestConfirmation({ action: 'unlock', lockId, targetId });
    }
  }

  if (action === 'confirm-unlock') {
    const lockId = target.dataset.lockId;
    const targetId = target.dataset.targetId;

    if (lockId && targetId) {
      void store.unlock(lockId, targetId);
    }
  }

  if (action === 'dismiss-reopen') {
    const eventId = target.dataset.eventId;

    if (eventId) {
      store.requestConfirmation({ action: 'dismiss-reopen', eventId });
    }
  }

  if (action === 'confirm-dismiss-reopen') {
    const eventId = target.dataset.eventId;

    if (eventId) {
      void store.dismissReopen(eventId);
    }
  }

  if (action === 'cancel-confirmation') {
    store.clearConfirmation();
  }

  if (action === 'toggle-mode') {
    const demo = target.dataset.mode === 'demo';
    const url = new URL(window.location.href);
    url.searchParams.set('demo', demo ? 'true' : 'false');
    if (demo) {
      url.searchParams.set('subreddit', DEMO_SUBREDDIT);
    } else if (store.getLiveSubreddit()) {
      url.searchParams.set('subreddit', store.getLiveSubreddit());
    } else {
      url.searchParams.delete('subreddit');
    }
    window.history.replaceState({}, '', url.toString());
    void store.setDemo(demo);
  }

  if (action === 'retry-fetch') {
    void store.fetchState();
  }

  if (action === 'verify-runtime') {
    void store.verifyRuntime();
  }
});

render();
void (async () => {
  if (shouldInferEmbeddedSubreddit) {
    if (embeddedSubreddit) {
      store.updateSubredditContext(embeddedSubreddit);
    }

    try {
      const runtimeContext = await api.fetchRuntimeContext();
      if (
        runtimeContext.subreddit &&
        (!embeddedSubreddit || runtimeContext.subreddit === embeddedSubreddit)
      ) {
        store.updateSubredditContext(runtimeContext.subreddit);
      }
    } catch {
      // Dashboard data loading below will surface runtime connectivity failures.
    }
  }

  await store.fetchState();
})();
