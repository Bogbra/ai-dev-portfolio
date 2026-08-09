'use client';

import { useRef, useState, useCallback, useId } from 'react';
import { parseWorkflowUpload, runWorkflow } from '@/lib/api';
import type { ParsedContact, WorkflowRunResponse, EmailDraft } from '@ai/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Stage =
  | 'idle'
  | 'uploading'
  | 'upload_error'
  | 'ready'
  | 'running'
  | 'ambiguous'
  | 'no_contact_found'
  | 'unsafe'
  | 'draft_ready'
  | 'approved'
  | 'rate_limited'
  | 'error';

type WorkflowState =
  | { stage: 'idle' }
  | { stage: 'uploading' }
  | { stage: 'upload_error'; message: string }
  | { stage: 'ready'; contacts: ParsedContact[]; count: number; filename: string }
  | { stage: 'running'; contacts: ParsedContact[]; count: number; filename: string }
  | {
      stage: 'ambiguous';
      contacts: ParsedContact[];
      count: number;
      filename: string;
      options: { contact: ParsedContact; reasoning: string }[];
      suggestion: ParsedContact;
      suggestionReasoning: string;
      request: string;
    }
  | { stage: 'no_contact_found'; reason: string; contacts: ParsedContact[]; count: number; filename: string }
  | { stage: 'unsafe'; contacts: ParsedContact[]; count: number; filename: string }
  | {
      stage: 'draft_ready';
      contacts: ParsedContact[];
      count: number;
      filename: string;
      contact: ParsedContact;
      draft: EmailDraft;
      editedDraft: EmailDraft;
      reasoning: string;
      confidence: number;
    }
  | { stage: 'approved'; contact: ParsedContact; draft: EmailDraft; contacts: ParsedContact[]; count: number; filename: string }
  | { stage: 'rate_limited' }
  | { stage: 'error'; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB

function isAccepted(file: File): boolean {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'csv' || ext === 'xlsx';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" aria-label={`Confidence: ${String(pct)}%`}>
      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-fg rounded-full transition-all duration-500"
          style={{ width: `${String(pct)}%`, opacity: 0.6 + value * 0.4 }}
        />
      </div>
      <span className="font-mono text-sm text-muted w-8 text-right">{String(pct)}%</span>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ stage }: { stage: Stage }) {
  const labels: Partial<Record<Stage, string>> = {
    idle: 'Idle',
    uploading: 'Uploading…',
    upload_error: 'Upload failed',
    ready: 'Ready',
    running: 'Processing…',
    ambiguous: 'Ambiguous match',
    no_contact_found: 'Not found',
    unsafe: 'Request blocked',
    draft_ready: 'Draft ready',
    approved: 'Approved',
    rate_limited: 'Rate limited',
    error: 'Error',
  };

  const active = ['running', 'uploading'].includes(stage);
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: 'var(--color-fg)', opacity: active ? 1 : 0.4 }}
        aria-hidden="true"
      />
      <span className="font-mono text-sm text-muted uppercase tracking-widest">
        {labels[stage] ?? stage}
      </span>
    </div>
  );
}

function UploadZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div>
      <label
        htmlFor={id}
        className={`
          block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-150
          focus-within:outline focus-within:outline-2 focus-within:outline-offset-2
          ${dragOver
            ? 'border-fg bg-fg/5'
            : 'border-border hover:border-border-strong bg-bg'
          }
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        aria-label="Upload CSV or XLSX file"
      >
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            // Reset so the same file can be re-uploaded
            e.target.value = '';
          }}
        />
        <svg
          aria-hidden="true"
          className="mx-auto mb-3 opacity-40"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
        </svg>
        <p className="font-mono text-sm text-muted mb-1">
          {dragOver ? 'Drop file here' : 'Drag & drop or click to upload'}
        </p>
        <p className="font-mono text-sm text-subtle">CSV or XLSX · max 1 MB · max 100 contacts</p>
      </label>

      <div className="mt-3 px-1">
        <p className="font-mono text-sm text-subtle leading-relaxed">
          <span className="text-muted">Required columns:</span> name · email
        </p>
        <p className="font-mono text-sm text-subtle mt-0.5">
          <span className="text-muted">Optional:</span> department · role · company · notes
        </p>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  selected,
  onClick,
  badge,
}: {
  contact: ParsedContact;
  selected?: boolean;
  onClick?: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        w-full text-left p-4 border rounded-lg transition-colors duration-150 relative
        ${selected
          ? 'border-fg bg-fg/5'
          : 'border-border hover:border-border-strong bg-bg'
        }
        ${onClick ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2' : 'cursor-default'}
      `}
      aria-pressed={selected}
    >
      {badge && (
        <span className="absolute top-2 right-2 font-mono text-sm text-muted border border-border rounded px-2 py-0.5">
          {badge}
        </span>
      )}
      <p className="font-mono text-sm text-fg font-medium mb-0.5">{contact.name}</p>
      <p className="font-mono text-sm text-muted">{contact.email}</p>
      {(contact.department ?? contact.role) && (
        <p className="font-mono text-sm text-subtle mt-1">
          {[contact.role, contact.department].filter(Boolean).join(' · ')}
        </p>
      )}
    </button>
  );
}

function DraftEditor({
  draft,
  onChange,
}: {
  draft: EmailDraft;
  onChange: (field: keyof EmailDraft, value: string) => void;
}) {
  const toId = useId();
  const subjectId = useId();
  const bodyId = useId();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={toId} className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest">
          To
        </label>
        <input
          id={toId}
          type="text"
          value={draft.to}
          onChange={(e) => onChange('to', e.target.value)}
          className="w-full border border-border bg-bg rounded px-3 py-2 font-mono text-sm text-fg focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors"
          aria-label="Recipient name"
        />
        <p className="font-mono text-sm text-subtle mt-1">{draft.toEmail}</p>
      </div>

      <div>
        <label htmlFor={subjectId} className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest">
          Subject
        </label>
        <input
          id={subjectId}
          type="text"
          value={draft.subject}
          onChange={(e) => onChange('subject', e.target.value)}
          className="w-full border border-border bg-bg rounded px-3 py-2 font-mono text-sm text-fg focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors"
          aria-label="Email subject"
        />
      </div>

      <div>
        <label htmlFor={bodyId} className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest">
          Body
        </label>
        <textarea
          id={bodyId}
          value={draft.body}
          onChange={(e) => onChange('body', e.target.value)}
          rows={10}
          className="w-full border border-border bg-bg rounded px-3 py-2 font-mono text-sm text-fg focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors resize-y leading-relaxed"
          aria-label="Email body"
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiOpsWorkflow() {
  const [state, setState] = useState<WorkflowState>({ stage: 'idle' });
  const [request, setRequest] = useState('');
  const [useWebContext, setUseWebContext] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestId = useId();
  const webContextId = useId();
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  // ── File upload handler ──
  const handleFile = useCallback(
    async (file: File) => {
      if (!isAccepted(file)) {
        setState({ stage: 'upload_error', message: 'Unsupported file type. Please upload a CSV or XLSX file.' });
        return;
      }
      if (file.size > MAX_BYTES) {
        setState({
          stage: 'upload_error',
          message: `File too large (${formatBytes(file.size)}). Maximum size is 1 MB.`,
        });
        return;
      }

      setState({ stage: 'uploading' });
      announce('Uploading and parsing file…');

      const result = await parseWorkflowUpload(file);
      if (!result.ok) {
        if (result.error.includes('temporarily limited')) {
          setState({ stage: 'rate_limited' });
          announce('Rate limit reached.');
        } else {
          setState({ stage: 'upload_error', message: result.error });
          announce('Upload failed.');
        }
        return;
      }

      setState({
        stage: 'ready',
        contacts: result.data.contacts,
        count: result.data.count,
        filename: file.name,
      });
      announce(`File parsed. ${String(result.data.count)} contacts loaded.`);
    },
    [announce],
  );

  // ── Workflow run handler ──
  const handleRun = useCallback(
    async (confirmedContactId?: string) => {
      const contacts =
        state.stage === 'ready' ||
        state.stage === 'running' ||
        state.stage === 'ambiguous' ||
        state.stage === 'no_contact_found' ||
        state.stage === 'unsafe' ||
        state.stage === 'draft_ready'
          ? (state as { contacts: ParsedContact[]; count: number; filename: string } & WorkflowState).contacts
          : null;

      const filename =
        contacts !== null
          ? (state as { filename: string } & WorkflowState).filename ?? ''
          : '';
      const count = contacts !== null
        ? (state as { count: number } & WorkflowState).count ?? 0
        : 0;

      if (!contacts || contacts.length === 0) return;
      if (request.trim().length < 5) return;

      setState({ stage: 'running', contacts, count, filename });
      announce('Running workflow…');

      const result = await runWorkflow({
        contacts,
        request: request.trim(),
        confirmedContactId,
        useWebContext,
      });

      if (!result.ok) {
        if (result.error.includes('temporarily limited') || result.error.includes('rate')) {
          setState({ stage: 'rate_limited' });
          announce('Rate limit reached.');
        } else if (result.error.includes('abusive')) {
          setState({ stage: 'unsafe', contacts, count, filename });
          announce('Request blocked.');
        } else {
          setState({ stage: 'error', message: result.error });
          announce('Workflow error.');
        }
        return;
      }

      const res: WorkflowRunResponse = result.data;

      if (res.status === 'draft_ready') {
        setState({
          stage: 'draft_ready',
          contacts,
          count,
          filename,
          contact: res.contact,
          draft: res.draft,
          editedDraft: { ...res.draft },
          reasoning: res.reasoning,
          confidence: res.confidence,
        });
        announce('Draft ready for review.');
        return;
      }

      if (res.status === 'ambiguous') {
        setState({
          stage: 'ambiguous',
          contacts,
          count,
          filename,
          options: res.options,
          suggestion: res.suggestion,
          suggestionReasoning: res.suggestionReasoning,
          request: request.trim(),
        });
        announce('Multiple contacts match. Please confirm the recipient.');
        return;
      }

      if (res.status === 'not_found') {
        setState({ stage: 'no_contact_found', reason: res.reason, contacts, count, filename });
        announce('No matching contact found.');
        return;
      }

      if (res.status === 'unsafe_request') {
        setState({ stage: 'unsafe', contacts, count, filename });
        announce('Request blocked.');
        return;
      }
    },
    [state, request, useWebContext, announce],
  );

  const handleDraftChange = useCallback(
    (field: keyof EmailDraft, value: string) => {
      if (state.stage !== 'draft_ready') return;
      setState((prev) => {
        if (prev.stage !== 'draft_ready') return prev;
        return { ...prev, editedDraft: { ...prev.editedDraft, [field]: value } };
      });
    },
    [state.stage],
  );

  const handleApprove = useCallback(() => {
    if (state.stage !== 'draft_ready') return;
    setState({
      stage: 'approved',
      contact: state.contact,
      draft: state.editedDraft,
      contacts: state.contacts,
      count: state.count,
      filename: state.filename,
    });
    announce('Draft approved.');
  }, [state, announce]);

  const handleCopy = useCallback(async () => {
    const draft =
      state.stage === 'draft_ready'
        ? state.editedDraft
        : state.stage === 'approved'
          ? state.draft
          : null;
    if (!draft) return;

    const text = `To: ${draft.to} <${draft.toEmail}>\nSubject: ${draft.subject}\n\n${draft.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    announce('Draft copied to clipboard.');
  }, [state, announce]);

  const handleReset = useCallback(() => {
    setState({ stage: 'idle' });
    setRequest('');
    announce('Workflow reset.');
  }, [announce]);

  const handleBackToReady = useCallback(() => {
    if (
      state.stage === 'ambiguous' ||
      state.stage === 'no_contact_found' ||
      state.stage === 'unsafe' ||
      state.stage === 'draft_ready' ||
      state.stage === 'approved'
    ) {
      const s = state as { contacts: ParsedContact[]; count: number; filename: string } & WorkflowState;
      setState({ stage: 'ready', contacts: s.contacts, count: s.count, filename: s.filename });
    }
  }, [state]);

  const handleNewRequest = useCallback(() => {
    handleBackToReady();
    setRequest('');
  }, [handleBackToReady]);

  const isReadyToRun =
    (state.stage === 'ready' || state.stage === 'ambiguous' || state.stage === 'no_contact_found') &&
    request.trim().length >= 5;

  const inputBlocked = ['uploading', 'running'].includes(state.stage);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg">
      {/* Live region for screen readers */}
      <div ref={liveRegionRef} role="status" aria-live="polite" className="sr-only" />

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full opacity-30 bg-border-strong" aria-hidden="true" />
          ))}
          <span className="font-mono text-sm text-muted ml-1 opacity-60">AI Operations Workflow Agent · live demo</span>
        </div>
        <StatusBadge stage={state.stage as Stage} />
      </div>

      {/* Main content: two-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[560px]">

        {/* ── Left: Input ── */}
        <div className="p-6 flex flex-col gap-6">
          <div>
            <p className="font-mono text-sm text-muted uppercase tracking-widest mb-4">
              01 — Upload contact data
            </p>

            {state.stage === 'idle' || state.stage === 'uploading' || state.stage === 'upload_error' ? (
              <>
                <UploadZone onFile={handleFile} disabled={state.stage === 'uploading'} />

                {state.stage === 'uploading' && (
                  <p className="font-mono text-sm text-muted mt-3 flex items-center gap-2">
                    <span className="w-3 h-3 border border-muted rounded-full border-t-transparent animate-spin" aria-hidden="true" />
                    Parsing file…
                  </p>
                )}

                {state.stage === 'upload_error' && (
                  <p role="alert" className="font-mono text-sm text-fg mt-3 border border-border rounded px-3 py-2">
                    {state.message}
                  </p>
                )}
              </>
            ) : (
              <div className="border border-border rounded-lg bg-surface p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-fg font-medium mb-0.5">
                    {(state as { filename: string } & WorkflowState).filename ?? 'file'}
                  </p>
                  <p className="font-mono text-sm text-muted">
                    {String((state as { count: number } & WorkflowState).count ?? 0)} contacts loaded
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-mono text-sm text-muted hover:text-fg transition-colors flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
                  aria-label="Remove file and reset"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Request input */}
          {state.stage !== 'idle' && state.stage !== 'uploading' && state.stage !== 'upload_error' && state.stage !== 'rate_limited' && (
            <div className="flex-1">
              <p className="font-mono text-sm text-muted uppercase tracking-widest mb-3">
                02 — Describe the action
              </p>

              <label htmlFor={requestId} className="font-mono text-sm text-subtle block mb-1.5">
                What do you need?
              </label>
              <textarea
                id={requestId}
                value={request}
                onChange={(e) => setRequest(e.target.value.slice(0, 500))}
                disabled={inputBlocked}
                rows={4}
                placeholder={`e.g. "Write an email to John about the product update"`}
                className="w-full border border-border bg-bg rounded px-3 py-2.5 font-mono text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors resize-none disabled:opacity-50"
                aria-describedby={`${requestId}-hint`}
              />
              <div className="flex justify-between mt-1">
                <span id={`${requestId}-hint`} className="font-mono text-sm text-subtle">
                  Describe the recipient and the purpose clearly.
                </span>
                <span className="font-mono text-sm text-subtle" aria-label={`${String(request.length)} of 500 characters`}>
                  {String(request.length)}/500
                </span>
              </div>

              {/* Example prompts */}
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  'Write an email to John about the Q3 update',
                  'Schedule a call with the research team',
                  'Send a follow-up to Sarah from HR',
                ].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setRequest(ex)}
                    className="font-mono text-sm text-subtle border border-border rounded px-2 py-1 hover:text-muted hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {/* Web context opt-in */}
              <div className="mt-4">
                <label htmlFor={webContextId} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    id={webContextId}
                    type="checkbox"
                    checked={useWebContext}
                    onChange={(e) => setUseWebContext(e.target.checked)}
                    disabled={inputBlocked}
                    className="mt-0.5 w-3.5 h-3.5 accent-fg cursor-pointer disabled:opacity-50 flex-shrink-0"
                  />
                  <span className="font-mono text-sm text-muted group-hover:text-fg transition-colors leading-relaxed">
                    Enrich draft with web context
                    <span className="block text-subtle mt-0.5">
                      Searches the email topic online — never your contact data.
                    </span>
                  </span>
                </label>
              </div>

              {/* Run / ambiguity buttons */}
              <div className="mt-4 flex flex-col gap-2">
                {state.stage === 'running' ? (
                  <div className="h-10 border border-border rounded flex items-center justify-center gap-2 font-mono text-sm text-muted">
                    <span className="w-3.5 h-3.5 border border-muted rounded-full border-t-transparent animate-spin" aria-hidden="true" />
                    Processing…
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

                {(state.stage === 'ambiguous' || state.stage === 'no_contact_found' || state.stage === 'unsafe') && (
                  <button
                    type="button"
                    onClick={handleBackToReady}
                    className="h-9 border border-border rounded font-mono text-sm text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Adjust request
                  </button>
                )}

                {state.stage === 'approved' && (
                  <button
                    type="button"
                    onClick={handleNewRequest}
                    className="h-10 bg-fg text-bg rounded font-mono text-sm hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Write another email →
                  </button>
                )}
              </div>
            </div>
          )}

          {state.stage === 'approved' && (
            <div className="flex items-center gap-2 py-2">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="2 7 5.5 10.5 12 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="font-mono text-sm text-muted">Draft approved — write another or remove file to start over.</p>
            </div>
          )}
        </div>

        {/* ── Right: Output ── */}
        <div className="p-6 flex flex-col gap-5">
          <p className="font-mono text-sm text-muted uppercase tracking-widest">
            03 — Review output
          </p>

          {/* IDLE */}
          {state.stage === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
              <div className="w-10 h-10 border border-border rounded-lg flex items-center justify-center opacity-30" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M8 12h8M12 8v8" strokeLinecap="round" />
                </svg>
              </div>
              <p className="font-mono text-sm text-subtle">Upload contacts and describe your request to get started.</p>
              <p className="font-mono text-sm text-subtle/60 max-w-[28ch]">Optional: enable web context to search the topic before drafting.</p>
            </div>
          )}

          {/* UPLOADING / RUNNING skeleton */}
          {(state.stage === 'uploading' || state.stage === 'running') && (
            <div className="flex-1 space-y-3 py-4">
              {[1, 0.7, 0.5].map((op, i) => (
                <div key={i} className="border border-border rounded p-4 animate-pulse" style={{ opacity: op }}>
                  <div className="h-2 w-24 bg-border-strong rounded mb-2" />
                  <div className="h-3 bg-border rounded" />
                </div>
              ))}
            </div>
          )}

          {/* UPLOAD_ERROR */}
          {state.stage === 'upload_error' && (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="font-mono text-sm text-muted text-center">Upload the file to see output here.</p>
            </div>
          )}

          {/* READY */}
          {state.stage === 'ready' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-4 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-3">Contacts loaded</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(state as { contacts: ParsedContact[] } & WorkflowState).contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="font-mono text-sm text-fg">{c.name}</span>
                        {c.department && <span className="font-mono text-sm text-subtle ml-2">{c.department}</span>}
                      </div>
                      <span className="font-mono text-sm text-muted">{c.email}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-auto p-4 border border-dashed border-border rounded-lg text-center">
                <p className="font-mono text-sm text-subtle">Enter a request and run the workflow to generate a draft.</p>
              </div>
            </div>
          )}

          {/* AMBIGUOUS */}
          {state.stage === 'ambiguous' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-4 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-1">Multiple matches found</p>
                <p className="font-mono text-sm text-subtle leading-relaxed">{state.suggestionReasoning}</p>
              </div>

              <div className="space-y-2">
                {state.options.map(({ contact }) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    selected={contact.id === state.suggestion.id}
                    {...(contact.id === state.suggestion.id ? { badge: 'Suggested' } : {})}
                    onClick={() => void handleRun(contact.id)}
                  />
                ))}
              </div>

              <p className="font-mono text-sm text-subtle">Select a contact to continue with draft generation.</p>
            </div>
          )}

          {/* NO_CONTACT_FOUND */}
          {state.stage === 'no_contact_found' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">Contact not found</p>
                <p className="font-mono text-sm text-muted leading-relaxed">{state.reason}</p>
              </div>
              <p className="font-mono text-sm text-subtle">Try adjusting your request or uploading more complete contact data.</p>
            </div>
          )}

          {/* UNSAFE */}
          {state.stage === 'unsafe' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">Request blocked</p>
                <p className="font-mono text-sm text-muted leading-relaxed">
                  This request cannot be processed in the public demo because it may be abusive or misleading.
                </p>
              </div>
            </div>
          )}

          {/* DRAFT_READY */}
          {state.stage === 'draft_ready' && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Contact chip + confidence */}
              <div className="border border-border rounded-lg p-4 bg-surface">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-mono text-sm text-muted uppercase tracking-widest mb-1">Resolved contact</p>
                    <p className="font-mono text-sm text-fg">{state.contact.name}</p>
                    <p className="font-mono text-sm text-muted">{state.contact.email}</p>
                  </div>
                </div>
                <p className="font-mono text-sm text-subtle mb-2">{state.reasoning}</p>
                <ConfidenceBar value={state.confidence} />
              </div>

              {/* Editable draft */}
              <div className="flex-1">
                <DraftEditor draft={state.editedDraft} onChange={handleDraftChange} />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleApprove}
                  className="font-mono text-sm px-4 py-2 bg-fg text-bg rounded hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Approve draft
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="font-mono text-sm px-4 py-2 border border-border rounded text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {copied ? 'Copied!' : 'Copy draft'}
                </button>
                <button
                  type="button"
                  onClick={handleBackToReady}
                  className="font-mono text-sm px-4 py-2 border border-border rounded text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {/* APPROVED */}
          {state.stage === 'approved' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <div className="flex items-center gap-2 mb-3">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="2 7 5.5 10.5 12 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="font-mono text-sm text-fg">Draft approved</p>
                </div>
                <p className="font-mono text-sm text-muted leading-relaxed">
                  In the public demo, sending is disabled for safety reasons. You can copy the draft or inspect the repository documentation for the email-delivery step.
                </p>
              </div>

              <div className="border border-border rounded p-4 bg-bg space-y-2">
                <p className="font-mono text-sm text-subtle">To: {state.contact.name} &lt;{state.contact.email}&gt;</p>
                <p className="font-mono text-sm text-subtle">Subject: {state.draft.subject}</p>
                <pre className="font-mono text-sm text-muted whitespace-pre-wrap leading-relaxed mt-2 border-t border-border pt-2">
                  {state.draft.body}
                </pre>
              </div>

              <button
                type="button"
                onClick={() => void handleCopy()}
                className="font-mono text-sm px-4 py-2 border border-border rounded text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
              >
                {copied ? 'Copied!' : 'Copy draft'}
              </button>
            </div>
          )}

          {/* RATE_LIMITED */}
          {state.stage === 'rate_limited' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-border rounded-lg p-5 bg-surface">
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">Demo limit reached</p>
                <p className="font-mono text-sm text-muted leading-relaxed">
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
                <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">Error</p>
                <p className="font-mono text-sm text-muted leading-relaxed">{state.message}</p>
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
