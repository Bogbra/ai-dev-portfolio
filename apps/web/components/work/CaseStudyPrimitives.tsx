import type { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">{children}</p>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight mb-10">
      {children}
    </h2>
  );
}

export function Divider() {
  return <div className="border-t border-border my-16 md:my-24" />;
}

export function PDRCard({ label, text, accent }: { label: string; text: string; accent: string }) {
  return (
    <div className="border border-border rounded-lg bg-surface p-6 h-full hover:border-border-strong transition-colors duration-300">
      <dt className="font-mono text-sm uppercase tracking-widest mb-4 block" style={{ color: accent }}>
        {label}
      </dt>
      <dd className="text-base lg:text-lg text-muted leading-relaxed">{text}</dd>
    </div>
  );
}

export function ArchStep({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div className="flex gap-5 py-5 border-b border-border last:border-0">
      <div className="font-mono text-sm text-muted tracking-widest mt-0.5 flex-shrink-0 w-8" aria-hidden="true">
        {num}
      </div>
      <div>
        <h3 className="font-display text-lg font-650 text-fg mb-1">{title}</h3>
        <p className="text-base lg:text-lg text-muted leading-[1.75]">{description}</p>
      </div>
    </div>
  );
}

export function FlowNode({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded font-mono text-base ${accent ? 'bg-fg text-bg' : 'border border-border text-muted bg-surface'}`}>
      {label}
    </div>
  );
}

export function FlowArrow() {
  return (
    <div className="flex items-center pl-4 py-0.5">
      <span className="text-subtle font-mono text-lg">↓</span>
    </div>
  );
}

export function StateDoc({ label, description, example }: { label: string; description: string; example?: string }) {
  return (
    <div className="border border-border rounded-lg bg-surface p-5 hover:border-border-strong transition-colors duration-200">
      <p className="font-mono text-xs text-fg uppercase tracking-widest mb-2">{label}</p>
      <p className="text-base lg:text-lg text-muted leading-relaxed">{description}</p>
      {example && (
        <p className="font-mono text-base text-subtle border-t border-border pt-2 mt-3 leading-relaxed">
          {example}
        </p>
      )}
    </div>
  );
}

export function StateGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3 pb-3 border-b border-border">
        {label}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

export function TechNote({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="border border-border rounded-lg bg-surface p-6 hover:border-border-strong transition-colors duration-200">
      <h3 className="font-mono text-xs text-fg uppercase tracking-widest mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span className="mt-[0.7em] w-1 h-1 rounded-full bg-fg opacity-40 flex-shrink-0" aria-hidden="true" />
            <span className="text-base lg:text-lg text-muted leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
