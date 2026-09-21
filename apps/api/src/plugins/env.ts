import fp from 'fastify-plugin';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((o) => o.trim())),
  RESEND_API_KEY: z
    .string()
    .optional()
    .refine(
      (v) =>
        // Key is only required when email sending is actually enabled in production.
        process.env['NODE_ENV'] !== 'production' ||
        process.env['ENABLE_EMAIL_SENDING'] !== 'true' ||
        (typeof v === 'string' && v.length > 0),
      'RESEND_API_KEY is required when ENABLE_EMAIL_SENDING=true in production',
    ),
  MAIL_FROM: z.string().email('MAIL_FROM must be a valid email').default('portfolio@example.com'),
  MAIL_TO: z.string().email('MAIL_TO must be a valid email').default('owner@example.com'),
  ENABLE_EMAIL_SENDING: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}

export default fp(async function envPlugin(app: FastifyInstance) {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ungültige Umgebungsvariablen:\n${messages}`);
  }

  app.decorate('config', result.data);
});
