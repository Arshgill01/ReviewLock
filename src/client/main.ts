import './styles.css';
import { renderDashboardPage } from './pages/DashboardPage';
import { ReviewLockApiClient } from './state/api';
import { ReviewLockStore } from './state/store';

const app = document.querySelector<HTMLDivElement>('#app');
const params = new URLSearchParams(window.location.search);
const store = new ReviewLockStore(
  new ReviewLockApiClient(),
  params.get('subreddit') ?? 'reviewlock',
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
});

render();
void store.fetchState();
