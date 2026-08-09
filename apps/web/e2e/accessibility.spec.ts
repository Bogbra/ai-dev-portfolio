import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// Forces the reduced-motion fallback path instead of relying on a fixed
// timeout to outlast entrance animations — axe samples computed colors at
// scan time, and mid-transition opacity briefly produces a genuinely lower
// contrast reading that isn't the actual, settled UI. This also doubles as
// a check that the reduced-motion path (required — see components/motion)
// is itself accessible, not just faster to scan.
async function scanForSeriousViolations(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('accessibility (axe)', () => {
  test('homepage has no serious or critical WCAG violations', async ({ page }) => {
    const violations = await scanForSeriousViolations(page, '/');
    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n'),
    ).toHaveLength(0);
  });

  test('a case study page has no serious or critical WCAG violations', async ({ page }) => {
    const violations = await scanForSeriousViolations(page, '/work/research-rag-assistant');
    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n'),
    ).toHaveLength(0);
  });
});
