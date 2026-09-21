'use client';

import { useState, useRef } from 'react';
import { seoStrategyRequestSchema } from '@ai/types';
import type { SeoStrategyResult, RankedOpportunity, RoadmapPhase } from '@ai/types';
import { runSeoStrategy } from '@/lib/api';
import { useLang } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type RunState = 'idle' | 'running' | 'done' | 'error';

const WORKFLOW_STEPS = [
  'Validating input',
  'Extracting business context',
  'Generating keyword candidates',
  'Clustering search intent',
  'Reranking opportunities',
  'Building content roadmap',
  'Ready',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-fg';
  if (score >= 60) return 'text-muted';
  return 'text-subtle';
}

function relevanceBadge(val: string): string {
  if (val === 'high') return 'bg-fg/10 text-fg';
  if (val === 'medium') return 'bg-muted/10 text-muted';
  return 'bg-border/60 text-subtle';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkflowTrack({ step }: { step: number }) {
  return (
    <div className="font-mono text-sm space-y-2 py-2" role="status" aria-live="polite">
      {WORKFLOW_STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step - 1 && step < WORKFLOW_STEPS.length;
        const pending = i >= step;
        return (
          <div key={label} className="flex items-center gap-3">
            <span
              className={[
                'w-5 h-5 flex items-center justify-center rounded-sm border text-xs flex-shrink-0',
                done ? 'border-accent/40 text-accent bg-accent/5' : '',
                active ? 'border-fg text-fg' : '',
                pending && !done && !active ? 'border-border text-border' : '',
              ].join(' ')}
              aria-hidden="true"
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={[
                done ? 'text-muted line-through' : '',
                active ? 'text-fg' : '',
                pending && !done && !active ? 'text-border' : '',
              ].join(' ')}
            >
              {label}
            </span>
            {active && (
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1 h-1 rounded-full bg-fg animate-pulse"
                    style={{ animationDelay: `${d * 200}ms` }}
                  />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OpportunityCard({ opp, expanded, onToggle }: {
  opp: RankedOpportunity;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-4 py-3 text-left hover:bg-surface/60 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <span className="font-mono text-xs text-muted w-6 flex-shrink-0 mt-0.5">
          #{opp.rank}
        </span>

        {/* Term + intent */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-medium text-fg truncate">{opp.term}</p>
          <p className="font-mono text-sm text-muted mt-0.5 capitalize">
            {opp.intent.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <span className={`font-mono text-lg font-bold ${scoreColor(opp.opportunity_score)}`}>
            {opp.opportunity_score}
          </span>
          <span className="font-mono text-xs text-border">/100</span>
        </div>

        {/* Toggle icon */}
        <span
          className={`font-mono text-muted text-sm flex-shrink-0 mt-0.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ↓
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-3 bg-surface/40">
          {/* Signal badges */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['Lead Relevance', opp.lead_relevance],
                ['Business Relevance', opp.business_relevance],
                ['Intent Fit', opp.intent_fit],
                ['Content Gap', opp.content_gap_potential],
                ['Conversion', opp.conversion_closeness],
              ] as const
            ).map(([label, val]) => (
              <span
                key={label}
                className={`font-mono text-xs px-2 py-1 rounded-sm ${relevanceBadge(val)}`}
              >
                {label}: <span className="font-medium capitalize">{val}</span>
              </span>
            ))}
          </div>

          {/* Format + CTA */}
          <div className="space-y-1">
            <p className="font-mono text-sm text-muted">
              <span className="text-fg">Format:</span> {opp.suggested_content_format}
            </p>
            <p className="font-mono text-sm text-muted">
              <span className="text-fg">CTA:</span> {opp.cta_angle}
            </p>
          </div>

          {/* Why ranked */}
          <div className="border-l-2 border-accent/30 pl-3">
            <p className="font-mono text-sm text-muted leading-relaxed">
              <span className="text-fg font-medium">Why this rank: </span>
              {opp.why_ranked_here}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function RoadmapCard({ phase }: { phase: RoadmapPhase }) {
  return (
    <div className="border border-border rounded-md p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-2.5" aria-hidden="true" />
        <div>
          <p className="font-mono text-sm font-medium text-fg">{phase.phase}</p>
          <p className="font-mono text-sm text-muted mt-0.5">{phase.focus}</p>
        </div>
      </div>
      <ul className="space-y-1.5 mb-3">
        {phase.items.map((item, i) => (
          <li key={i} className="font-mono text-sm text-muted flex gap-2">
            <span className="text-accent/60 flex-shrink-0">→</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="font-mono text-sm text-subtle leading-relaxed border-t border-border/50 pt-2">
        {phase.rationale}
      </p>
    </div>
  );
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

type ResultTab = 'opportunities' | 'clusters' | 'content' | 'leads' | 'roadmap';

const RESULT_TABS: { id: ResultTab; label: string }[] = [
  { id: 'opportunities', label: 'Top Opportunities' },
  { id: 'clusters', label: 'Intent Clusters' },
  { id: 'content', label: 'Content Ideas' },
  { id: 'leads', label: 'Lead Angles' },
  { id: 'roadmap', label: 'Roadmap' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function SeoStrategyLab() {
  const { t } = useLang();
  const seo = t.labs.seoStrategy;
  const [runState, setRunState] = useState<RunState>('idle');
  const [workflowStep, setWorkflowStep] = useState(0);
  const [result, setResult] = useState<SeoStrategyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<ResultTab>('opportunities');
  const [expandedOpp, setExpandedOpp] = useState<number | null>(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function startStepAnimation() {
    setWorkflowStep(1);
    let current = 1;
    stepTimerRef.current = setInterval(() => {
      current += 1;
      // This is a fixed-interval animation with no real signal from the
      // backend (a single request/response, not a progress stream) — it's
      // indicative, not a live status. Capping at length-1 (the last real
      // step before 'Ready', which is only ever set on actual completion)
      // and settling there means a slow request reads as "still working on
      // the final stage", not frozen mid-way on an arbitrary earlier step
      // for however long the real request still has left to run.
      const last = WORKFLOW_STEPS.length - 1;
      if (current >= last) {
        setWorkflowStep(last);
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        return;
      }
      setWorkflowStep(current);
    }, 1800);
  }

  function stopStepAnimation(success: boolean) {
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    setWorkflowStep(success ? WORKFLOW_STEPS.length : 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setErrorMsg('');

    const form = e.currentTarget;
    const data = new FormData(form);

    const raw = {
      topic: String(data.get('topic') ?? ''),
      audience: String(data.get('audience') ?? ''),
      market: String(data.get('market') ?? 'English'),
      goal: String(data.get('goal') ?? 'leads') as 'traffic' | 'leads' | 'content' | 'visibility',
      url: String(data.get('url') ?? ''),
    };

    const parsed = seoStrategyRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setRunState('running');
    setResult(null);
    startStepAnimation();

    const res = await runSeoStrategy(parsed.data);

    stopStepAnimation(res.ok);

    if (res.ok) {
      setResult(res.data);
      setRunState('done');
      setActiveTab('opportunities');
      setExpandedOpp(0);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
      setErrorMsg(
        res.error === 'temporarily limited' ? seo.rateLimit
          : res.error === 'timeout' ? seo.timeoutError
          : res.error,
      );
      setRunState('error');
    }
  }

  async function handleCopy() {
    if (!result) return;
    const text = buildCopyText(result, seo.disclaimer);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setRunState('idle');
    setResult(null);
    setWorkflowStep(0);
    setErrorMsg('');
    setExpandedOpp(0);
  }

  return (
    <div className="space-y-6">
      {/* Input form */}
      {(runState === 'idle' || runState === 'error') && (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-4 lg:w-1/2">
            <SeoField
              label="Business / service description"
              id="seo-topic"
              name="topic"
              as="textarea"
              rows={3}
              required
              placeholder="e.g. AI workflow automation consulting for mid-size logistics companies"
              error={fieldErrors['topic']}
              hint="Describe what you do and who you serve"
            />
            <SeoField
              label="Target audience"
              id="seo-audience"
              name="audience"
              placeholder="e.g. operations managers at logistics companies with 50–500 employees"
              error={fieldErrors['audience']}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SeoField
              label="Market / language"
              id="seo-market"
              name="market"
              placeholder="e.g. English (US), German, English (UK)"
              defaultValue="English"
              error={fieldErrors['market']}
            />

            <div>
              <label htmlFor="seo-goal" className="block font-mono text-sm text-muted mb-1.5">
                SEO goal
              </label>
              <select
                id="seo-goal"
                name="goal"
                defaultValue="leads"
                className="w-full bg-bg border border-border rounded-md px-3 py-2.5 font-mono text-sm text-fg focus:outline-none focus:border-accent transition-colors duration-150"
              >
                <option value="leads">Lead generation</option>
                <option value="traffic">Traffic growth</option>
                <option value="content">Content strategy</option>
                <option value="visibility">Service visibility</option>
              </select>
            </div>

            <SeoField
              label="Website URL (optional)"
              id="seo-url"
              name="url"
              type="url"
              placeholder="https://example.com"
              error={fieldErrors['url']}
            />
          </div>

          {runState === 'error' && errorMsg && (
            <p role="alert" className="font-mono text-sm text-[var(--color-danger)]">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="font-mono text-sm px-6 py-2.5 rounded-md bg-fg text-bg hover:opacity-90 transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            {seo.generateBtn}
          </button>
        </form>
      )}

      {/* Workflow progress */}
      {runState === 'running' && (
        <div>
          <p className="font-mono text-xs text-muted mb-3 uppercase tracking-widest">
            {seo.runningLabel}
          </p>
          <WorkflowTrack step={workflowStep} />
        </div>
      )}

      {/* Results */}
      {runState === 'done' && result && (
        <div ref={resultRef} className="space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted uppercase tracking-widest">
                  {seo.strategyReady}
                </span>
                <span className={`font-mono text-xs px-2 py-0.5 rounded-sm ${result.mode === 'live' ? 'bg-accent/10 text-accent' : 'bg-border/60 text-subtle'}`}>
                  {result.mode === 'live' ? 'live' : 'mock'}
                </span>
                {result.metadata.used_web_context && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-border/60 text-subtle">
                    + {seo.webContext}
                  </span>
                )}
              </div>
              <p className="font-mono text-sm text-muted leading-relaxed max-w-prose">
                {result.summary}
              </p>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="font-mono text-sm px-3 py-1.5 rounded-sm border border-border text-muted hover:text-fg hover:border-fg/40 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label={seo.copyRoadmap}
              >
                {copied ? seo.copied : seo.copyRoadmap}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="font-mono text-sm px-3 py-1.5 rounded-sm border border-border text-muted hover:text-fg hover:border-fg/40 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {seo.newStrategy}
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="font-mono text-sm text-subtle border border-border/50 rounded-sm px-3 py-2">
            {seo.disclaimer}
          </p>

          {/* Tab bar */}
          <div
            role="tablist"
            aria-label="Strategy results"
            className="flex flex-wrap gap-1 border-b border-border pb-0"
          >
            {RESULT_TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={[
                  'font-mono text-sm px-3 py-2 rounded-t-sm border-b-2 -mb-px transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  activeTab === id
                    ? 'border-fg text-fg'
                    : 'border-transparent text-muted hover:text-fg',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div role="tabpanel">
            {activeTab === 'opportunities' && (
              <div className="space-y-2">
                {result.reranked_opportunities.map((opp, i) => (
                  <OpportunityCard
                    key={i}
                    opp={opp}
                    expanded={expandedOpp === i}
                    onToggle={() => setExpandedOpp(expandedOpp === i ? null : i)}
                  />
                ))}
              </div>
            )}

            {activeTab === 'clusters' && (
              <div className="space-y-3">
                {result.intent_clusters.map((cluster, i) => (
                  <div key={i} className="border border-border rounded-md p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-mono text-sm font-medium text-fg capitalize">
                        {cluster.intent.replace(/_/g, ' ')}
                      </p>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded-sm flex-shrink-0 ${relevanceBadge(cluster.business_relevance)}`}>
                        {cluster.business_relevance} relevance
                      </span>
                    </div>
                    <p className="font-mono text-sm text-muted mb-3 leading-relaxed">
                      {cluster.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.terms.map((term, j) => (
                        <span key={j} className="font-mono text-xs px-2 py-1 bg-surface border border-border rounded-sm text-muted">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-3">
                {result.content_ideas.map((idea, i) => (
                  <div key={i} className="border border-border rounded-md p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="font-mono text-xs text-accent border border-accent/30 px-2 py-0.5 rounded-sm flex-shrink-0">
                        {idea.format}
                      </span>
                    </div>
                    <p className="font-mono text-sm font-medium text-fg mb-2">{idea.title}</p>
                    <p className="font-mono text-sm text-muted leading-relaxed mb-2">
                      {idea.rationale}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {idea.target_terms.map((term, j) => (
                        <span key={j} className="font-mono text-xs text-subtle border border-border/50 px-2 py-0.5 rounded-sm">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'leads' && (
              <div className="space-y-3">
                {result.lead_generation_angles.map((angle, i) => (
                  <div key={i} className="border border-border rounded-md p-4">
                    <p className="font-mono text-sm font-medium text-fg mb-1">{angle.angle}</p>
                    <p className="font-mono text-sm text-accent mb-2">→ {angle.cta}</p>
                    <p className="font-mono text-sm text-muted leading-relaxed mb-2">
                      {angle.rationale}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {angle.target_terms.map((term, j) => (
                        <span key={j} className="font-mono text-xs text-subtle border border-border/50 px-2 py-0.5 rounded-sm">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'roadmap' && (
              <div className="space-y-3">
                {result.roadmap.map((phase, i) => (
                  <RoadmapCard key={i} phase={phase} />
                ))}
              </div>
            )}
          </div>

          {/* Warnings (mock mode etc.) */}
          {result.warnings.length > 0 && (
            <div className="border border-border/50 rounded-sm px-3 py-2">
              {result.warnings.map((w, i) => (
                <p key={i} className="font-mono text-xs text-subtle">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

type SeoFieldProps = {
  label: string;
  id: string;
  name: string;
  type?: string;
  as?: 'input' | 'textarea';
  rows?: number;
  required?: boolean | undefined;
  placeholder?: string;
  defaultValue?: string;
  hint?: string | undefined;
  error?: string | undefined;
};

function SeoField({
  label,
  id,
  name,
  type = 'text',
  as = 'input',
  rows = 3,
  required,
  placeholder,
  defaultValue,
  hint,
  error,
}: SeoFieldProps) {
  const baseClass = [
    'w-full bg-bg border rounded-md px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted/50',
    'focus:outline-none focus:border-accent transition-colors duration-150',
    error ? 'border-[var(--color-danger)]' : 'border-border',
  ].join(' ');

  return (
    <div>
      <label htmlFor={id} className="block font-mono text-sm text-muted mb-1.5">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {as === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          required={required}
          rows={rows}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className={`${baseClass} resize-y`}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className={baseClass}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
        />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="font-mono text-sm text-subtle mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="font-mono text-sm text-[var(--color-danger)] mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Copy text builder ────────────────────────────────────────────────────────

function buildCopyText(result: SeoStrategyResult, disclaimer: string): string {
  const lines: string[] = [
    '=== AI SEO STRATEGY ===',
    '',
    result.summary,
    '',
    '--- TOP OPPORTUNITIES ---',
  ];

  for (const opp of result.reranked_opportunities.slice(0, 5)) {
    lines.push(
      `#${opp.rank} ${opp.term} (Score: ${opp.opportunity_score}/100)`,
      `   Intent: ${opp.intent.replace(/_/g, ' ')} · Lead: ${opp.lead_relevance} · Format: ${opp.suggested_content_format}`,
      `   CTA: ${opp.cta_angle}`,
      `   Why: ${opp.why_ranked_here}`,
      '',
    );
  }

  lines.push('--- ROADMAP ---', '');
  for (const phase of result.roadmap) {
    lines.push(phase.phase, phase.focus);
    for (const item of phase.items) lines.push(`  → ${item}`);
    lines.push('');
  }

  lines.push('---', disclaimer);

  return lines.join('\n');
}
