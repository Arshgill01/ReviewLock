import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <section class="loading-shell" aria-labelledby="reviewlock-title">
      <p class="eyebrow">ReviewLock</p>
      <h1 id="reviewlock-title">ReviewLock loading</h1>
      <p>Lock reviewed content until it changes.</p>
    </section>
  `;
}
