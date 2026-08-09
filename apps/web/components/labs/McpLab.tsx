'use client';

import { useState } from 'react';
import { callMcpTool } from '@/lib/api';
import { useLang } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirrors apps/ai/schemas/mcp.py — this lab talks to the MCP server directly,
// not through a packages/types-shared contract (see lib/api.ts's callMcpTool).

type ExecutionInfo = {
  mode: 'live' | 'mock';
  remainingLiveCalls: number;
  liveCallLimit: number;
  fallbackReason: 'live_quota_exhausted' | 'live_mode_disabled' | null;
  durationMs: number;
};

type PostSource = { title: string; url: string | null; snippet: string };

type CreateResearchedPostResponse = {
  execution: ExecutionInfo;
  result: {
    post: string;
    sources: PostSource[];
    groundedness: string;
    criticScore: number;
    revised: boolean;
  };
};

type DemoStatusResponse = {
  liveEnabled: boolean;
  liveCallLimit: number;
  remainingLiveCalls: number;
  fallbackMode: 'mock';
};

type RunState = 'idle' | 'running' | 'done' | 'error';

type LastCall = {
  tool: 'create_researched_post' | 'get_demo_status';
  request: unknown;
  response: unknown;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modeBadge(mode: ExecutionInfo['mode']) {
  return (
    <span
      className={`font-mono text-xs px-2 py-0.5 rounded-sm ${
        mode === 'live' ? 'bg-accent/10 text-accent' : 'bg-border/60 text-subtle'
      }`}
    >
      {mode}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function McpLab() {
  const { t } = useLang();
  const mcp = t.labs.mcpServer;

  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState('');
  const [runState, setRunState] = useState<RunState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<CreateResearchedPostResponse | null>(null);
  const [quota, setQuota] = useState<DemoStatusResponse | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState('');
  const [lastCall, setLastCall] = useState<LastCall | null>(null);

  function friendlyError(error: string | undefined): string {
    if (error === 'temporarily limited') return mcp.rateLimit;
    if (error === 'timeout') return mcp.timeoutError;
    return error || mcp.genericError;
  }

  async function handleCheckStatus() {
    setQuotaLoading(true);
    setQuotaError('');
    const call = await callMcpTool<DemoStatusResponse>('get_demo_status', {});
    setLastCall({ tool: 'get_demo_status', request: call.request, response: call.response });
    if (call.ok && call.data) {
      setQuota(call.data);
    } else {
      setQuotaError(
        call.error === 'temporarily limited' || call.error === 'timeout'
          ? friendlyError(call.error)
          : mcp.quotaCheckFailed,
      );
    }
    setQuotaLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (trimmed.length < 5) {
      setTopicError(mcp.topicTooShort);
      return;
    }
    if (trimmed.length > 300) {
      setTopicError(mcp.topicTooLong);
      return;
    }
    setTopicError('');
    setErrorMsg('');
    setRunState('running');
    setResult(null);

    const call = await callMcpTool<CreateResearchedPostResponse>('create_researched_post', {
      topic: trimmed,
    });
    setLastCall({ tool: 'create_researched_post', request: call.request, response: call.response });

    if (call.ok && call.data) {
      const data = call.data;
      setResult(data);
      setRunState('done');
      // Always reflects the latest known quota after a run, regardless of
      // whether the user had already checked status — the run itself is
      // authoritative (it either consumed a slot or reported why not).
      // fallbackReason === 'live_mode_disabled' is the only case where
      // live is actually off; a quota-exhausted fallback still means live
      // mode itself is enabled, just out of slots for now.
      setQuota({
        liveEnabled: data.execution.fallbackReason !== 'live_mode_disabled',
        liveCallLimit: data.execution.liveCallLimit,
        remainingLiveCalls: data.execution.remainingLiveCalls,
        fallbackMode: 'mock',
      });
    } else {
      setErrorMsg(friendlyError(call.error));
      setRunState('error');
    }
  }

  function handleReset() {
    setRunState('idle');
    setResult(null);
    setErrorMsg('');
  }

  return (
    <div className="space-y-6">
      <p className="font-mono text-sm text-muted leading-relaxed max-w-prose">
        Every call below is a real{' '}
        <code className="text-fg">tools/call</code> JSON-RPC request, sent directly from this
        page to the running MCP endpoint (<code className="text-fg">/mcp/</code>), using the same
        wire protocol a real MCP client would. This page is a single well-formed request, not a
        full client — no session lifecycle, no other methods. Request and response are shown
        exactly as sent and received.
      </p>

      {/* Quota status */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleCheckStatus}
          disabled={quotaLoading}
          className="font-mono text-sm px-3 py-1.5 rounded-sm border border-border text-muted hover:text-fg hover:border-fg/40 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {quotaLoading ? mcp.checkingQuota : mcp.checkQuotaBtn}
        </button>
        {quota && (
          <span className="font-mono text-xs text-subtle" role="status">
            {quota.liveEnabled
              ? `${quota.remainingLiveCalls} / ${quota.liveCallLimit} ${mcp.quotaRemainingSuffix}`
              : mcp.liveDisabled}
          </span>
        )}
        {quotaError && (
          <span role="alert" className="font-mono text-xs text-[var(--color-danger)]">
            {quotaError}
          </span>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="mcp-topic" className="block font-mono text-sm text-muted mb-1.5">
            {mcp.topicLabel}
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              id="mcp-topic"
              name="topic"
              type="text"
              required
              minLength={5}
              maxLength={300}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={mcp.topicPlaceholder}
              className="flex-1 min-w-[240px] bg-bg border border-border rounded-md px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors duration-150"
              aria-describedby={topicError ? 'mcp-topic-error' : undefined}
              aria-invalid={topicError ? true : undefined}
            />
            <button
              type="submit"
              disabled={runState === 'running'}
              className="font-mono text-sm px-6 py-2.5 rounded-md bg-fg text-bg hover:opacity-90 transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {runState === 'running' ? mcp.runningLabel : mcp.runBtn}
            </button>
          </div>
          {topicError && (
            <p id="mcp-topic-error" role="alert" className="font-mono text-sm text-[var(--color-danger)] mt-1.5">
              {topicError}
            </p>
          )}
        </div>
      </form>

      {runState === 'error' && errorMsg && (
        <p role="alert" className="font-mono text-sm text-[var(--color-danger)]">
          {errorMsg}
        </p>
      )}

      {/* Result */}
      {runState === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted uppercase tracking-widest">
              {mcp.resultLabel}
            </span>
            {modeBadge(result.execution.mode)}
            {result.execution.fallbackReason && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-border/60 text-subtle">
                {result.execution.fallbackReason.replace(/_/g, ' ')}
              </span>
            )}
            <span className="font-mono text-xs text-subtle">
              {result.execution.durationMs}ms · groundedness: {result.result.groundedness} ·
              critic {result.result.criticScore}/10
              {result.result.revised ? ' · revised' : ''}
            </span>
            <span className="font-mono text-xs text-subtle" role="status">
              {result.execution.fallbackReason !== 'live_mode_disabled'
                ? `${result.execution.remainingLiveCalls} / ${result.execution.liveCallLimit} ${mcp.quotaRemainingSuffix}`
                : null}
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="font-mono text-sm px-3 py-1 rounded-sm border border-border text-muted hover:text-fg hover:border-fg/40 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ml-auto"
            >
              {mcp.newRunBtn}
            </button>
          </div>
          <p className="font-mono text-sm text-fg leading-relaxed whitespace-pre-wrap border border-border rounded-md p-4 bg-surface/40">
            {result.result.post}
          </p>
          {result.result.sources.length > 0 && (
            <div>
              <p className="font-mono text-xs text-subtle mb-2 uppercase tracking-widest">
                {mcp.sourcesLabel}
              </p>
              <ul className="space-y-2">
                {result.result.sources.map((source, i) => (
                  <li
                    key={i}
                    className="font-mono text-sm text-muted border border-border/50 rounded-sm px-3 py-2"
                  >
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fg hover:text-accent underline underline-offset-2"
                      >
                        {source.title || source.url}
                      </a>
                    ) : (
                      <span className="text-fg">{source.title || mcp.untitledSource}</span>
                    )}
                    {source.snippet && (
                      <p className="text-subtle mt-1">{source.snippet}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Raw request/response */}
      {lastCall && (
        <div aria-live="polite">
          <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
            {mcp.rawJsonRpcPrefix} {lastCall.tool}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-xs text-subtle mb-1">{mcp.requestLabel}</p>
              <pre className="font-mono text-xs text-muted border border-border rounded-md p-3 overflow-x-auto bg-surface/40 max-h-64 overflow-y-auto">
                {JSON.stringify(lastCall.request, null, 2)}
              </pre>
            </div>
            <div>
              <p className="font-mono text-xs text-subtle mb-1">{mcp.responseLabel}</p>
              <pre className="font-mono text-xs text-muted border border-border rounded-md p-3 overflow-x-auto bg-surface/40 max-h-64 overflow-y-auto">
                {JSON.stringify(lastCall.response, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
