import { test, expect } from '@playwright/test';

// Unlike every other e2e test, this one needs apps/ai actually running and
// reachable at NEXT_PUBLIC_AI_URL — the MCP Lab calls /mcp/ directly with a
// real JSON-RPC request from the browser (see lib/api.ts's callMcpTool),
// not through a mocked or stubbed layer. CI starts apps/ai (no API keys,
// so it runs in mock mode — no cost, deterministic) before this suite.

test.describe('MCP Lab — real browser round trip against a running /mcp endpoint', () => {
  test('check demo quota, validate client-side, and run the agent workflow', async ({ page }) => {
    // /_vercel/insights/ — injected by Vercel's edge network in production;
    // 404s (and then fails the MIME-type check) under local/CI `next start`.
    // Same known noise smoke.spec.ts already filters.
    const isExpectedNoise = (text: string) => text.includes('/_vercel/insights/');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        !msg.text().startsWith('Failed to load resource:') &&
        !isExpectedNoise(msg.text())
      ) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');
    const heading = page.getByRole('heading', { name: 'MCP Server — Protocol Lab' });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    // A real fetch() -> /mcp/ tools/call -> JSON-RPC response round trip.
    await page.getByRole('button', { name: 'Check demo quota' }).click();
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });

    // Client-side validation must never reach the network.
    const topicInput = page.getByLabel('Topic for create_researched_post');
    await topicInput.fill('hi');
    await page.getByRole('button', { name: 'Run agent workflow' }).click();
    await expect(page.locator('#mcp-topic-error')).toBeVisible();

    // A real create_researched_post round trip (mock mode in CI — no
    // OPENAI_API_KEY configured for the apps/ai instance under test).
    await topicInput.fill('How evaluation improves RAG reliability');
    await page.getByRole('button', { name: 'Run agent workflow' }).click();
    await expect(page.getByText('Raw JSON-RPC — create_researched_post')).toBeVisible({
      timeout: 20_000,
    });

    const requestText = (await page.locator('pre').first().textContent()) ?? '';
    const responseText = (await page.locator('pre').nth(1).textContent()) ?? '';
    expect(requestText).toContain('"method": "tools/call"');
    expect(requestText).toContain('"name": "create_researched_post"');
    // The modern per-request envelope (protocol 2026-07-28) — proves this
    // is the current MCP request contract, not just any request the
    // server's legacy fallback happens to also accept.
    expect(requestText).toContain('"io.modelcontextprotocol/protocolVersion": "2026-07-28"');
    expect(requestText).toContain('"io.modelcontextprotocol/clientCapabilities"');
    expect(responseText).toContain('"execution"');
    expect(responseText).toContain('"mode"');
    // A HEADER_MISMATCH/UNSUPPORTED_PROTOCOL_VERSION rejection would put a
    // top-level "error" key here instead of "result" — this is the real
    // server's own validation ladder accepting the request as sent, not a
    // client-side assumption about what it sent.
    expect(responseText).not.toContain('"error"');

    expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});
