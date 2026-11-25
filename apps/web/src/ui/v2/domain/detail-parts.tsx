/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../icons.js';
import { useTick } from '../motion.js';

/** A titled part of a drawer: a small label over its content. */
export function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="v2-detail-section">
      <h3 className="v2-detail-label">{label}</h3>
      {children}
    </section>
  );
}

/** A figure in a drawer: small label, the value at KPI size ticking in, an optional note. */
export function DetailFigure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  const tick = useTick(value, 600);
  return (
    <div>
      <div className="v2-sub">{label}</div>
      <div className="v2-kpi-value">{tick.text}</div>
      {note ? <div className="v2-sub">{note}</div> : null}
    </div>
  );
}

/** A drawer shows at most this many figures (ADR 0036 R24); the rest live on the entity's full page. */
export const DETAIL_MAX_FIGURES = 3;

/** One figure a drawer may show; `value` empty or absent → dropped before the cap (never a "—" filling a slot). */
export type DetailFigureData = { label: string; value?: string; note?: string };

/** The way from a drawer to the entity's full page: the route the chip opens, and the link's own words. */
export type FullPage = { href: string; label: string };

/**
 * A drawer's figures (ADR 0036 R24, ADR 0041): drop every figure whose `value` is empty or absent, keep the first
 * `DETAIL_MAX_FIGURES` in the order given, each a `DetailFigure`, inside `<div className="v2-figures">`. Nothing left
 * → `null`.
 */
export function DetailFigures({ figures }: { figures: DetailFigureData[] }): ReactElement | null {
  void figures;
  throw new Error('not implemented');
}

/**
 * The drawer's one link to the entity's full page (ADR 0036 R24, ADR 0041):
 * `<a className="v2-link" data-full-page="" href={href}>{label}</a>`.
 */
export function FullPageLink({ href, label }: FullPage): ReactElement {
  void href;
  void label;
  throw new Error('not implemented');
}

/** Where the figures came from and how fresh they are, at the foot of a drawer or a card. */
export function SourceLine({ text }: { text: string }) {
  return (
    <p className="v2-source">
      <Icon name="clock" size={12} />
      {text}
    </p>
  );
}
