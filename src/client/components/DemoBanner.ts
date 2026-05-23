export const renderDemoBanner = (isDemo: boolean): string =>
  isDemo
    ? `
      <div class="demo-banner" role="status">
        <strong>Demo mode</strong>
        <span>Seeded ReviewLock data is showing.</span>
      </div>
    `
    : '';
