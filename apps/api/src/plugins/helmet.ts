import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

export default fp(async function helmetPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    // Das API gibt nur JSON zurück — keine HTML-Responses, kein Browser-Rendering.
    // Content-Security-Policy ist daher irrelevant; Helmet-Defaults für andere Header
    // (X-Content-Type-Options, Referrer-Policy etc.) sind aktiv.
    contentSecurityPolicy: false,
  });
});
