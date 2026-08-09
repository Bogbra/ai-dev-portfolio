import { z } from 'zod';

export const PROJECT_TYPES = [
  'Design Engineering',
  'AI-native Product',
  'Frontend Engineering',
  'Design System',
  'Other',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or fewer'),

  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email must be 254 characters or fewer')
    // Guard against email/header injection — newlines in the email field
    // could be used to inject additional headers into the outgoing message.
    .refine((v) => !/[\r\n]/.test(v), 'Invalid email address'),

  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be 5000 characters or fewer'),

  // Privacy consent — must be explicitly true before submission is accepted.
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy to continue.' }),
  }),

  // Honeypot: accept any value here — the route decides silently.
  // Using z.literal('') would return 400 for bots and reveal the trap.
  _honey: z.string().default(''),
}).strict();

export type ContactPayload = z.infer<typeof contactSchema>;
