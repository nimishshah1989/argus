import type { ReactNode } from 'react';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
      {title ? <h3 className="text-title3 font-semibold">{title}</h3> : null}
      {children}
    </section>
  );
}
