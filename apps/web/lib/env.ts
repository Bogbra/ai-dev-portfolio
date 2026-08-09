import { z } from 'zod';

/**
 * Validiert Umgebungsvariablen beim Modulimport.
 * Schlägt mit einer klaren Fehlermeldung fehl, wenn eine Variable fehlt oder ungültig ist.
 * Nur NEXT_PUBLIC_*-Variablen — sie sind bewusst öffentlich und dürfen den Browser erreichen.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url('NEXT_PUBLIC_API_URL muss eine gültige URL sein (z.B. http://localhost:3001)'),
  NEXT_PUBLIC_AI_URL: z
    .string()
    .url('NEXT_PUBLIC_AI_URL must be a valid URL')
    .default('http://localhost:4000'),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL')
    .default('http://localhost:3000'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  NEXT_PUBLIC_AI_URL: process.env['NEXT_PUBLIC_AI_URL'],
  NEXT_PUBLIC_SITE_URL: process.env['NEXT_PUBLIC_SITE_URL'],
});
