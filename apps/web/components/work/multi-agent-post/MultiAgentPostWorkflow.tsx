'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { runMultiAgentPost } from '@/lib/api';
import type { MultiAgentPostResult } from '@ai/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type FinalReadyResult = Extract<MultiAgentPostResult, { status: 'final_ready' }>;

type Tone = 'clear' | 'professional' | 'practical' | 'founder-style' | 'technical' | 'concise';
type PostGoal = 'explain' | 'lesson' | 'announce' | 'summarize' | 'discuss';

type WorkflowState =
  | { stage: 'idle' }
  | { stage: 'running' }
  | { stage: 'revealing'; result: FinalReadyResult; revealedStepIndex: number; editedPost: string }
  | { stage: 'final_ready'; result: FinalReadyResult; editedPost: string }
  | { stage: 'unsafe_topic'; reason: string }
  | { stage: 'rate_limited' }
  | { stage: 'error'; message: string };

type Stage = WorkflowState['stage'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TONE_LABELS: Record<Tone, string> = {
  'clear': 'Clear',
  'professional': 'Professional',
  'practical': 'Practical',
  'founder-style': 'Founder-style',
  'technical': 'Technical',
  'concise': 'Concise',
};

const GOAL_LABELS: Record<PostGoal, string> = {
  'explain': 'Explain an idea',
  'lesson': 'Share a lesson',
  'announce': 'Announce a project',
  'summarize': 'Summarize research',
  'discuss': 'Start a discussion',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ stage }: { stage: Stage }) {
  const labels: Record<Stage, string> = {
    idle: 'Idle',
    running: 'Running…',
    revealing: 'Revealing…',
    final_ready: 'Ready',
    unsafe_topic: 'Topic blocked',
    rate_limited: 'Rate limited',
    error: 'Error',
  };

  const active = stage === 'running' || stage === 'revealing';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: 'var(--color-fg)', opacity: active ? 1 : 0.4 }}
        aria-hidden="true"
      />
      <span className="font-mono text-sm text-muted uppercase tracking-widest">
        {labels[stage]}
      </span>
    </div>
  );
}

function StepDot({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-fg flex-shrink-0"
      >
        <polyline points="2 6 4.5 8.5 10 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'skipped') {
    return (
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-border"
        style={{ opacity: 0.4 }}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-border-strong"
      style={{ opacity: 0.3 }}
      aria-hidden="true"
    />
  );
}

function CollapsibleDraft({ draft }: { draft: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  return (
    <div className="border border-border rounded-lg bg-surface">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-lg"
      >
        <span className="font-mono text-xs text-fg uppercase tracking-widest">
          Initial draft
        </span>
        <span className="font-mono text-sm text-muted" aria-hidden="true">
          {expanded ? '↑' : '↓'}
        </span>
      </button>
      {expanded && (
        <div id={id} className="px-5 pb-5 border-t border-border pt-4">
          <pre className="font-mono text-sm text-muted whitespace-pre-wrap leading-relaxed">
            {draft}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MultiAgentPostWorkflow() {
  const [state, setState] = useState<WorkflowState>({ stage: 'idle' });
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [postGoal, setPostGoal] = useState<PostGoal>('explain');
  const [useWebContext, setUseWebContext] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasRunOnce, setHasRunOnce] = useState(false);

  const topicId = useId();
  const audienceId = useId();
  const toneId = useId();
  const goalId = useId();
  const webContextId = useId();
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  // ── Revealing effect ─────────────────────────────────────────────────────

  useEffect(() => {
    if (state.stage !== 'revealing') return;

    const { result, revealedStepIndex, editedPost } = state;
    const TOTAL_STEPS = 5;

    if (revealedStepIndex > TOTAL_STEPS - 1) {
      setState({ stage: 'final_ready', result, editedPost });
      announce('All steps complete. Final post is ready to review.');
      return;
    }

    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.stage !== 'revealing') return prev;
        return { ...prev, revealedStepIndex: prev.revealedStepIndex + 1 };
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [state, announce]);

  // ── Run handler ─────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (topic.trim().length < 5) return;
    if (state.stage === 'running') return;

    setState({ stage: 'running' });
    setHasRunOnce(true);
    announce('Running workflow…');

    const result = await runMultiAgentPost({
      topic: topic.trim(),
      audience,
      tone,
      postGoal,
      useWebContext,
    });

    if (!result.ok) {
      if (result.error.includes('temporarily limited')) {
        setState({ stage: 'rate_limited' });
        announce('Demo rate limit reached.');
      } else {
        setState({ stage: 'error', message: result.error });
        announce('Workflow error.');
      }
      return;
    }

    const data = result.data;

    if (data.status === 'unsafe_topic') {
      setState({ stage: 'unsafe_topic', reason: data.reason });
      announce('Topic blocked.');
      return;
    }

    if (data.status === 'error') {
      setState({ stage: 'error', message: data.message });
      announce('Workflow error.');
      return;
    }

    if (data.status === 'final_ready') {
      setState({
        stage: 'revealing',
        result: data,
        revealedStepIndex: 0,
        editedPost: data.finalPost.fullPost,
      });
      announce('Workflow complete. Revealing results…');
    }
  }, [topic, audience, tone, postGoal, useWebContext, state.stage, announce]);

  // ── Copy handler ─────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (state.stage !== 'final_ready') return;
    try {
      await navigator.clipboard.writeText(state.editedPost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      announce('Post copied to clipboard.');
    } catch {
      // clipboard may be unavailable in some contexts
    }
  }, [state, announce]);

  // ── Reset handler ─────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setState({ stage: 'idle' });
    setTopic('');
    setAudience('');
    setTone('professional');
    setPostGoal('explain');
    setHasRunOnce(false);
    announce('Workflow reset.');
  }, [announce]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isRunning = state.stage === 'running';
  const isReadyToRun = topic.trim().length >= 5 && !isRunning;

  const currentResult: FinalReadyResult | null =
    state.stage === 'revealing' || state.stage === 'final_ready' ? state.result : null;

  const revealedIdx =
    state.stage === 'revealing'
      ? state.revealedStepIndex
      : state.stage === 'final_ready'
        ? 99
        : -1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg">
      {/* Live region */}
      <div ref={liveRegionRef} role="status" aria-live="polite" className="sr-only" />

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full opacity-30 bg-border-strong"
              aria-hidden="true"
            />
          ))}
          <span className="font-mono text-sm text-muted ml-1 opacity-60">
            Research-to-Post Workflow · live demo
          </span>
        </div>
        <StatusBadge stage={state.stage} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[620px]">

        {/* ── Left: Inputs + Timeline ── */}
        <div className="p-6 flex flex-col gap-6">
          <p className="font-mono text-sm text-muted uppercase tracking-widest">
            01 — Configure post
          </p>

          {/* Topic */}
          <div>
            <label
              htmlFor={topicId}
              className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest"
            >
              Post topic
            </label>
            <textarea
              id={topicId}
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 300))}
              disabled={isRunning}
              rows={3}
              maxLength={300}
              placeholder="How AI workflow automation can reduce manual coordination in operations teams"
              className="w-full border border-border bg-bg rounded px-3 py-2.5 font-mono text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors resize-none disabled:opacity-50"
              aria-describedby={`${topicId}-count`}
            />
            <div className="flex justify-end mt-1">
              <span
                id={`${topicId}-count`}
                className="font-mono text-sm text-subtle"
                aria-label={`${String(topic.length)} of 300 characters`}
              >
                {String(topic.length)}/300
              </span>
            </div>
          </div>

          {/* Audience */}
          <div>
            <label
              htmlFor={audienceId}
              className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest"
            >
              Target audience
              <span className="text-subtle ml-1 normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id={audienceId}
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value.slice(0, 160))}
              disabled={isRunning}
              maxLength={160}
              placeholder="e.g. startup founders, operations leads"
              className="w-full border border-border bg-bg rounded px-3 py-2 font-mono text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Tone */}
          <div>
            <label
              htmlFor={toneId}
              className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest"
            >
              Tone
            </label>
            <select
              id={toneId}
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              disabled={isRunning}
              className="w-full border border-border bg-bg rounded px-3 py-2 font-mono text-sm text-fg focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors disabled:opacity-50"
            >
              {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                <option key={t} value={t}>
                  {TONE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Post goal */}
          <div>
            <label
              htmlFor={goalId}
              className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest"
            >
              Post goal
            </label>
            <select
              id={goalId}
              value={postGoal}
              onChange={(e) => setPostGoal(e.target.value as PostGoal)}
              disabled={isRunning}
              className="w-full border border-border bg-bg rounded px-3 py-2 font-mono text-sm text-fg focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors disabled:opacity-50"
            >
              {(Object.keys(GOAL_LABELS) as PostGoal[]).map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          {/* Web context opt-in */}
          <div>
            <label htmlFor={webContextId} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                id={webContextId}
                type="checkbox"
                checked={useWebContext}
                onChange={(e) => setUseWebContext(e.target.checked)}
                disabled={isRunning}
                className="mt-0.5 w-3.5 h-3.5 accent-fg cursor-pointer disabled:opacity-50 flex-shrink-0"
              />
              <span className="font-mono text-sm text-muted group-hover:text-fg transition-colors leading-relaxed">
                Enrich research with web context
                <span className="block text-subtle mt-0.5">
                  Searches only the post topic online — never audience or other input fields.
                </span>
              </span>
            </label>
          </div>

          {/* Run / Reset */}
          <div className="flex flex-col gap-2">
            {isRunning ? (
              <div className="h-10 border border-border rounded flex items-center justify-center gap-2 font-mono text-sm text-muted">
                <span
                  className="w-3.5 h-3.5 border border-muted rounded-full border-t-transparent animate-spin"
                  aria-hidden="true"
                />
                Running workflow…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={!isReadyToRun}
                className="h-10 bg-fg text-bg rounded font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Run workflow
              </button>
            )}

            {hasRunOnce && !isRunning && (
              <button
                type="button"
                onClick={handleReset}
                className="h-9 border border-border rounded font-mono text-sm text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Reset
              </button>
            )}
          </div>

          {/* Workflow timeline (visible after first run) */}
          {currentResult && (
            <div className="border-t border-border pt-5 flex flex-col gap-2">
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-1">
                Workflow steps
              </p>
              {currentResult.steps.map((step, idx) => {
                const revealed = idx <= revealedIdx;
                return (
                  <div
                    key={step.name}
                    className="flex items-start gap-3 py-2 border-b border-border last:border-0"
                    style={{ opacity: revealed ? 1 : 0.3 }}
                  >
                    <StepDot status={revealed ? step.status : 'pending'} />
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-fg leading-tight">{step.name}</p>
                      {revealed && step.summary && (
                        <p className="font-mono text-sm text-muted mt-0.5 leading-relaxed">
                          {step.summary}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {currentResult.mockMode && (
                <div className="mt-2 border border-border rounded px-4 py-3 bg-surface">
                  <p className="font-mono text-sm text-muted leading-relaxed">
                    Demo mode — no AI provider configured. Drafts use deterministic fallback logic.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Output ── */}
        <div className="p-6 flex flex-col gap-5">
          <p className="font-mono text-sm text-muted uppercase tracking-widest">
            02 — Review output
          </p>

          {/* IDLE */}
          {state.stage === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
              <div
                className="w-10 h-10 border border-border rounded-lg flex items-center justify-center opacity-30"
                aria-hidden="true"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="font-mono text-sm text-subtle">
                Enter a topic and run the workflow to generate a post.
              </p>
              <p className="font-mono text-sm text-subtle/60 max-w-[28ch]">
                Five stages: research, draft, critique, revise, and groundedness check.
              </p>
            </div>
          )}

          {/* RUNNING skeleton */}
          {state.stage === 'running' && (
            <div className="flex-1 space-y-3 py-4">
              {[1, 0.7, 0.5].map((op, i) => (
                <div
                  key={i}
                  className="border border-border rounded p-4 animate-pulse"
                  style={{ opacity: op }}
                >
                  <div className="h-2 w-28 bg-border-strong rounded mb-3" />
                  <div className="h-3 bg-border rounded mb-2" />
                  <div className="h-3 bg-border rounded w-3/4" />
                </div>
              ))}
            </div>
          )}

          {/* REVEALING / progressive output */}
          {(state.stage === 'revealing' || state.stage === 'final_ready') && currentResult && (
            <div className="flex-1 flex flex-col gap-4">

              {/* Research context (step 0) */}
              {revealedIdx >= 0 && (
                <div className="border border-border rounded-lg bg-surface p-5">
                  <p className="font-mono text-xs text-fg uppercase tracking-widest mb-3">
                    Research context
                  </p>
                  {currentResult.researchContext?.contextPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0">
                      <span
                        className="mt-[0.5em] w-1 h-1 rounded-full bg-fg opacity-40 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-muted leading-relaxed">{point}</p>
                    </div>
                  ))}
                  {currentResult.researchContext?.sources && currentResult.researchContext.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      {currentResult.researchContext.sources.map((s, i) => (
                        <p key={i} className="font-mono text-sm text-subtle">
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-muted transition-colors underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
                            >
                              {s.title}
                            </a>
                          ) : (
                            s.title
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                  {currentResult.researchContext?.skippedReason && (
                    <p className="font-mono text-sm text-subtle mt-2">
                      Web context skipped: {currentResult.researchContext.skippedReason}
                    </p>
                  )}
                </div>
              )}

              {/* Initial draft (step 1) */}
              {revealedIdx >= 1 && (
                <CollapsibleDraft draft={currentResult.initialDraft} />
              )}

              {/* Critic feedback (step 2) */}
              {revealedIdx >= 2 && (
                <div className="border border-border rounded-lg bg-surface p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono text-xs text-fg uppercase tracking-widest">
                      Critic feedback
                    </p>
                    <span className="font-mono text-sm text-muted">
                      {String(currentResult.criticFeedback.score)} / 10
                    </span>
                  </div>
                  {currentResult.criticFeedback.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="font-mono text-xs text-muted uppercase tracking-widest mb-1.5">
                        Strengths
                      </p>
                      <ul className="space-y-1">
                        {currentResult.criticFeedback.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono text-sm text-subtle mt-0.5">+</span>
                            <span className="text-sm text-muted leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentResult.criticFeedback.issues.length > 0 && (
                    <div>
                      <p className="font-mono text-xs text-muted uppercase tracking-widest mb-1.5">
                        Issues
                      </p>
                      <ul className="space-y-1">
                        {currentResult.criticFeedback.issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono text-sm text-subtle mt-0.5">→</span>
                            <span className="text-sm text-muted leading-relaxed">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Revision notes (step 3) */}
              {revealedIdx >= 3 && currentResult.revisionNotes && (
                <div className="border border-border rounded-lg bg-surface px-5 py-4">
                  <p className="font-mono text-xs text-fg uppercase tracking-widest mb-2">
                    Revision notes
                  </p>
                  <p className="text-sm text-muted leading-relaxed">{currentResult.revisionNotes}</p>
                </div>
              )}
              {revealedIdx >= 3 && !currentResult.revisionNotes && (
                <div className="border border-border rounded-lg bg-surface px-5 py-4">
                  <p className="font-mono text-xs text-fg uppercase tracking-widest mb-2">
                    Revision
                  </p>
                  <p className="text-sm text-muted leading-relaxed">
                    Score sufficient — no revision needed.
                  </p>
                </div>
              )}

              {/* Groundedness (step 4) */}
              {revealedIdx >= 4 && (
                <div className="border border-border rounded-lg bg-surface px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-mono text-xs text-fg uppercase tracking-widest">
                      Groundedness
                    </p>
                    <span
                      className={`font-mono text-sm px-2.5 py-0.5 rounded border ${
                        currentResult.groundednessResult.status === 'grounded'
                          ? 'border-fg/20 text-fg bg-fg/5'
                          : currentResult.groundednessResult.status === 'needs_caution'
                            ? 'border-border text-muted'
                            : 'border-border-strong text-muted'
                      }`}
                    >
                      {currentResult.groundednessResult.status === 'grounded'
                        ? 'Grounded'
                        : currentResult.groundednessResult.status === 'needs_caution'
                          ? 'Needs caution'
                          : 'Unsupported'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted mt-1">
                    {currentResult.groundednessResult.groundingBasis === 'sources'
                      ? 'Checked against retrieved source material'
                      : currentResult.groundednessResult.groundingBasis === 'context'
                        ? "Checked against the workflow's own research context — not an independently retrieved source"
                        : 'No source material available — plausibility check only'}
                  </p>
                  {currentResult.groundednessResult.cautionNotes && (
                    <p className="text-sm text-muted leading-relaxed mt-2">
                      {currentResult.groundednessResult.cautionNotes}
                    </p>
                  )}
                  {currentResult.groundednessResult.unsupportedClaims.length > 0 && (
                    <div className="mt-2">
                      <p className="font-mono text-xs text-fg uppercase tracking-widest mb-1">
                        Unsupported claims
                      </p>
                      <ul className="text-sm text-muted leading-relaxed list-disc list-inside space-y-0.5">
                        {currentResult.groundednessResult.unsupportedClaims.map((claim) => (
                          <li key={claim}>{claim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Final post editor (final_ready only) */}
              {state.stage === 'final_ready' && (
                <div className="border border-border rounded-lg bg-surface p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="final-post-editor"
                      className="font-mono text-xs text-fg uppercase tracking-widest"
                    >
                      Final post — edit before copying
                    </label>
                    <span
                      className="font-mono text-sm text-subtle"
                      aria-label={`${String(state.editedPost.length)} of 3000 characters`}
                    >
                      {String(state.editedPost.length)}/3000
                    </span>
                  </div>
                  <textarea
                    id="final-post-editor"
                    value={state.editedPost}
                    onChange={(e) => {
                      const next = e.target.value;
                      setState((prev) => {
                        if (prev.stage !== 'final_ready') return prev;
                        return { ...prev, editedPost: next };
                      });
                    }}
                    rows={12}
                    maxLength={3000}
                    className="w-full border border-border bg-bg rounded px-3 py-2.5 font-mono text-sm text-fg focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors resize-y leading-relaxed"
                    aria-label="Final post — edit before copying"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="h-10 bg-fg text-bg rounded font-mono text-sm hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start px-5"
                    aria-label="Copy final post to clipboard"
                  >
                    {copied ? 'Copied!' : 'Copy post'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* UNSAFE_TOPIC */}
          {state.stage === 'unsafe_topic' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">
                  Topic blocked
                </p>
                <p className="text-sm text-muted leading-relaxed">{state.reason}</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="font-mono text-sm text-muted hover:text-fg transition-colors border border-border rounded px-3 py-1.5 self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Reset
              </button>
            </div>
          )}

          {/* RATE_LIMITED */}
          {state.stage === 'rate_limited' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">
                  Demo limit reached
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  This demo is temporarily limited to prevent abuse. Please try again later.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="font-mono text-sm text-muted hover:text-fg transition-colors border border-border rounded px-3 py-1.5 self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Reset
              </button>
            </div>
          )}

          {/* ERROR */}
          {state.stage === 'error' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">
                  Error
                </p>
                <p className="text-sm text-muted leading-relaxed">{state.message}</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="font-mono text-sm text-muted hover:text-fg transition-colors border border-border rounded px-3 py-1.5 self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Reset
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
