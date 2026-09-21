import { z } from 'zod';

// ─── Request ──────────────────────────────────────────────────────────────────

export const seoStrategyRequestSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, 'Please describe your business or service (at least 5 characters)')
    .max(400, 'Description must be 400 characters or fewer'),
  audience: z.string().max(200).default(''),
  market: z.string().max(80).default('English'),
  goal: z.enum(['traffic', 'leads', 'content', 'visibility']).default('leads'),
  url: z.string().max(200).default(''),
  useWebContext: z.boolean().default(false),
  _honey: z.string().default(''),
}).strict();

export type SeoStrategyRequest = z.infer<typeof seoStrategyRequestSchema>;

// ─── Response ─────────────────────────────────────────────────────────────────
// Mirrors apps/ai/schemas/seo.py's _LenientModel classes: response_format=
// json_object only guarantees valid JSON syntax, not schema conformance, so
// the backend deliberately keeps most fields as plain strings with safe
// defaults (extra="allow") rather than strict enums — a live model phrasing
// e.g. intent_fit slightly differently than the prompt's prose must still
// validate, not fail closed. This schema mirrors that leniency exactly
// (z.string() where the backend has str, .passthrough() not .strict()) —
// tightening it here would silently reject live output the backend itself
// accepts, which is worse than not validating at all. rank/opportunity_score
// keep their numeric bounds because those, unlike the string fields, are an
// exact contract (_STEP2_SCHEMA) with no phrasing-drift risk.

export type SeoRelevance = 'high' | 'medium' | 'low';
export type SeoIntentFit = 'strong' | 'moderate' | 'weak';
export type SeoContentFormat =
  | 'landing page'
  | 'guide'
  | 'comparison article'
  | 'FAQ'
  | 'case study'
  | 'checklist'
  | 'tutorial';

const businessContextSchema = z.object({
  business_type: z.string().default(''),
  core_service: z.string().default(''),
  target_audience: z.string().default(''),
  value_proposition: z.string().default(''),
  pain_points: z.array(z.string()).default([]),
  competitive_differentiators: z.array(z.string()).default([]),
}).passthrough();

export type BusinessContext = z.infer<typeof businessContextSchema>;

const keywordCandidateSchema = z.object({
  term: z.string().default(''),
  type: z.string().default(''),
  intent: z.string().default(''),
}).passthrough();

export type KeywordCandidate = z.infer<typeof keywordCandidateSchema>;

const intentClusterSchema = z.object({
  intent: z.string().default(''),
  description: z.string().default(''),
  terms: z.array(z.string()).default([]),
  business_relevance: z.string().default(''),
}).passthrough();

export type IntentCluster = z.infer<typeof intentClusterSchema>;

const rankedOpportunitySchema = z.object({
  rank: z.number().int().min(1).max(10).default(1),
  term: z.string().default(''),
  intent: z.string().default(''),
  opportunity_score: z.number().int().min(0).max(100).default(0),
  lead_relevance: z.string().default(''),
  business_relevance: z.string().default(''),
  intent_fit: z.string().default(''),
  content_gap_potential: z.string().default(''),
  conversion_closeness: z.string().default(''),
  suggested_content_format: z.string().default(''),
  cta_angle: z.string().default(''),
  why_ranked_here: z.string().default(''),
}).passthrough();

export type RankedOpportunity = z.infer<typeof rankedOpportunitySchema>;

const contentIdeaSchema = z.object({
  title: z.string().default(''),
  format: z.string().default(''),
  target_terms: z.array(z.string()).default([]),
  rationale: z.string().default(''),
}).passthrough();

export type ContentIdea = z.infer<typeof contentIdeaSchema>;

const leadAngleSchema = z.object({
  angle: z.string().default(''),
  cta: z.string().default(''),
  target_terms: z.array(z.string()).default([]),
  rationale: z.string().default(''),
}).passthrough();

export type LeadAngle = z.infer<typeof leadAngleSchema>;

const roadmapPhaseSchema = z.object({
  phase: z.string().default(''),
  focus: z.string().default(''),
  items: z.array(z.string()).default([]),
  rationale: z.string().default(''),
}).passthrough();

export type RoadmapPhase = z.infer<typeof roadmapPhaseSchema>;

export const seoStrategyResultSchema = z.object({
  mode: z.enum(['live', 'mock']),
  summary: z.string().default(''),
  extracted_business_context: businessContextSchema.default({}),
  keyword_candidates: z.array(keywordCandidateSchema).default([]),
  intent_clusters: z.array(intentClusterSchema).default([]),
  reranked_opportunities: z.array(rankedOpportunitySchema).default([]),
  content_ideas: z.array(contentIdeaSchema).default([]),
  lead_generation_angles: z.array(leadAngleSchema).default([]),
  roadmap: z.array(roadmapPhaseSchema).default([]),
  warnings: z.array(z.string()).default([]),
  metadata: z.object({
    model: z.string(),
    used_web_context: z.boolean(),
    market: z.string(),
    goal: z.enum(['traffic', 'leads', 'content', 'visibility']),
    disclaimer: z.string(),
  }).passthrough(),
}).passthrough();

export type SeoStrategyResult = z.infer<typeof seoStrategyResultSchema>;
