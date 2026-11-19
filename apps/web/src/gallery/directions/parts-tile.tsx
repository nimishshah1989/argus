/* eslint-disable i18next/no-literal-string -- only class names, style values and the pct sign remain; every word goes through t() */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DISPLAY_STYLE } from './direction-props.js';
import { ChevronDown, ChevronUp } from '../../ui/icon.js';
import { addStrings } from './strings.js';
import { formatIN, type ToneRole, type Variant } from './variant.js';

addStrings({
  'delta.up': 'Up',
  'delta.down': 'Down',
  'delta.more': '{{pct}} more than October',
  'delta.less': '{{pct}} less than October',
});

/** A no-break space keeps a unit or a percent sign on the line of its figure. */
export const NBSP = String.fromCharCode(160);

/** How a tile reads: the figure, its unit, and the change on last month with the tone the change deserves. */
export interface TileFigure {
  label: string;
  value: number;
  unit?: string;
  /** What the figure means, for the edge of a tile; a tile with a change takes the change's tone. */
  tone?: ToneRole;
  /** Absent where the snapshot holds no earlier figure to compare with. */
  change?: { pct: number; up: boolean; tone: ToneRole };
}

export const TONE: Record<ToneRole, { ink: string; tint: string; edge: string }> = {
  critical: { ink: 'text-danger-ink', tint: 'bg-danger-tint', edge: 'border-l-danger' },
  attention: { ink: 'text-warning-ink', tint: 'bg-warning-tint', edge: 'border-l-warning' },
  good: { ink: 'text-ok-ink', tint: 'bg-ok-tint', edge: 'border-l-ok' },
  info: { ink: 'text-info-ink', tint: 'bg-info-tint', edge: 'border-l-info' },
  neutral: { ink: 'text-muted-ink', tint: 'bg-muted-tint', edge: 'border-l-muted' },
};

/** The shape of a tile and the size of its figure: a raised card, a flat panel with a tone edge, or a ruled cell. */
const SHAPE: Record<Variant['tile'], { frame: string; size: number; weight: number }> = {
  card: { frame: 'bg-surface p-3', size: 32, weight: 700 },
  edge: { frame: 'border border-l-[3px] border-neutral-200 bg-surface p-3', size: 28, weight: 600 },
  ruled: { frame: 'border-t border-neutral-200 py-4 pr-3', size: 40, weight: 400 },
};

const COLUMNS: Record<Variant['density'], string> = {
  comfortable: 'grid-cols-2 lg:grid-cols-4',
  compact: 'grid-cols-2 lg:grid-cols-6',
  roomy: 'grid-cols-1 lg:grid-cols-3',
};

/** One row of tiles: 2 a row on a phone, 4, 6 or 3 on a laptop, as the direction's density says. */
export function TileGrid({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <div data-density={variant.density} className={`grid gap-3 ${COLUMNS[variant.density]}`}>
      {children}
    </div>
  );
}

function Delta({
  form,
  change,
}: {
  form: Variant['delta'];
  change: NonNullable<TileFigure['change']>;
}) {
  const { t } = useTranslation('directions');
  const pct = `${formatIN(change.pct)}${NBSP}%`;
  const tone = TONE[change.tone];
  if (form === 'words') {
    return (
      <p data-delta={form} className="text-footnote text-neutral-600">
        {t(change.up ? 'delta.more' : 'delta.less', { pct })}
      </p>
    );
  }
  const Arrow = change.up ? ChevronUp : ChevronDown;
  const look = form === 'chip' ? `${tone.tint} px-2 py-1 text-caption` : 'text-footnote';
  return (
    <span
      data-delta={form}
      className={`inline-flex items-center gap-1 font-semibold ${tone.ink} ${look}`}
      style={form === 'chip' ? { borderRadius: 'var(--proto-radius-chip)' } : undefined}
    >
      <Arrow aria-hidden="true" size={14} />
      <span className="sr-only">{t(change.up ? 'delta.up' : 'delta.down')}</span>
      {pct}
    </span>
  );
}

/** A KPI tile drawn the way the direction's variant says; the figure is Indian-grouped and never colour alone. */
export function Tile({ variant, figure }: { variant: Variant; figure: TileFigure }) {
  const shape = SHAPE[variant.tile];
  const style: CSSProperties = {
    borderRadius: 'var(--proto-radius-tile)',
    boxShadow: 'var(--proto-shadow-raised)',
  };
  const value: CSSProperties = { ...DISPLAY_STYLE, fontSize: shape.size, fontWeight: shape.weight };
  return (
    <div
      data-tile={variant.tile}
      className={`flex min-w-0 flex-col gap-1 ${shape.frame} ${variant.tile === 'edge' ? TONE[figure.tone ?? figure.change?.tone ?? 'neutral'].edge : ''}`}
      style={style}
    >
      <p className="text-footnote text-neutral-600">{figure.label}</p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p style={value}>
          {formatIN(figure.value)}
          {figure.unit ? (
            <span className="text-footnote font-semibold">{`${NBSP}${figure.unit}`}</span>
          ) : null}
        </p>
        {variant.delta === 'inline' && figure.change ? (
          <Delta form="inline" change={figure.change} />
        ) : null}
      </div>
      {variant.delta !== 'inline' && figure.change ? (
        <Delta form={variant.delta} change={figure.change} />
      ) : null}
    </div>
  );
}
