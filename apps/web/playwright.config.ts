import { defineConfig, devices } from '@playwright/test';

// Runs against a real production build (next build && next start), not the
// dev server — closer to what's actually deployed, and it's what next dev's
// on-demand compilation would otherwise mask (e.g. server/client boundary
// mistakes that only surface in an optimized build).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Fixed, not the host machine's locale — the site's language-detection
    // script reads navigator.language, and tests need a deterministic
    // starting language regardless of what machine/CI runner executes them.
    locale: 'en-US',
  },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
