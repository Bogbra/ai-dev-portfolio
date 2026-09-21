import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export default fp(async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    // Globales Limit: 100 Requests pro Minute pro IP
    max: 100,
    timeWindow: '1 minute',
    // Sanfte Fehlermeldung ohne interne Details
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Zu viele Anfragen. Bitte in ${String(context.after)} erneut versuchen.`,
    }),
  });
});
