import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';

// ─── Test env ─────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
  process.env['NODE_ENV'] = 'test';
  // ENABLE_EMAIL_SENDING is off by default — no real emails in tests.
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function withApp(fn: (app: FastifyInstance) => Promise<void>): Promise<void> {
  const app = await buildApp();
  try {
    await fn(app);
  } finally {
    await app.close();
  }
}

const valid = {
  name: 'Dana Schmitt',
  email: 'dana@example.com',
  message: 'Hello, I would love to collaborate with you on a project.',
  consent: true,
  _honey: '',
};

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /contact — happy path', () => {
  it('returns 200 for a valid submission', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      });

      expect(res.statusCode).toBe(200);
      expect((res.json() as { message: string }).message).toBeTruthy();
    });
  });

  it('returns 200 and silently accepts a filled honeypot', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, _honey: 'bot was here' }),
      });

      expect(res.statusCode).toBe(200);
      expect((res.json() as { message: string }).message).toBe('Message received.');
    });
  });

  it('honeypot response has the same shape as a real success (no observable tell)', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, _honey: 'bot was here' }),
      });

      expect((res.json() as { delivered: boolean }).delivered).toBe(true);
    });
  });

  it('reports delivered: false when email sending is disabled', async () => {
    // ENABLE_EMAIL_SENDING is off by default in the test env (see beforeAll).
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      });

      expect(res.statusCode).toBe(200);
      expect((res.json() as { delivered: boolean }).delivered).toBe(false);
    });
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('POST /contact — validation', () => {
  it('returns 400 for an empty name', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, name: '' }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  it('returns 400 for an invalid email', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, email: 'not-an-email' }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  it('returns 400 for a message that is too short', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, message: 'Hi!' }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  it('returns 400 when consent is false', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, consent: false }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  it('returns 400 when consent is missing', async () => {
    await withApp(async (app) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { consent: _consent, ...withoutConsent } = valid;
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withoutConsent),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  it('returns 400 for an empty body', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.statusCode).toBe(400);
    });
  });
});

// ─── Response safety ──────────────────────────────────────────────────────────

describe('POST /contact — response safety', () => {
  it('does not expose internal error details on 400', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valid, email: 'bad' }),
      });

      const body = res.json() as { message?: string; stack?: string; issues?: unknown };
      expect(body.stack).toBeUndefined();
      expect(body.issues).toBeUndefined();
      expect(body.message).toBe('Invalid request. Please check your input.');
    });
  });

  it('does not log the submitter name or email when email sending is disabled', async () => {
    await withApp(async (app) => {
      const infoSpy = vi.spyOn(app.log, 'info');

      await app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      });

      expect(infoSpy).toHaveBeenCalled();
      for (const call of infoSpy.mock.calls) {
        const logged = JSON.stringify(call);
        expect(logged).not.toContain(valid.name);
        expect(logged).not.toContain(valid.email);
      }
    });
  });
});

// ─── Health route (smoke) ─────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200', async () => {
    await withApp(async (app) => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    });
  });
});
