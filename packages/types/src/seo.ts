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
  _honey: z.string().default(''),
}).strict();

export type SeoStrategyRequest = z.infer<typeof seoStrategyRequestSchema>;

// ─── Response types ───────────────────────────────────────────────────────────

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

export type BusinessContext = {
  business_type: string;
  core_service: string;
  target_audience: string;
  value_proposition: string;
  pain_points: string[];
  competitive_differentiators: string[];
};

export type KeywordCandidate = {
  term: string;
  type: 'seed' | 'long-tail' | 'question' | 'comparison' | 'implementation';
  intent: string;
};

export type IntentCluster = {
  intent: string;
  description: string;
  terms: string[];
  business_relevance: SeoRelevance;
};

export type RankedOpportunity = {
  rank: number;
  term: string;
  intent: string;
  opportunity_score: number;
  lead_relevance: SeoRelevance;
  business_relevance: SeoRelevance;
  intent_fit: SeoIntentFit;
  content_gap_potential: SeoRelevance;
  conversion_closeness: SeoRelevance;
  suggested_content_format: string;
  cta_angle: string;
  why_ranked_here: string;
};

export type ContentIdea = {
  title: string;
  format: string;
  target_terms: string[];
  rationale: string;
};

export type LeadAngle = {
  angle: string;
  cta: string;
  target_terms: string[];
  rationale: string;
};

export type RoadmapPhase = {
  phase: string;
  focus: string;
  items: string[];
  rationale: string;
};

export type SeoStrategyResult = {
  mode: 'live' | 'mock';
  summary: string;
  extracted_business_context: BusinessContext;
  keyword_candidates: KeywordCandidate[];
  intent_clusters: IntentCluster[];
  reranked_opportunities: RankedOpportunity[];
  content_ideas: ContentIdea[];
  lead_generation_angles: LeadAngle[];
  roadmap: RoadmapPhase[];
  warnings: string[];
  metadata: {
    model: string;
    used_web_context: boolean;
    market: string;
    goal: string;
    disclaimer: string;
  };
};
