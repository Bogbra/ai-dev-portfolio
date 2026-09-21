'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { easings } from '@/components/motion/easings';
import { env } from '@/lib/env';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'idle' | 'active' | 'complete' | 'error';

type Stage = {
  id: string;
  label: string;
  latencyMs?: number;
  status: StageStatus;
};

type Intent =
  | 'general_question'
  | 'project_question'
  | 'contact_request'
  | 'tool_request'
  | 'unsafe_request'
  | 'unclear_request'
  | 'human_handoff';

type SafetyState =
  | 'safe'
  | 'unclear'
  | 'needs_confirmation'
  | 'unsafe_request'
  | 'handoff_recommended';

type LatencyBreakdown = {
  stt_ms: number;
  intent_ms: number;
  tool_ms: number;
  llm_ms: number;
  tts_ms: number;
  total_ms: number;
};

type AgentResult = {
  transcript: string;
  intent: Intent;
  safety_state: SafetyState;
  tool_used: string;
  response_text: string;
  confidence: number;
  handoff_required: boolean;
  latency_breakdown: LatencyBreakdown;
  audio_b64: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_STAGES: Stage[] = [
  { id: 'stt',        label: 'Transcribing',      status: 'idle' },
  { id: 'intent',     label: 'Detecting intent',   status: 'idle' },
  { id: 'safety',     label: 'Safety check',       status: 'idle' },
  { id: 'tool',       label: 'Tool call',          status: 'idle' },
  { id: 'llm',        label: 'Generating response', status: 'idle' },
  { id: 'tts',        label: 'Synthesizing speech', status: 'idle' },
];

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToAudioUrl(b64: string): string {
  return `data:audio/mpeg;base64,${b64}`;
}

const INTENT_LABELS: Record<Intent, string> = {
  general_question:  'General question',
  project_question:  'Project question',
  contact_request:   'Contact request',
  tool_request:      'Tool question',
  unsafe_request:    'Unsafe request',
  unclear_request:   'Unclear',
  human_handoff:     'Human handoff',
};

const SAFETY_LABELS: Record<SafetyState, string> = {
  safe:                'Safe',
  unclear:             'Unclear',
  needs_confirmation:  'Needs confirmation',
  unsafe_request:      'Unsafe',
  handoff_recommended: 'Handoff recommended',
};

// ─── Stage indicator ──────────────────────────────────────────────────────────

function StageIndicator({ stage, reduced }: { stage: Stage; reduced: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {stage.status === 'idle'     && <span className="w-1.5 h-1.5 rounded-full bg-border" />}
        {stage.status === 'active'   && (
          reduced
            ? <span className="w-1.5 h-1.5 rounded-full bg-fg" />
            : <motion.span
                className="block w-1.5 h-1.5 rounded-full bg-fg"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
        )}
        {stage.status === 'complete' && (
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-fg" aria-hidden="true">
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {stage.status === 'error'    && (
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-[var(--color-danger)]" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className={[
        'font-mono text-sm',
        stage.status === 'idle'     ? 'text-subtle'  : '',
        stage.status === 'active'   ? 'text-fg'      : '',
        stage.status === 'complete' ? 'text-muted'   : '',
        stage.status === 'error'    ? 'text-[var(--color-danger)]' : '',
      ].join(' ')}>
        {stage.label}
        {stage.status === 'complete' && stage.latencyMs !== undefined && (
          <span className="text-subtle ml-1.5">{formatMs(stage.latencyMs)}</span>
        )}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoiceAgentLab() {
  const reduced = useReducedMotion() ?? false;

  // availability
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState('');

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState('');

  // audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Check availability on mount ──────────────────────────────────────────
  useEffect(() => {
    const aiUrl = env.NEXT_PUBLIC_AI_URL;
    fetch(`${aiUrl}/voice/status`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { available: boolean; reason?: string }) => {
        setAvailable(data.available);
        if (!data.available) setUnavailableReason(data.reason ?? '');
      })
      .catch(() => {
        setAvailable(false);
        setUnavailableReason('Could not reach the AI service.');
      });
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // getUserMedia must be called before any React setState — Chrome's user
    // activation is consumed by state updates if they happen first.
    if (typeof MediaRecorder === 'undefined') {
      setPermissionError('Audio recording is not supported in this browser. Try Chrome, Firefox, or Safari 14.1+.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError('Microphone access is not available. This feature requires a secure (HTTPS) connection.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof Error ? err.name : 'UnknownError';
      const msg = err instanceof Error ? err.message : String(err);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermissionError('Microphone access was denied. Allow it in browser site settings and macOS System Settings → Privacy → Microphone.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermissionError('No microphone found. Please connect a microphone and try again.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setPermissionError('Microphone is in use by another application. Close other apps using the mic and try again.');
      } else if (name === 'OverconstrainedError') {
        setPermissionError(`No microphone matches the required constraints (${msg}).`);
      } else {
        setPermissionError(`Could not access microphone (${name}: ${msg}).`);
      }
      return;
    }

    // Stream acquired — safe to reset UI state now
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    audioUrlRef.current = null;
    setPermissionError('');
    setError('');
    setResult(null);
    setStages(INITIAL_STAGES);

    streamRef.current = stream;
    chunksRef.current = [];

    // iOS Safari supports audio/mp4; prefer webm on other browsers
    const MIME_PREFERENCE = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    const supportedMime = MIME_PREFERENCE.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const duration = recordingSecondsRef.current;
      await processAudio(blob, mimeType, duration);
    };

    recorder.start(100); // collect data every 100ms
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;

    timerRef.current = setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds((s) => {
        const next = s + 1;
        if (next >= 20) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }, [stopRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordingSecondsRef = useRef(0);

  // ── Process audio ─────────────────────────────────────────────────────────
  const processAudio = useCallback(async (blob: Blob, mimeType: string, duration: number) => {
    setIsProcessing(true);
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: 'idle' as const })));

    let b64: string;
    try {
      b64 = await blobToBase64(blob);
    } catch {
      setError('Failed to encode audio.');
      setIsProcessing(false);
      return;
    }

    const ext = mimeType.includes('ogg')  ? 'ogg'
              : mimeType.includes('mp4')  ? 'mp4'
              : mimeType.includes('wav')  ? 'wav'
              : 'webm';

    const aiUrl = env.NEXT_PUBLIC_AI_URL;

    let data: AgentResult;
    try {
      const res = await fetch(`${aiUrl}/voice/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_b64: b64,
          filename: `recording.${ext}`,
          duration_seconds: duration,
        }),
      });

      if (res.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
        setIsProcessing(false);
        return;
      }
      if (res.status === 503) {
        setError('Voice agent is not available in this environment.');
        setIsProcessing(false);
        return;
      }

      const json = await res.json() as AgentResult & { message?: string };

      if (!res.ok) {
        setError(json.message ?? 'Something went wrong. Please try again.');
        setIsProcessing(false);
        return;
      }

      data = json;
    } catch {
      setError('Unable to connect. Please check your connection and try again.');
      setIsProcessing(false);
      return;
    }

    // ── Reveal stages with staggered animation ────────────────────────────
    const { latency_breakdown } = data;
    const stageUpdates: Array<{ id: string; latencyMs: number }> = [
      { id: 'stt',    latencyMs: latency_breakdown.stt_ms    },
      { id: 'intent', latencyMs: latency_breakdown.intent_ms },
      { id: 'safety', latencyMs: latency_breakdown.intent_ms }, // same call
      { id: 'tool',   latencyMs: latency_breakdown.tool_ms   },
      { id: 'llm',    latencyMs: latency_breakdown.llm_ms    },
      { id: 'tts',    latencyMs: latency_breakdown.tts_ms    },
    ];

    for (let i = 0; i < stageUpdates.length; i++) {
      setStages((prev) =>
        prev.map((s) => s.id === stageUpdates[i]!.id ? { ...s, status: 'active' as const } : s)
      );
      await new Promise((r) => setTimeout(r, reduced ? 0 : 120));
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageUpdates[i]!.id
            ? { ...s, status: 'complete' as const, latencyMs: stageUpdates[i]!.latencyMs }
            : s
        )
      );
      await new Promise((r) => setTimeout(r, reduced ? 0 : 80));
    }

    setResult(data);
    setIsProcessing(false);

    // ── Setup audio playback ──────────────────────────────────────────────
    if (data.audio_b64) {
      // Stop any previous playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
        audioRef.current.onended = null;
      }
      const url = base64ToAudioUrl(data.audio_b64);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audio.onplay  = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;
    }
  }, [reduced]);

  // ── Playback controls ─────────────────────────────────────────────────────
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => { /* src not ready */ });
    }
  }, [isPlaying]);

  const hasResult = result !== null;
  const hasStageActivity = stages.some((s) => s.status !== 'idle');

  // ─────────────────────────────────────────────────────────────────────────
  // Render: not yet checked
  if (available === null) {
    return (
      <div className="font-mono text-sm text-subtle p-6 text-center">
        Checking voice agent status…
      </div>
    );
  }

  // Render: unavailable
  if (!available) {
    return (
      <div className="border border-border rounded-lg p-6 space-y-3">
        <p className="font-mono text-sm text-muted tracking-widest uppercase">
          Voice Agent — Not Available
        </p>
        <p className="font-mono text-sm text-subtle">
          Voice agent is not available because speech / LLM credentials are not configured.
        </p>
        {unavailableReason && (
          <p className="font-mono text-sm text-subtle opacity-60">{unavailableReason}</p>
        )}
        <p className="font-mono text-sm text-subtle">
          Required: <span className="text-muted">OPENAI_API_KEY</span> with{' '}
          <span className="text-muted">audio.transcriptions</span> and{' '}
          <span className="text-muted">audio.speech</span> access.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" role="region" aria-label="Voice Agent Flow">


      {/* ── Privacy + rate limit notice ── */}
      <div className="font-mono text-base md:text-lg text-subtle leading-relaxed space-y-1 md:max-w-[50%]">
        <p>Audio is processed only to generate the response. Recordings are not stored permanently. Do not share confidential information in this public demo.</p>
        <p className="text-muted mt-3">Rate limit: 20 requests / hour · 50 requests / day.</p>
      </div>

      {/* ── Record controls ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          aria-pressed={isRecording}
          className={[
            'flex items-center gap-2.5 font-mono text-sm px-4 py-2.5 rounded-md border transition-colors duration-150',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
            isProcessing
              ? 'opacity-40 cursor-not-allowed border-border text-muted'
              : isRecording
                ? 'border-fg text-fg bg-fg/5 hover:bg-fg/10'
                : 'border-border text-muted hover:border-fg hover:text-fg',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'w-2 h-2 rounded-full flex-shrink-0',
              isRecording
                ? (reduced ? 'bg-fg' : 'animate-pulse bg-fg')
                : 'bg-muted',
            ].join(' ')}
          />
          {isRecording ? 'Stop recording' : 'Start recording'}
        </button>

        {isRecording && (
          <div className="flex items-center gap-3" aria-live="polite" aria-atomic="true">
            <span className="font-mono text-sm text-fg tabular-nums">
              {formatDuration(recordingSeconds)}
            </span>
            <div
              className="w-24 h-1 bg-border rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={recordingSeconds}
              aria-valuemin={0}
              aria-valuemax={20}
              aria-label="Recording duration"
            >
              <div
                className="h-full bg-fg rounded-full transition-all duration-1000"
                style={{ width: `${(recordingSeconds / 20) * 100}%` }}
              />
            </div>
            <span className="font-mono text-sm text-subtle">/ 0:20</span>
          </div>
        )}

        {isProcessing && (
          <span className="font-mono text-sm text-muted" aria-live="polite">
            Processing audio…
          </span>
        )}
      </div>

      {/* ── Permission / request error ── */}
      <AnimatePresence>
        {(permissionError || error) && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="font-mono text-sm text-[var(--color-danger)]"
          >
            {permissionError || error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Pipeline + results ── */}
      <AnimatePresence>
        {(hasStageActivity || isProcessing) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easings.outExpo }}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* Call flow */}
            <div className="p-4 border-b border-border">
              <p className="font-mono text-sm text-muted tracking-widest uppercase mb-3">
                Call Flow
              </p>
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2"
                aria-label="Pipeline stages"
                aria-live="polite"
                aria-atomic="false"
              >
                {stages.map((stage) => (
                  <StageIndicator key={stage.id} stage={stage} reduced={reduced} />
                ))}
              </div>
            </div>

            {/* Results */}
            <AnimatePresence>
              {hasResult && result && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, ease: easings.outExpo }}
                >
                  {/* Two-column grid: transcript+intent+response / latency */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] divide-y md:divide-y-0 md:divide-x divide-border">

                    {/* Left: transcript, intent, response */}
                    <div className="p-4 space-y-4">

                      {/* Transcript */}
                      <div>
                        <p className="font-mono text-xs md:text-sm text-subtle tracking-widest uppercase mb-1">
                          Transcript
                        </p>
                        <p className="font-mono text-base md:text-lg text-fg leading-relaxed">
                          &ldquo;{result.transcript}&rdquo;
                        </p>
                      </div>

                      {/* Intent + Safety row */}
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <p className="font-mono text-xs md:text-sm text-subtle tracking-widest uppercase mb-1">
                            Intent
                          </p>
                          <p className="font-mono text-base md:text-lg text-muted">
                            {INTENT_LABELS[result.intent] ?? result.intent}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-xs md:text-sm text-subtle tracking-widest uppercase mb-1">
                            Safety
                          </p>
                          <p className={[
                            'font-mono text-base md:text-lg',
                            result.safety_state === 'safe' ? 'text-muted' : 'text-[var(--color-danger)]',
                          ].join(' ')}>
                            {SAFETY_LABELS[result.safety_state] ?? result.safety_state}
                          </p>
                        </div>
                        {result.tool_used !== 'no_action' && (
                          <div>
                            <p className="font-mono text-xs md:text-sm text-subtle tracking-widest uppercase mb-1">
                              Tool
                            </p>
                            <p className="font-mono text-base md:text-lg text-muted">{result.tool_used}</p>
                          </div>
                        )}
                      </div>

                      {/* Response */}
                      <div>
                        <p className="font-mono text-xs md:text-sm text-subtle tracking-widest uppercase mb-1">
                          Response
                        </p>
                        <p className="font-mono text-base md:text-lg text-fg leading-relaxed">
                          {result.response_text}
                        </p>
                      </div>

                      {/* Audio playback */}
                      {result.audio_b64 && (
                        <button
                          onClick={togglePlayback}
                          aria-label={isPlaying ? 'Pause response audio' : 'Play response audio'}
                          className={[
                            'flex items-center gap-2 font-mono text-sm px-3 py-2 rounded-md border transition-colors duration-150',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                            isPlaying
                              ? 'border-fg text-fg bg-fg/5'
                              : 'border-border text-muted hover:border-fg hover:text-fg',
                          ].join(' ')}
                        >
                          <span aria-hidden="true">
                            {isPlaying ? '⏸' : '▶'}
                          </span>
                          {isPlaying ? 'Pause response' : 'Play response'}
                        </button>
                      )}
                    </div>

                    {/* Right: latency budget */}
                    <div className="p-4">
                      <p className="font-mono text-sm text-subtle tracking-widest uppercase mb-3">
                        Latency Budget
                      </p>
                      <div className="space-y-2">
                        {[
                          { label: 'STT',    ms: result.latency_breakdown.stt_ms    },
                          { label: 'Intent', ms: result.latency_breakdown.intent_ms },
                          { label: 'Tool',   ms: result.latency_breakdown.tool_ms   },
                          { label: 'LLM',    ms: result.latency_breakdown.llm_ms    },
                          { label: 'TTS',    ms: result.latency_breakdown.tts_ms    },
                        ].map(({ label, ms }) => (
                          <div key={label} className="flex justify-between items-baseline gap-4">
                            <span className="font-mono text-sm text-subtle">{label}</span>
                            <span className="font-mono text-sm text-muted tabular-nums">
                              {formatMs(ms)}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-border flex justify-between items-baseline gap-4">
                          <span className="font-mono text-sm text-muted">Total</span>
                          <span className="font-mono text-sm text-fg tabular-nums font-medium">
                            {formatMs(result.latency_breakdown.total_ms)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
