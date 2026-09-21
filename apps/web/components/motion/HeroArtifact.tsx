'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// ─── Data ─────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'active' | 'done';

interface NodeDef {
  id:    string;
  label: string;
  tag:   string;
  ms:    string | null;
}

const NODES: NodeDef[] = [
  { id: 'input',        label: 'Input',        tag: 'typed_state',     ms: null    },
  { id: 'validate',     label: 'Validate',     tag: 'rate_limited',    ms: '4ms'   },
  { id: 'agent',        label: 'Agent',        tag: 'mock / live',     ms: '318ms' },
  { id: 'tool_call',    label: 'Tool Call',    tag: 'latency_ms',      ms: '22ms'  },
  { id: 'retrieval',    label: 'Retrieval',    tag: 'source_grounded', ms: '71ms'  },
  { id: 'safety',       label: 'Safety Check', tag: 'unsafe=false',    ms: '9ms'   },
  { id: 'human_review', label: 'Human Review', tag: 'approved',        ms: null    },
  { id: 'output',       label: 'Output',       tag: 'streamed',        ms: null    },
];

const LOGS: string[] = [
  '→ input received',
  '→ validate: schema ok · 4ms',
  '→ agent: gpt-4o-mini · 318ms',
  '→ tool: get_context · 22ms',
  '→ retrieval: 3 chunks · 71ms',
  '→ safety: clean · 9ms',
  '→ human_review: approved',
  '→ output: ready',
];

const STEP_MS  = 1600;
const PAUSE_MS = 2800;

// ─── SVG layout ───────────────────────────────────────────────────────────────

const NW  = 115;  // node width
const NH  = 64;   // node height
const GAP = 22;   // horizontal gap
const PAD = 4;    // horizontal padding

const NX: [number, number, number, number] = [
  PAD,
  PAD + NW + GAP,
  PAD + 2 * (NW + GAP),
  PAD + 3 * (NW + GAP),
]; // [4, 141, 278, 415]

const TY  = 28;               // top row y
const BY  = 200;              // bottom row y
const VW  = NX[3] + NW + PAD; // 534
const VH  = BY + NH + 16;     // 280
const TYC = TY + NH / 2;      // 60 — top row center y
const BYC = BY + NH / 2;      // 232 — bottom row center y

// bottom row: node[4]=Retrieval→NX[3], node[5]=Safety→NX[2],
//             node[6]=HumanReview→NX[1], node[7]=Output→NX[0]
const BOT_X = [3, 2, 1, 0] as const;

// ─── Arrow ────────────────────────────────────────────────────────────────────

function Arrow({
  x1, y1, x2, y2, active, reduced,
}: {
  x1: number; y1: number; x2: number; y2: number;
  active: boolean; reduced: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux  = dx / len;
  const uy  = dy / len;
  const hs  = 5;
  const a1  = `${x2 - ux * hs - uy * hs * 0.6},${y2 - uy * hs + ux * hs * 0.6}`;
  const a2  = `${x2 - ux * hs + uy * hs * 0.6},${y2 - uy * hs - ux * hs * 0.6}`;

  return (
    <g
      stroke="var(--color-fg)"
      strokeWidth="0.75"
      fill="none"
      strokeLinecap="round"
      opacity={active ? 0.5 : 0.1}
      style={{ transition: reduced ? 'none' : 'opacity 0.5s' }}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={`${a1} ${x2},${y2} ${a2}`} />
    </g>
  );
}

// ─── SVG node ─────────────────────────────────────────────────────────────────

function SvgNode({
  x, y, node, status, reduced,
}: {
  x: number; y: number;
  node: NodeDef; status: Status; reduced: boolean;
}) {
  const isActive = status === 'active';
  const isDone   = status === 'done';
  const isIdle   = status === 'idle';

  return (
    <g
      opacity={isIdle ? 0.16 : 1}
      style={{ transition: reduced ? 'none' : 'opacity 0.45s' }}
    >
      {/* Box */}
      <rect
        x={x} y={y} width={NW} height={NH} rx={5}
        fill="var(--color-bg)"
        stroke={isActive ? 'var(--color-fg)' : isDone ? 'var(--color-border-strong)' : 'var(--color-border)'}
        strokeWidth={1}
        style={{ transition: reduced ? 'none' : 'stroke 0.35s' }}
      />

      {/* Status dot */}
      {isActive ? (
        <motion.circle
          cx={x + 13} cy={y + 18} r={3}
          fill="var(--color-fg)"
          animate={reduced ? {} : { opacity: [1, 0.12, 1] }}
          transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <circle
          cx={x + 13} cy={y + 18} r={3}
          fill={isDone ? 'var(--color-fg)' : 'none'}
          stroke={isIdle ? 'var(--color-border-strong)' : 'none'}
          strokeWidth={0.75}
          opacity={isDone ? 0.5 : 0.5}
        />
      )}

      {/* Label */}
      <text
        x={x + 24} y={y + 22}
        fontFamily="var(--font-mono)"
        fontSize={9.5}
        letterSpacing="0.09em"
        fontWeight={isActive ? 600 : 400}
        fill="var(--color-fg)"
        opacity={isActive ? 1 : isDone ? 0.65 : 0.4}
        style={{ transition: reduced ? 'none' : 'opacity 0.35s' }}
      >
        {node.label.toUpperCase()}
      </text>

      {/* Tag */}
      <text
        x={x + 13} y={y + 46}
        fontFamily="var(--font-mono)"
        fontSize={8}
        letterSpacing="0.04em"
        fill="var(--color-fg)"
        opacity={isActive ? 0.45 : isDone ? 0.28 : 0.18}
        style={{ transition: reduced ? 'none' : 'opacity 0.35s' }}
      >
        {node.tag}
      </text>

      {/* Latency badge */}
      {isDone && node.ms && (
        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <rect
            x={x + NW - 36} y={y - 15}
            width={34} height={13}
            rx={2}
            fill="var(--color-bg)"
            stroke="var(--color-border)"
            strokeWidth={0.75}
          />
          <text
            x={x + NW - 19} y={y - 5.5}
            fontFamily="var(--font-mono)"
            fontSize={7.5}
            fill="var(--color-fg)"
            opacity={0.38}
            textAnchor="middle"
          >
            {node.ms}
          </text>
        </motion.g>
      )}
    </g>
  );
}

// ─── Mobile compact node ───────────────────────────────────────────────────────

function MobileNode({ node, status, reduced, showMs }: {
  node: NodeDef; status: Status; reduced: boolean; showMs?: boolean;
}) {
  const isActive = status === 'active';
  const isDone   = status === 'done';

  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           8,
      padding:       '9px 11px',
      border:        `1px solid ${isActive ? 'var(--color-fg)' : 'var(--color-border)'}`,
      borderRadius:  5,
      opacity:       status === 'idle' ? 0.18 : 1,
      background:    'var(--color-bg)',
      transition:    reduced ? 'none' : 'opacity 0.4s, border-color 0.3s',
      minWidth:      0,
    }}>
      {isActive ? (
        <motion.div
          animate={reduced ? {} : { opacity: [1, 0.12, 1] }}
          transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-fg)', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background:  isDone ? 'var(--color-fg)' : 'transparent',
          border:      isDone ? 'none' : '1px solid var(--color-border-strong)',
          opacity:     isDone ? 0.5 : 0.55,
        }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      9,
          letterSpacing: '0.09em',
          color:         'var(--color-fg)',
          opacity:       isActive ? 1 : isDone ? 0.65 : 0.4,
          textTransform: 'uppercase',
          whiteSpace:    'nowrap',
        }}>
          {node.label}
        </div>
        <div style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      7.5,
          letterSpacing: '0.03em',
          color:         'var(--color-fg)',
          opacity:       isActive ? 0.42 : isDone ? 0.26 : 0.16,
          marginTop:     2,
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
        }}>
          {node.tag}{showMs && isDone && node.ms ? ` · ${node.ms}` : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Log output (shared) ──────────────────────────────────────────────────────

function LogOutput({ logs, reduced }: { logs: string[]; reduced: boolean }) {
  const visible = logs.slice(-5);
  const offset  = logs.length - visible.length;

  return (
    <div style={{
      marginTop:     14,
      minHeight:     84,
      overflow:      'hidden',
      fontFamily:    'var(--font-mono)',
      fontSize:      10,
      letterSpacing: '0.05em',
      lineHeight:    '1.9',
      color:         'var(--color-fg)',
    }}>
      {visible.map((line, i) => {
        const isLast = i === visible.length - 1;
        return (
          <motion.div
            key={offset + i}
            initial={reduced ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: isLast ? 0.72 : Math.max(0.1, 0.38 - (visible.length - 1 - i) * 0.09) }}
            transition={{ duration: 0.3 }}
          >
            {line}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HeroArtifact() {
  const reduced = useReducedMotion() ?? false;
  const [step, setStep] = useState<number>(reduced ? NODES.length : -1);
  const [logs, setLogs] = useState<string[]>(reduced ? [...LOGS] : []);

  // Initial start delay
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setStep(0), 900);
    return () => clearTimeout(t);
  }, [reduced]);

  // Advance through steps
  useEffect(() => {
    if (reduced || step < 0 || step >= NODES.length) return;
    const t = setTimeout(() => {
      setLogs(prev => [...prev, LOGS[step] ?? '']);
      setStep(prev => prev + 1);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [step, reduced]);

  // Reset after pause at end — go directly to 0; opacity transitions handle the visual reset
  useEffect(() => {
    if (reduced || step !== NODES.length) return;
    const t = setTimeout(() => {
      setLogs([]);
      setStep(0);
    }, PAUSE_MS);
    return () => clearTimeout(t);
  }, [step, reduced]);

  const status = (i: number): Status => {
    if (step < 0)              return 'idle';
    if (step >= NODES.length)  return 'done';
    if (i < step)              return 'done';
    if (i === step)            return 'active';
    return 'idle';
  };

  const connActive = (from: number) =>
    step >= NODES.length || step > from;

  return (
    <div aria-hidden="true" style={{ userSelect: 'none', width: '100%' }}>

      {/* ── Desktop: SVG rectangular circuit ──────────────────────────────── */}
      <div className="hidden lg:block">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', overflow: 'visible' }}
          role="presentation"
        >
          {/* Top row: Input(0) → Validate(1) → Agent(2) → Tool Call(3) */}
          {NODES.slice(0, 4).map((node, i) => (
            <SvgNode key={node.id} x={NX[i]!} y={TY} node={node} status={status(i)} reduced={reduced} />
          ))}

          {/* Top row connectors → */}
          {([0, 1, 2] as const).map(i => (
            <Arrow
              key={`ht${i}`}
              x1={NX[i] + NW}   y1={TYC}
              x2={NX[i + 1]!}   y2={TYC}
              active={connActive(i)} reduced={reduced}
            />
          ))}

          {/* Vertical: Tool Call ↓ Retrieval */}
          <Arrow
            x1={NX[3] + NW / 2} y1={TY + NH}
            x2={NX[3] + NW / 2} y2={BY}
            active={connActive(3)} reduced={reduced}
          />

          {/* Bottom row: Retrieval(4)→NX[3], Safety(5)→NX[2], HumanReview(6)→NX[1], Output(7)→NX[0] */}
          {NODES.slice(4).map((node, i) => (
            <SvgNode key={node.id} x={NX[BOT_X[i]!]!} y={BY} node={node} status={status(i + 4)} reduced={reduced} />
          ))}

          {/* Bottom row connectors ← (right to left) */}
          {([0, 1, 2] as const).map(i => (
            <Arrow
              key={`hb${i}`}
              x1={NX[3 - i]!}              y1={BYC}
              x2={(NX[3 - i - 1]!) + NW}   y2={BYC}
              active={connActive(i + 4)} reduced={reduced}
            />
          ))}
        </svg>

        <LogOutput logs={logs} reduced={reduced} />
      </div>

      {/* ── Mobile: 2-column compact grid ────────────────────────────────── */}
      <div className="lg:hidden">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {NODES.map((node, i) => (
            <MobileNode key={node.id} node={node} status={status(i)} reduced={reduced} showMs />
          ))}
        </div>
        <LogOutput logs={logs} reduced={reduced} />
      </div>
    </div>
  );
}
