import { z } from 'zod';

// ─── Upload request ───────────────────────────────────────────────────────────

export const ragUploadFileSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1), // base64
  mimeType: z.string().min(1).max(100),
}).strict();

export const ragUploadRequestSchema = z.object({
  files: z.array(ragUploadFileSchema).min(1).max(3),
}).strict();

export type RagUploadRequest = z.infer<typeof ragUploadRequestSchema>;

// ─── Ask request ──────────────────────────────────────────────────────────────

export const ragAskRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  sessionId: z.string().min(1).max(64),
  _honey: z.string().default(''),
}).strict();

export type RagAskRequest = z.infer<typeof ragAskRequestSchema>;

// ─── Retrieved chunk shown in UI ──────────────────────────────────────────────

export const retrievedChunkSchema = z.object({
  text: z.string(),
  filename: z.string(),
  pageNumber: z.number().optional(),
  score: z.number().min(0).max(1),
  usedInAnswer: z.boolean(),
});

export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;

// ─── Pipeline step for UI display ─────────────────────────────────────────────

export const pipelineStepSchema = z.object({
  name: z.string(),
  status: z.enum(['done', 'error']),
  detail: z.string().optional(),
});

export type PipelineStep = z.infer<typeof pipelineStepSchema>;

// ─── Upload result ────────────────────────────────────────────────────────────

export const ragUploadResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('indexed'),
    sessionId: z.string(),
    documentCount: z.number(),
    chunkCount: z.number(),
    pipelineSteps: z.array(pipelineStepSchema),
    mockMode: z.boolean(),
  }),
  z.object({
    status: z.literal('error'),
    message: z.string(),
  }),
]);

export type RagUploadResult = z.infer<typeof ragUploadResultSchema>;

// ─── Ask result ───────────────────────────────────────────────────────────────

export const ragAskResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('answer_ready'),
    answer: z.string(),
    reasoning: z.string(),
    sources: z.array(retrievedChunkSchema),
    confidence: z.enum(['high', 'medium', 'low']),
    mockMode: z.boolean(),
  }),
  z.object({
    status: z.literal('no_context'),
    message: z.string(),
  }),
  z.object({
    status: z.literal('unsafe_question'),
    message: z.string(),
  }),
  z.object({
    status: z.literal('error'),
    message: z.string(),
  }),
]);

export type RagAskResult = z.infer<typeof ragAskResultSchema>;
