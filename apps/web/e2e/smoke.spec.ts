import { test, expect } from '@playwright/test';

test.describe('homepage smoke', () => {
  test('loads, renders every primary section, and logs no console errors', async ({ page }) => {
    // Expected noise in this frontend-only e2e run, not real app bugs:
    // - /_vercel/insights/ — injected by Vercel's edge network in
    //   production; 404s under any local/self-hosted server.
    // - localhost:3001 / :4000 — the contact API and AI backend aren't
    //   running here; VoiceAgentLab's status check on mount fails to
    //   connect. Full-stack behavior is covered separately (backend route
    //   tests, and this session's manual/CI docker-compose verification).
    const isExpectedNoise = (text: string) =>
      text.includes('/_vercel/insights/') ||
      text.includes('localhost:3001') ||
      text.includes('localhost:4000');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      // The browser's own generic "Failed to load resource: ..." messages
      // carry no URL to filter on — the requestfailed handler below always
      // reports the same underlying failure with its actual URL, so any
      // message in this generic form is redundant, never a unique signal.
      if (
        msg.type() === 'error' &&
        !msg.text().startsWith('Failed to load resource:') &&
        !isExpectedNoise(msg.text())
      ) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('requestfailed', (req) => {
      if (!isExpectedNoise(req.url())) {
        consoleErrors.push(`Request failed: ${req.url()} — ${req.failure()?.errorText}`);
      }
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/.+/);
    for (const id of ['work', 'labs', 'about', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toHaveLength(0);
  });

  test('skip link is the first focusable element and jumps to main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
  });

  test('language switcher updates html[lang] and nav copy', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: 'DE', exact: true }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('button', { name: 'DE', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('theme toggle changes html[data-theme]', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');

    await page.getByRole('button', { name: /switch to (light|dark) mode/i }).click();

    await expect(html).not.toHaveAttribute('data-theme', before ?? '');
  });

  test('contact form shows an accessible validation error on empty submit', async ({ page }) => {
    await page.goto('/#contact');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });
});
