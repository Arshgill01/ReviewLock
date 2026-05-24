import './styles.css';
import { renderDashboardPage } from './pages/DashboardPage';
import { ReviewLockApiClient } from './state/api';
import { inferEmbeddedSubreddit } from './state/runtimeContext';
import { ReviewLockStore } from './state/store';

const app = document.querySelector<HTMLDivElement>('#app');
const params = new URLSearchParams(window.location.search);
const api = new ReviewLockApiClient();
const requestedSubreddit = params.get('subreddit');
const store = new ReviewLockStore(
  api,
  requestedSubreddit ?? 'reviewlock',
  params.get('demo') === 'true',
);

const render = (): void => {
  if (app) {
    app.innerHTML = renderDashboardPage(store);
  }
};

store.subscribe(render);

app?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;

  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === 'unlock') {
    const lockId = target.dataset.lockId;
    const targetId = target.dataset.targetId;

    if (lockId && targetId && window.confirm('Unlock this ReviewLock item?')) {
      void store.unlock(lockId, targetId);
    }
  }

  if (action === 'dismiss-reopen') {
    const eventId = target.dataset.eventId;

    if (eventId && window.confirm('Dismiss this reopened item?')) {
      void store.dismissReopen(eventId);
    }
  }

  if (action === 'toggle-mode') {
    const demo = target.dataset.mode === 'demo';
    const url = new URL(window.location.href);
    url.searchParams.set('demo', demo ? 'true' : 'false');
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
  if (!requestedSubreddit) {
    const embeddedSubreddit = inferEmbeddedSubreddit(window.location.href, document.referrer);
    if (embeddedSubreddit) {
      store.subreddit = embeddedSubreddit;
    }

    try {
      const runtimeContext = await api.fetchRuntimeContext();
      if (runtimeContext.subreddit) {
        store.subreddit = runtimeContext.subreddit;
      }
    } catch {
      // Dashboard data loading below will surface runtime connectivity failures.
    }
  }

  await store.fetchState();
})();
