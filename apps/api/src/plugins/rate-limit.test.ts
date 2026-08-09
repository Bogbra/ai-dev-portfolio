import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';

// ─── Test env ─────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
  process.env['NODE_ENV'] = 'test';
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const valid = {
  name: 'Dana Schmitt',
  email: 'dana@example.com',
  message: 'Hello, I would love to collaborate with you on a project.',
  consent: true,
  _honey: '',
};

// Simulates a request as it would arrive after Railway's single proxy hop:
// `remoteAddress` is the socket peer (Railway's edge), and `xff` is whatever
// X-Forwarded-For header reaches this process — a client-controlled leftmost
// entry followed by the real client IP that Railway itself appended.
function postFromEdge(app: FastifyInstance, xff: string) {
  return app.inject({
    method: 'POST',
    url: '/contact',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': xff },
    remoteAddress: '100.64.0.1', // stand-in for Railway's edge proxy socket
    body: JSON.stringify(valid),
  });
}

// ─── trustProxy hop resolution ────────────────────────────────────────────────

describe('rate limiting — trustProxy: 1 resolves the real peer, not the spoofed one', () => {
  it('shares one bucket across requests with the same real peer but different spoofed leftmost XFF entries', async () => {
    const app = await buildApp();

    // /contact allows max: 3 per 10 minutes. All four requests below share the
    // same rightmost XFF entry (the hop Railway appended) even though each
    // lies about a different leftmost entry — trustProxy: 1 must resolve them
    // to the same request.ip and therefore the same bucket.
    const realPeer = '9.9.9.9';
    const first = await postFromEdge(app, `1.2.3.4, ${realPeer}`);
    const second = await postFromEdge(app, `5.6.7.8, ${realPeer}`);
    const third = await postFromEdge(app, `7.7.7.7, ${realPeer}`);
    const fourth = await postFromEdge(app, `8.8.8.8, ${realPeer}`);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(200);
    expect(fourth.statusCode).toBe(429);

    await app.close();
  });

  it('keeps separate buckets for requests from different real peers', async () => {
    const app = await buildApp();

    const peerA = '9.9.9.9';
    const peerB = '4.4.4.4';

    // Exhaust peer A's bucket.
    await postFromEdge(app, `1.1.1.1, ${peerA}`);
    await postFromEdge(app, `1.1.1.1, ${peerA}`);
    await postFromEdge(app, `1.1.1.1, ${peerA}`);
    const blockedA = await postFromEdge(app, `1.1.1.1, ${peerA}`);
    expect(blockedA.statusCode).toBe(429);

    // Peer B, resolved from the same spoofed leftmost entry, is unaffected —
    // proving the bucket key is the real (rightmost) peer, not the leftmost.
    const freshB = await postFromEdge(app, `1.1.1.1, ${peerB}`);
    expect(freshB.statusCode).toBe(200);

    await app.close();
  });
});
