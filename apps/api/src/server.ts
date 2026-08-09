import Fastify from 'fastify';
import envPlugin from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import helmetPlugin from './plugins/helmet.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import healthRoutes from './routes/health.js';
import contactRoutes from './routes/contact.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
    },
    bodyLimit: 1 * 1024 * 1024, // 1 MB — contact form only, no file uploads
    // Exactly one proxy hop sits in front of this service (Railway's edge).
    // trustProxy: 1 trusts only that hop and resolves request.ip to the
    // X-Forwarded-For entry Railway itself appended — not any earlier entry a
    // client could prepend by sending its own X-Forwarded-For header. Using
    // `true` instead would trust the whole chain and take the leftmost,
    // client-controlled entry, letting one visitor rotate fake addresses to
    // dodge (or, worse, collapse everyone else into) the rate-limit bucket.
    trustProxy: 1,
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
