import { z } from 'zod';

// ─── Contact record parsed from uploaded CSV/XLSX ─────────────────────────────

export const parsedContactSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  department: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
}).strict();

export type ParsedContact = z.infer<typeof parsedContactSchema>;

// ─── Upload request ───────────────────────────────────────────────────────────

export const uploadResponseSchema = z.object({
  contacts: z.array(parsedContactSchema),
  count: z.number().int().min(0),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

// ─── Workflow run request ─────────────────────────────────────────────────────

export const workflowRunRequestSchema = z.object({
  contacts: z
    .array(parsedContactSchema)
    .min(1, 'At least one contact is required')
    .max(100, 'Maximum 100 contacts per workflow'),
  request: z
    .string()
    .trim()
    .min(5, 'Request must be at least 5 characters')
    .max(500, 'Request must be 500 characters or fewer'),
  // Optional: user has confirmed a specific contact after ambiguity
  confirmedContactId: z.string().optional(),
  // Opt-in: search for topic context before generating the draft.
  // Only the subject matter is searched — never the contact name or email.
  useWebContext: z.boolean().default(false),
  // Honeypot
  _honey: z.string().default(''),
}).strict();

export type WorkflowRunRequest = z.infer<typeof workflowRunRequestSchema>;

// ─── Workflow result ──────────────────────────────────────────────────────────

export const emailDraftSchema = z.object({
  to: z.string(),
  toEmail: z.string().email(),
  subject: z.string().max(200),
  body: z.string().max(1500),
  tone: z.string(),
});

export type EmailDraft = z.infer<typeof emailDraftSchema>;

export const workflowResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('draft_ready'),
    contact: parsedContactSchema,
    draft: emailDraftSchema,
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    status: z.literal('ambiguous'),
    options: z.array(
      z.object({
        contact: parsedContactSchema,
        score: z.number().min(0).max(1),
        reasoning: z.string(),
      }),
    ),
    suggestion: parsedContactSchema,
    suggestionReasoning: z.string(),
  }),
  z.object({
    status: z.literal('not_found'),
    reason: z.string(),
  }),
  z.object({
    status: z.literal('unsafe_request'),
    reason: z.string(),
  }),
]);

export type WorkflowResult = z.infer<typeof workflowResultSchema>;

export type WorkflowRunResponse = WorkflowResult;
