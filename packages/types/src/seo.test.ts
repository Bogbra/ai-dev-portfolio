import { describe, it, expect } from 'vitest';
import { seoStrategyResultSchema } from './seo.js';

const validMinimal = {
  mode: 'mock',
  metadata: {
    model: 'mock',
    used_web_context: false,
    market: 'English',
    goal: 'leads',
    disclaimer: 'Scores are AI-assisted prioritization signals, not live search-volume metrics.',
  },
};

describe('seoStrategyResultSchema — valid', () => {
  it('accepts a minimal result and fills in defaults for everything else', () => {
    const result = seoStrategyResultSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe('');
      expect(result.data.reranked_opportunities).toEqual([]);
      expect(result.data.warnings).toEqual([]);
    }
  });

  it('does not reject a live response whose string fields use phrasing outside the old strict unions — matching the backend Pydantic model, which keeps these as plain str for exactly this reason', () => {
    const result = seoStrategyResultSchema.safeParse({
      ...validMinimal,
      mode: 'live',
      reranked_opportunities: [
        {
          rank: 1,
          term: 'workflow automation',
          intent: 'commercial_investigation',
          opportunity_score: 82,
          lead_relevance: 'very high', // not in the old 'high'|'medium'|'low' union
          business_relevance: 'high',
          intent_fit: 'exceptionally strong', // not in the old 'strong'|'moderate'|'weak' union
          content_gap_potential: 'medium',
          conversion_closeness: 'high',
          suggested_content_format: 'Landing Page',
          cta_angle: 'Book a free strategy call',
          why_ranked_here: 'Matches the target audience and shows strong buying intent.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('passes through unknown extra fields instead of rejecting them (extra="allow" on the backend)', () => {
    const result = seoStrategyResultSchema.safeParse({
      ...validMinimal,
      someFutureField: 'unexpected but harmless',
    });
    expect(result.success).toBe(true);
  });
});

describe('seoStrategyResultSchema — invalid', () => {
  it('rejects a rank outside the documented 1-10 contract', () => {
    const result = seoStrategyResultSchema.safeParse({
      ...validMinimal,
      reranked_opportunities: [{ rank: 11, opportunity_score: 50 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an opportunity_score outside the documented 0-100 contract', () => {
    const result = seoStrategyResultSchema.safeParse({
      ...validMinimal,
      reranked_opportunities: [{ rank: 1, opportunity_score: 150 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown mode', () => {
    const result = seoStrategyResultSchema.safeParse({ ...validMinimal, mode: 'demo' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing metadata block', () => {
    const result = seoStrategyResultSchema.safeParse({ mode: 'mock' });
    expect(result.success).toBe(false);
  });
});
