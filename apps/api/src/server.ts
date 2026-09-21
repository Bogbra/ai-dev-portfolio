import Fastify from 'fastify';
import type { Server } from 'node:http';
import envPlugin from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import helmetPlugin from './plugins/helmet.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import healthRoutes from './routes/health.js';
import contactRoutes from './routes/contact.js';

export async function buildApp() {
  const app = Fastify<Server>({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
    },
    bodyLimit: 1 * 1024 * 1024, // 1 MB — contact form only, no file uploads
    // Exactly one proxy hop sits in front of this service (Railway's edge).
    // Fastify >=5.12.1 (CVE-2026-16732) disabled the numeric trustProxy form
    // entirely — a hop count can't verify who the immediate peer actually is,
    // so it let an attacker with direct access spoof X-Forwarded-* and forge
    // the trusted hop. We trust by the edge's own IP range instead: Railway's
    // proxy always connects from 100.0.0.0/8, so only a request whose peer
    // falls in that range gets its X-Forwarded-For entry honored — a direct
    // client can't fake that range on the connecting socket itself. Using
    // `true` instead would trust the whole chain and take the leftmost,
    // client-controlled entry, letting one visitor rotate fake addresses to
    // dodge (or, worse, collapse everyone else into) the rate-limit bucket.
    trustProxy: '100.0.0.0/8',
  });

  // Order matters: env first so all plugins can read app.config
  await app.register(envPlugin);
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(errorHandlerPlugin);

  // Prevent any CDN or proxy from caching API responses.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0');
  });

  await app.register(healthRoutes);
  await app.register(contactRoutes);

  return app;
}

// Only start when invoked directly (not when imported by tests)
if (process.argv[1] === import.meta.filename) {
  const app = await buildApp();
  const port = app.config.PORT;
  await app.listen({ port, host: '0.0.0.0' });
}
