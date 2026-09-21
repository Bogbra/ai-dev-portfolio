import { z } from 'zod';

// ─── Request ──────────────────────────────────────────────────────────────────

export const multiAgentPostRequestSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, 'Topic must be at least 5 characters')
    .max(300, 'Topic must be 300 characters or fewer'),
  audience: z.string().max(160).default(''),
  tone: z.enum(['clear', 'professional', 'practical', 'founder-style', 'technical', 'concise']),
  postGoal: z.enum(['explain', 'lesson', 'announce', 'summarize', 'discuss']),
  useWebContext: z.boolean().default(false),
  _honey: z.string().default(''),
}).strict();

export type MultiAgentPostRequest = z.infer<typeof multiAgentPostRequestSchema>;

// ─── Agent pipeline types ─────────────────────────────────────────────────────

export type AgentStep = {
  name: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  summary?: string;
};

export type SourceResult = {
  title: string;
  url?: string;
  snippet: string;
};

export type ResearchContext = {
  contextPoints: string[];
  sources: SourceResult[];
  // 'not_attempted' covers both opt-out cases (useWebContext off, or no
  // Tavily key configured); a real call reports what actually happened —
  // 'ok' (results found), 'no_results' (call succeeded, nothing relevant),
  // or 'provider_error' (the call itself failed) — so a provider outage
  // and a genuinely empty result stay distinguishable.
  researchStatus: 'not_attempted' | 'ok' | 'no_results' | 'provider_error';
  skippedReason?: string;
};

export type CriticFeedback = {
  score: number; // 0–10
  strengths: string[];
  issues: string[];
  revisionInstructions: string;
  needsRevision: boolean;
};

export type GroundednessResult = {
  status: 'grounded' | 'needs_caution' | 'unsupported';
  supportedClaims: string[];
  unsupportedClaims: string[];
  cautionNotes?: string;
  // What the check was actually verified against: 'sources' means real,
  // externally retrieved material (Tavily); 'context' means only the
  // workflow's own research synthesis (no external source, e.g. Tavily not
  // configured); 'none' means neither was available (plausibility check
  // only, incl. mock mode). Set deterministically by the backend, not the
  // model — the LLM already reports which claims it considers supported,
  // but what it was actually checking against is not something to ask it
  // to self-report.
  groundingBasis: 'sources' | 'context' | 'none';
};

export type FinalPostDraft = {
  hook: string;
  body: string;
  closingLine: string;
  hashtags: string[];
  fullPost: string; // max 3000 chars
};

// ─── Result (discriminated union) ─────────────────────────────────────────────

export const multiAgentPostResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('final_ready'),
    steps: z.array(
      z.object({
        name: z.string(),
        status: z.enum(['pending', 'running', 'done', 'skipped', 'error']),
        summary: z.string().optional(),
      }),
    ),
    researchContext: z
      .object({
        contextPoints: z.array(z.string()),
        sources: z.array(
          z.object({
            title: z.string(),
            url: z.string().optional(),
            snippet: z.string(),
          }),
        ),
        researchStatus: z.enum(['not_attempted', 'ok', 'no_results', 'provider_error']),
        skippedReason: z.string().optional(),
      })
      .optional(),
    sources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().optional(),
          snippet: z.string(),
        }),
      )
      .optional(),
    initialDraft: z.string(),
    criticFeedback: z.object({
      score: z.number().min(0).max(10),
      strengths: z.array(z.string()),
      issues: z.array(z.string()),
      revisionInstructions: z.string(),
      needsRevision: z.boolean(),
    }),
    revisionNotes: z.string().optional(),
    groundednessResult: z.object({
      status: z.enum(['grounded', 'needs_caution', 'unsupported']),
      supportedClaims: z.array(z.string()),
      unsupportedClaims: z.array(z.string()),
      cautionNotes: z.string().optional(),
      groundingBasis: z.enum(['sources', 'context', 'none']),
    }),
    finalPost: z.object({
      hook: z.string(),
      body: z.string(),
      closingLine: z.string(),
      hashtags: z.array(z.string()),
      fullPost: z.string().max(3000),
    }),
    usedWebContext: z.boolean(),
    mockMode: z.boolean(),
  }),
  z.object({
    status: z.literal('unsafe_topic'),
    reason: z.string(),
  }),
  z.object({
    status: z.literal('error'),
    message: z.string(),
  }),
]);

export type MultiAgentPostResult = z.infer<typeof multiAgentPostResultSchema>;
