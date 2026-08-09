import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Agentic AI Engineering Portfolio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #9b6fda, #c084fc)',
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#9b6fda',
            }}
          />
          <span
            style={{
              fontSize: '16px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#888',
              fontWeight: 500,
            }}
          >
            Agentic AI Engineering
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 800,
            color: '#f5f5f5',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: '24px',
            maxWidth: '900px',
          }}
        >
          Engineering Agentic AI Systems
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '22px',
            color: '#888',
            lineHeight: 1.55,
            maxWidth: '700px',
          }}
        >
          Multi-agent workflows, RAG, and a real MCP server — built with evaluation, guardrails, and production-minded constraints.
        </div>

        {/* Bottom stack */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '80px',
            right: '80px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '14px',
              color: '#555',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {['LangGraph', 'RAG', 'MCP', 'FastAPI'].map((s) => (
              <span key={s} style={{ padding: '4px 12px', border: '1px solid #222', borderRadius: '4px' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
