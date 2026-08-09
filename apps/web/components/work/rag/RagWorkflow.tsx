'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ragUpload, ragAskStream } from '@/lib/api';
import type { RagUploadResult, RagAskResult, PipelineStep, RetrievedChunk } from '@ai/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type IndexedResult = Extract<RagUploadResult, { status: 'indexed' }>;
type AnswerResult = Extract<RagAskResult, { status: 'answer_ready' }>;

type UploadedFile = {
  name: string;
  size: number;
  content: string; // base64
};

type WorkflowState =
  | { stage: 'idle' }
  | { stage: 'files_selected'; files: UploadedFile[] }
  | { stage: 'uploading'; files: UploadedFile[] }
  | { stage: 'ready'; result: IndexedResult; files: UploadedFile[] }
  | { stage: 'asking'; result: IndexedResult; files: UploadedFile[] }
  | { stage: 'streaming'; indexResult: IndexedResult; files: UploadedFile[]; partial: string; sources: RetrievedChunk[]; confidence: string; reasoning: string; mockMode: boolean }
  | { stage: 'answer_ready'; indexResult: IndexedResult; askResult: AnswerResult; files: UploadedFile[] }
  | { stage: 'no_context'; indexResult: IndexedResult; files: UploadedFile[]; message: string }
  | { stage: 'rate_limited' }
  | { stage: 'upload_error'; message: string }
  | { stage: 'ask_error'; indexResult: IndexedResult; files: UploadedFile[]; message: string };

type Stage = WorkflowState['stage'];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 3;

const SAMPLE_PDFS = [
  {
    name: 'Design Systems Overview',
    file: '/samples/sample-design-system.pdf',
    questions: [
      'What are design tokens and how are they structured?',
      'What are the three tiers of token organisation?',
      'What accessibility requirements must every component document?',
    ],
  },
  {
    name: 'AI Workflow Patterns',
    file: '/samples/sample-ai-workflow-patterns.pdf',
    questions: [
      'What are the steps of a RAG pipeline?',
      'How does tool use differ from chain-of-thought prompting?',
      'What are the trade-offs of multi-agent workflows?',
    ],
  },
] as const;

const SAMPLE_QUESTIONS = [
  'What are the main conclusions of this document?',
  'What methods or approaches are described?',
  'What are the key findings or recommendations?',
  'What limitations or caveats are mentioned?',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:application/pdf;base64,<data>"
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ stage }: { stage: Stage }) {
  const labels: Record<Stage, string> = {
    idle: 'Idle',
    files_selected: 'Files ready',
    uploading: 'Indexing…',
    ready: 'Ready',
    asking: 'Retrieving…',
    streaming: 'Generating…',
    answer_ready: 'Answer ready',
    no_context: 'No context',
    rate_limited: 'Rate limited',
    upload_error: 'Upload error',
    ask_error: 'Error',
  };

  const active = stage === 'uploading' || stage === 'asking' || stage === 'streaming';

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

function PipelineStepRow({ step }: { step: PipelineStep }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      {step.status === 'done' ? (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="text-fg flex-shrink-0 mt-0.5"
        >
          <polyline points="2 6 4.5 8.5 10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span
          className="w-2.5 h-2.5 rounded-full border border-border-strong flex-shrink-0 mt-0.5"
          style={{ opacity: 0.4 }}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0">
        <p className="font-mono text-sm text-fg leading-tight">{step.name}</p>
        {step.detail && (
          <p className="font-mono text-sm text-muted mt-0.5 leading-relaxed">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

function SourceChunkCard({ chunk, index }: { chunk: RetrievedChunk; index: number }) {
  const scorePercent = Math.round(chunk.score * 100);
  return (
    <div className="border border-border rounded-lg bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-mono text-xs text-fg uppercase tracking-widest">
          [{String(index + 1)}] {chunk.filename}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {chunk.usedInAnswer && (
            <span className="font-mono text-xs text-fg border border-fg/30 rounded px-2 py-0.5">
              Used
            </span>
          )}
          <span className="font-mono text-xs text-muted">{String(scorePercent)}% match</span>
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed">
        {chunk.text.length > 250 ? chunk.text.slice(0, 250) + '…' : chunk.text}
      </p>
    </div>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      onFiles(Array.from(incoming));
    },
    [onFiles],
  );

  return (
    <label
      htmlFor={inputId}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg px-6 py-10 cursor-pointer transition-colors duration-150 ${
        dragOver
          ? 'border-border-strong bg-surface'
          : 'border-border hover:border-border-strong bg-bg hover:bg-surface'
      } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        id={inputId}
        type="file"
        accept=".pdf"
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label="Upload PDF files"
      />
      <svg
        aria-hidden="true"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        className="text-muted mb-3 opacity-50"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
      </svg>
      <p className="font-mono text-sm text-muted text-center">
        Drop PDFs here or click to browse
      </p>
      <p className="font-mono text-xs text-subtle mt-1 text-center">
        PDF only · max {String(MAX_FILE_SIZE_MB)} MB per file · max {String(MAX_FILES)} files
      </p>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RagWorkflow() {
  const [state, setState] = useState<WorkflowState>({ stage: 'idle' });
  const [question, setQuestion] = useState('');
  const [copied, setCopied] = useState(false);
  const [fileError, setFileError] = useState('');

  // Set from the server's response after a successful /rag/upload — the
  // server generates the session ID, not the client (see cs03_rag.rag_upload).
  // Only populated once the workflow reaches 'ready' or later, which is the
  // only point handleAsk can run.
  const sessionIdRef = useRef('');
  const streamAbortRef = useRef<AbortController | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const questionId = useId();

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (incoming: File[]) => {
      setFileError('');

      const existingFiles: UploadedFile[] =
        state.stage === 'files_selected' ? state.files : [];

      const combined = [...existingFiles, ...incoming];

      if (combined.length > MAX_FILES) {
        setFileError(`Maximum ${String(MAX_FILES)} PDFs allowed.`);
        return;
      }

      for (const file of incoming) {
        const ext = file.name.toLowerCase().split('.').pop();
        if (ext !== 'pdf') {
          setFileError(`${file.name}: only PDF files are accepted.`);
          return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setFileError(`${file.name} exceeds ${String(MAX_FILE_SIZE_MB)} MB.`);
          return;
        }
      }

      // Read new files
      const newUploaded: UploadedFile[] = [];
      for (const file of incoming) {
        try {
          const content = await readFileAsBase64(file);
          newUploaded.push({ name: file.name, size: file.size, content });
        } catch {
          setFileError(`Failed to read ${file.name}.`);
          return;
        }
      }

      const allFiles = [...existingFiles, ...newUploaded];
      setState({ stage: 'files_selected', files: allFiles });
      announce(`${String(allFiles.length)} PDF${allFiles.length > 1 ? 's' : ''} selected.`);
    },
    [state, announce],
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      if (state.stage !== 'files_selected') return;
      const next = state.files.filter((_, i) => i !== index);
      if (next.length === 0) {
        setState({ stage: 'idle' });
      } else {
        setState({ stage: 'files_selected', files: next });
      }
    },
    [state],
  );

  // ── Upload / index ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (state.stage !== 'files_selected') return;
    const files = state.files;

    setState({ stage: 'uploading', files });
    announce('Uploading and indexing documents…');

    const result = await ragUpload({
      files: files.map((f) => ({
        filename: f.name,
        content: f.content,
        mimeType: 'application/pdf',
      })),
    });

    if (!result.ok) {
      if (result.error.includes('temporarily limited')) {
        setState({ stage: 'rate_limited' });
        announce('Demo rate limit reached.');
      } else {
        setState({ stage: 'upload_error', message: result.error });
        announce('Upload error.');
      }
      return;
    }

    const data = result.data;

    if (data.status === 'error') {
      setState({ stage: 'upload_error', message: data.message });
      announce('Upload error.');
      return;
    }

    // data.status === 'indexed'
    sessionIdRef.current = data.sessionId;
    setState({ stage: 'ready', result: data, files });
    announce('Documents indexed. Ready for questions.');
  }, [state, announce]);

  // ── Ask question (streaming) ───────────────────────────────────────────────

  const handleAsk = useCallback(async () => {
    if (
      (state.stage !== 'ready' &&
        state.stage !== 'answer_ready' &&
        state.stage !== 'no_context' &&
        state.stage !== 'ask_error') ||
      question.trim().length < 3
    ) {
      return;
    }

    const indexResult =
      state.stage === 'ready'
        ? state.result
        : state.indexResult;

    const files = state.files;

    // Cancel any in-flight stream
    streamAbortRef.current?.abort();
    const abort = new AbortController();
    streamAbortRef.current = abort;

    setState({ stage: 'asking', result: indexResult, files });
    announce('Retrieving relevant passages…');

    const result = await ragAskStream(
      { question: question.trim(), sessionId: sessionIdRef.current },
      (event) => {
        if (abort.signal.aborted) return;

        if (event.type === 'sources') {
          setState({
            stage: 'streaming',
            indexResult,
            files,
            partial: '',
            sources: event.sources,
            confidence: event.confidence,
            reasoning: event.reasoning,
            mockMode: event.mockMode,
          });
          announce('Generating answer…');
          return;
        }

        if (event.type === 'token') {
          setState((prev) =>
            prev.stage === 'streaming'
              ? { ...prev, partial: prev.partial + event.content }
              : prev,
          );
          return;
        }

        if (event.type === 'done') {
          setState((prev) => {
            if (prev.stage !== 'streaming') return prev;
            const askResult: AnswerResult = {
              status: 'answer_ready',
              answer: prev.partial,
              reasoning: prev.reasoning,
              sources: prev.sources,
              confidence: prev.confidence as AnswerResult['confidence'],
              mockMode: prev.mockMode,
            };
            return { stage: 'answer_ready', indexResult: prev.indexResult, askResult, files: prev.files };
          });
          announce('Answer ready.');
          return;
        }

        if (event.type === 'no_context') {
          setState({ stage: 'no_context', indexResult, files, message: event.message });
          announce('No relevant passages found.');
          return;
        }

        if (event.type === 'error') {
          setState({ stage: 'ask_error', indexResult, files, message: event.message });
          announce('Error.');
        }
      },
      abort.signal,
    );

    if (!result.ok && !abort.signal.aborted) {
      if (result.error?.includes('temporarily limited')) {
        setState({ stage: 'rate_limited' });
        announce('Demo rate limit reached.');
      } else {
        setState({ stage: 'ask_error', indexResult, files, message: result.error ?? 'Request failed.' });
        announce('Error retrieving answer.');
      }
    }
  }, [state, question, announce]);

  // ── Copy answer ────────────────────────────────────────────────────────────

  const handleCopyAnswer = useCallback(async () => {
    if (state.stage !== 'answer_ready' && state.stage !== 'streaming') return;
    const text = state.stage === 'answer_ready' ? state.askResult.answer : state.stage === 'streaming' ? state.partial : '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      announce('Answer copied to clipboard.');
    } catch {
      // clipboard may be unavailable
    }
  }, [state, announce]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setState({ stage: 'idle' });
    setQuestion('');
    setFileError('');
    setCopied(false);
    sessionIdRef.current = '';
    announce('Workflow reset.');
  }, [announce]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isUploading = state.stage === 'uploading';
  const isAsking = state.stage === 'asking';
  const isStreaming = state.stage === 'streaming';
  const isBusy = isUploading || isAsking || isStreaming;

  const showQuestionPanel =
    state.stage === 'ready' ||
    state.stage === 'asking' ||
    state.stage === 'streaming' ||
    state.stage === 'answer_ready' ||
    state.stage === 'no_context' ||
    state.stage === 'ask_error';

  const indexResult =
    state.stage === 'ready' ? state.result
    : state.stage === 'asking' ? state.result
    : state.stage === 'streaming' ? state.indexResult
    : state.stage === 'answer_ready' ? state.indexResult
    : state.stage === 'no_context' ? state.indexResult
    : state.stage === 'ask_error' ? state.indexResult
    : null;

  const pipelineSteps: PipelineStep[] | null = indexResult?.pipelineSteps ?? null;

  const indexMockMode = indexResult?.mockMode ?? false;

  // Keep question in sync but allow asking again
  useEffect(() => {
    if (state.stage === 'answer_ready') {
      // question stays as-is so user can edit and ask again
    }
  }, [state.stage]);

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
          <span className="font-mono text-sm text-muted ml-1">
            RAG Research Assistant · live demo
          </span>
        </div>
        <StatusBadge stage={state.stage} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[620px]">

        {/* ── Left: Upload + Question ── */}
        <div className="p-6 flex flex-col gap-6">
          <p className="font-mono text-sm text-muted uppercase tracking-widest">
            01 — Upload PDFs
          </p>

          {/* Sample PDFs */}
          {state.stage === 'idle' && (
            <div className="border border-border rounded-lg bg-surface p-4">
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">
                No PDF? Try a sample
              </p>
              <div className="flex flex-col gap-2">
                {SAMPLE_PDFS.map((s) => (
                  <a
                    key={s.file}
                    href={s.file}
                    download
                    className="flex items-center justify-between gap-3 border border-border rounded px-3 py-2.5 bg-bg hover:bg-surface hover:border-border-strong transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span className="font-mono text-sm text-fg">{s.name}</span>
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-muted group-hover:text-fg transition-colors flex-shrink-0"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                    </svg>
                  </a>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                <p className="font-mono text-xs text-subtle">Example questions to try:</p>
                {SAMPLE_PDFS.flatMap((s) => s.questions).slice(0, 4).map((q) => (
                  <p key={q} className="font-mono text-xs text-subtle pl-2">— {q}</p>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone (show when idle or files_selected) */}
          {(state.stage === 'idle' || state.stage === 'files_selected') && (
            <DropZone
              onFiles={(files) => { void handleFiles(files); }}
              disabled={isBusy}
            />
          )}

          {/* File error */}
          {fileError && (
            <div role="alert" className="border border-border rounded-lg bg-surface px-4 py-3">
              <p className="font-mono text-sm text-muted">{fileError}</p>
            </div>
          )}

          {/* File list */}
          {state.stage === 'files_selected' && (
            <div className="flex flex-col gap-2">
              {state.files.map((file, i) => (
                <div
                  key={`${file.name}-${String(i)}`}
                  className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3 bg-surface"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-fg truncate">{file.name}</p>
                    <p className="font-mono text-xs text-subtle mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="font-mono text-sm text-muted hover:text-fg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm flex-shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => { void handleUpload(); }}
                disabled={isBusy}
                className="h-10 bg-fg text-bg rounded font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 mt-2"
              >
                Index documents
              </button>
            </div>
          )}

          {/* Uploading indicator */}
          {state.stage === 'uploading' && (
            <div className="h-10 border border-border rounded flex items-center justify-center gap-2 font-mono text-sm text-muted">
              <span
                className="w-3.5 h-3.5 border border-muted rounded-full border-t-transparent animate-spin"
                aria-hidden="true"
              />
              Indexing documents…
            </div>
          )}

          {/* Indexed summary (show when ready or beyond) */}
          {showQuestionPanel && pipelineSteps && 'files' in state && (
            <div className="border border-border rounded-lg bg-surface p-4 flex flex-col gap-1">
              <p className="font-mono text-xs text-fg uppercase tracking-widest mb-2">
                Indexed documents
              </p>
              {state.files.map((f, i) => (
                <p key={`${f.name}-${String(i)}`} className="font-mono text-sm text-muted">
                  {f.name} — {formatBytes(f.size)}
                </p>
              ))}
            </div>
          )}

          {/* Question input */}
          {showQuestionPanel && (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-sm text-muted uppercase tracking-widest">
                02 — Ask a question
              </p>

              <div>
                <label
                  htmlFor={questionId}
                  className="font-mono text-sm text-muted block mb-1.5 uppercase tracking-widest sr-only"
                >
                  Your question
                </label>
                <textarea
                  id={questionId}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
                  disabled={isBusy}
                  rows={3}
                  maxLength={500}
                  placeholder="Ask anything about the uploaded documents…"
                  className="w-full border border-border bg-bg rounded px-3 py-2.5 font-mono text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-fg/20 transition-colors resize-none disabled:opacity-50"
                  aria-label="Your question"
                  aria-describedby={`${questionId}-count`}
                />
                <div className="flex justify-end mt-1">
                  <span
                    id={`${questionId}-count`}
                    className="font-mono text-sm text-subtle"
                    aria-label={`${String(question.length)} of 500 characters`}
                  >
                    {String(question.length)}/500
                  </span>
                </div>
              </div>

              {/* Sample question chips */}
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuestion(q)}
                    disabled={isBusy}
                    className="font-mono text-xs text-muted border border-border rounded-sm px-2.5 py-1.5 hover:border-border-strong hover:text-fg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Ask button */}
              {isAsking ? (
                <div className="h-10 border border-border rounded flex items-center justify-center gap-2 font-mono text-sm text-muted">
                  <span
                    className="w-3.5 h-3.5 border border-muted rounded-full border-t-transparent animate-spin"
                    aria-hidden="true"
                  />
                  Retrieving…
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleAsk(); }}
                  disabled={question.trim().length < 3 || isBusy}
                  className="h-10 bg-fg text-bg rounded font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Ask
                </button>
              )}
            </div>
          )}

          {/* Reset button */}
          {state.stage !== 'idle' && (
            <button
              type="button"
              onClick={handleReset}
              className="h-9 border border-border rounded font-mono text-sm text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Start over
            </button>
          )}

          {/* Rate limited */}
          {state.stage === 'rate_limited' && (
            <div role="alert" className="border border-border rounded-lg p-5 bg-surface">
              <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">
                Demo limit reached
              </p>
              <p className="text-sm text-muted leading-relaxed">
                This demo is temporarily limited. Please try again later.
              </p>
            </div>
          )}

          {/* Upload error */}
          {state.stage === 'upload_error' && (
            <div role="alert" className="border border-border rounded-lg p-5 bg-surface">
              <p className="font-mono text-sm text-muted uppercase tracking-widest mb-2">
                Upload error
              </p>
              <p className="text-sm text-muted leading-relaxed">{state.message}</p>
            </div>
          )}
        </div>

        {/* ── Right: Pipeline + Sources + Answer ── */}
        <div className="p-6 flex flex-col gap-5">
          <p className="font-mono text-sm text-muted uppercase tracking-widest">
            03 — Review output
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
                  <path d="M9 17H7A5 5 0 0 1 7 7h2" strokeLinecap="round" />
                  <path d="M15 7h2a5 5 0 1 1 0 10h-2" strokeLinecap="round" />
                  <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
                </svg>
              </div>
              <p className="font-mono text-sm text-subtle">
                Upload PDFs to build the retrieval index.
              </p>
              <p className="font-mono text-sm text-subtle max-w-[28ch]">
                Then ask a question to retrieve answers with visible sources.
              </p>
            </div>
          )}

          {/* FILES SELECTED */}
          {state.stage === 'files_selected' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
              <p className="font-mono text-sm text-subtle">
                {String(state.files.length)} PDF{state.files.length > 1 ? 's' : ''} selected.
              </p>
              <p className="font-mono text-sm text-subtle max-w-[28ch]">
                Click &ldquo;Index documents&rdquo; to parse and embed.
              </p>
            </div>
          )}

          {/* UPLOADING skeleton */}
          {state.stage === 'uploading' && (
            <div className="flex-1 space-y-3 py-4">
              {[1, 0.7, 0.5, 0.3].map((op, i) => (
                <div
                  key={i}
                  className="border border-border rounded p-4 animate-pulse"
                  style={{ opacity: op }}
                >
                  <div className="h-2 w-28 bg-border-strong rounded mb-3" />
                  <div className="h-3 bg-border rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Pipeline steps (when ready or beyond) */}
          {pipelineSteps && (
            <div className="border border-border rounded-lg bg-surface p-4">
              <p className="font-mono text-xs text-fg uppercase tracking-widest mb-3">
                Indexing pipeline
              </p>
              {pipelineSteps.map((step) => (
                <PipelineStepRow key={step.name} step={step} />
              ))}
              {indexMockMode && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="font-mono text-xs text-muted leading-relaxed">
                    Demo mode — keyword embeddings active. Set <code className="text-fg">OPENAI_API_KEY</code> for semantic retrieval.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* READY placeholder */}
          {state.stage === 'ready' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
              <p className="font-mono text-sm text-subtle">
                Index ready. Ask a question to retrieve relevant passages.
              </p>
            </div>
          )}

          {/* ASKING skeleton */}
          {state.stage === 'asking' && (
            <div className="space-y-3 py-2">
              {[1, 0.7, 0.5].map((op, i) => (
                <div
                  key={i}
                  className="border border-border rounded p-4 animate-pulse"
                  style={{ opacity: op }}
                >
                  <div className="h-2 w-24 bg-border-strong rounded mb-3" />
                  <div className="h-3 bg-border rounded mb-2" />
                  <div className="h-3 bg-border rounded w-3/4" />
                </div>
              ))}
            </div>
          )}

          {/* STREAMING — sources + partial answer */}
          {state.stage === 'streaming' && (
            <div className="flex flex-col gap-4">
              {/* Partial answer */}
              <div className="border border-border rounded-lg bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-xs text-fg uppercase tracking-widest">Answer</p>
                  <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-fg opacity-60 animate-pulse"
                      aria-hidden="true"
                    />
                    Generating…
                  </span>
                </div>
                <p className="text-sm text-muted leading-[1.75] whitespace-pre-wrap">
                  {state.partial}
                  <span
                    className="inline-block w-0.5 h-[1em] bg-fg opacity-70 animate-pulse ml-0.5 align-text-bottom"
                    aria-hidden="true"
                  />
                </p>
              </div>

              {/* Sources arrive immediately */}
              {state.sources.length > 0 && (
                <div>
                  <p className="font-mono text-xs text-fg uppercase tracking-widest mb-3">
                    Retrieved sources ({String(state.sources.length)})
                  </p>
                  <div className="flex flex-col gap-3">
                    {state.sources.map((chunk, i) => (
                      <SourceChunkCard key={i} chunk={chunk} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NO CONTEXT */}
          {state.stage === 'no_context' && (
            <div role="alert" className="border border-border rounded-lg p-5 bg-surface">
              <p className="font-mono text-xs text-fg uppercase tracking-widest mb-2">
                No relevant passages
              </p>
              <p className="text-sm text-muted leading-relaxed">{state.message}</p>
            </div>
          )}

          {/* ASK ERROR */}
          {state.stage === 'ask_error' && (
            <div role="alert" className="border border-border rounded-lg p-5 bg-surface">
              <p className="font-mono text-xs text-fg uppercase tracking-widest mb-2">Error</p>
              <p className="text-sm text-muted leading-relaxed">{state.message}</p>
            </div>
          )}

          {/* ANSWER READY */}
          {state.stage === 'answer_ready' && (
            <div className="flex flex-col gap-4">
              {/* Answer */}
              <div className="border border-border rounded-lg bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-xs text-fg uppercase tracking-widest">Answer</p>
                  <span
                    className={`font-mono text-xs px-2.5 py-0.5 rounded border ${
                      state.askResult.confidence === 'high'
                        ? 'border-fg/20 text-fg bg-fg/5'
                        : state.askResult.confidence === 'medium'
                          ? 'border-border text-muted'
                          : 'border-border text-subtle'
                    }`}
                  >
                    {state.askResult.confidence === 'high'
                      ? 'High confidence'
                      : state.askResult.confidence === 'medium'
                        ? 'Medium confidence'
                        : 'Low confidence — verify sources'}
                  </span>
                </div>

                <p className="text-sm text-muted leading-[1.75] whitespace-pre-wrap">
                  {state.askResult.answer}
                </p>

                {state.askResult.reasoning && (
                  <p className="font-mono text-xs text-subtle mt-3 pt-3 border-t border-border leading-relaxed">
                    {state.askResult.reasoning}
                  </p>
                )}

                {state.askResult.mockMode && (
                  <p className="font-mono text-xs text-subtle mt-2">
                    Demo mode — keyword retrieval active.
                  </p>
                )}

                <div className="flex items-start gap-3 mt-3 pt-3 border-t border-border">
                  <span
                    className="w-1 h-1 rounded-full bg-fg opacity-30 mt-[0.6em] flex-shrink-0"
                    aria-hidden="true"
                  />
                  <p className="font-mono text-xs text-subtle leading-relaxed">
                    This answer is based on retrieved passages from the uploaded documents. It may be incomplete or contain errors.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => { void handleCopyAnswer(); }}
                  className="mt-3 h-8 px-4 border border-border rounded font-mono text-sm text-muted hover:text-fg hover:border-border-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label="Copy answer to clipboard"
                >
                  {copied ? 'Copied!' : 'Copy answer'}
                </button>
              </div>

              {/* Retrieved sources */}
              {state.askResult.sources.length > 0 && (
                <div>
                  <p className="font-mono text-xs text-fg uppercase tracking-widest mb-3">
                    Retrieved sources ({String(state.askResult.sources.length)})
                  </p>
                  <div className="flex flex-col gap-3">
                    {state.askResult.sources.map((chunk, i) => (
                      <SourceChunkCard key={i} chunk={chunk} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
