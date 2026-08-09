import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyError } from 'fastify';

export default fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const isDev = app.config.NODE_ENV === 'development';

    // Validierungsfehler (Zod / Fastify-Schema)
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Ungültige Eingabedaten.',
      });
    }

    // Rate-Limit
    if (error.statusCode === 429) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: error.message,
      });
    }

    // In Entwicklung: vollständige Fehlermeldung für Debugging
    // In Produktion: generische Meldung — kein Stack-Trace, keine internen Details
    app.log.error(error);

    return reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: 'Internal Server Error',
      message: isDev ? error.message : 'Ein Fehler ist aufgetreten.',
    });
  });
});
