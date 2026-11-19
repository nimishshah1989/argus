import { useTranslation } from 'react-i18next';
import snapshot from './generated/figures.json' with { type: 'json' };
import type { ScreenProps } from './direction-props.js';
import { Tile, TileGrid, type TileFigure } from './parts-tile.js';
import { addStrings } from './strings.js';
import { formatIN } from './variant.js';

addStrings({
  'elements.tiles': 'Tiles',
  'elements.breakdowns': 'Breakdowns',
  'elements.pm': 'Planned maintenance',
  'elements.availability': 'Availability',
  'elements.sample': 'A million, grouped the Indian way',
});

/** One figure of the plant's snapshot (the 11 November answer key). */
function figure(key: string): number {
  return snapshot.figures.find((f) => f.key === key)?.value as number;
}

/** The Elements screen: each part drawn the way the direction's variant says. The changes on October are sample figures. */
export default function ScreenElements({ direction }: ScreenProps) {
  const { t } = useTranslation('directions');
  const { variant } = direction;
  const tiles: TileFigure[] = [
    {
      label: t('elements.breakdowns'),
      value: figure('dashboard.total-breakdowns'),
      change: { pct: 12, up: true, tone: 'critical' },
    },
    {
      label: t('elements.pm'),
      value: figure('dashboard.pm-hours'),
      unit: 'h',
      change: { pct: 4, up: true, tone: 'good' },
    },
    {
      label: t('elements.availability'),
      value: figure('dashboard.fleet-availability'),
      unit: '%',
      change: { pct: 0.2, up: false, tone: 'attention' },
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="elements-tiles" className="flex flex-col gap-3">
        <h3 id="elements-tiles" className="text-body font-semibold">
          {t('elements.tiles')}
        </h3>
        <TileGrid variant={variant}>
          {tiles.map((f) => (
            <Tile key={f.label} variant={variant} figure={f} />
          ))}
        </TileGrid>
      </section>
      <section className="flex flex-col gap-1">
        <p className="text-footnote text-neutral-600">{t('elements.sample')}</p>
        <p
          data-sample
          className="text-title1 font-semibold"
          style={{ fontFamily: 'var(--proto-display)', letterSpacing: 'var(--proto-tracking)' }}
        >
          {formatIN(1000000)}
        </p>
      </section>
    </div>
  );
}
