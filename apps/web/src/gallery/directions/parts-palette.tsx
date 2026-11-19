import { useTranslation } from 'react-i18next';
import type { ScreenProps } from './direction-props.js';
import { seriesColour } from './parts-chart.js';
import { addStrings } from './strings.js';

addStrings({
  'palette.series': 'Chart series 1 to 8',
  'palette.item': 'Series {{n}}',
  'palette.seq': 'Sequential ramp',
  'palette.div': 'Diverging ramp',
});

/** Black or white, whichever reads better on the cell (the plan checks both at 4.61 or more on every step). */
function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return light > 0.179 ? '#000000' : '#ffffff';
}

function Ramp({ id, colours }: { id: 'seq' | 'div'; colours: string[] }) {
  const { t } = useTranslation('directions');
  return (
    <div data-ramp={id} className="flex flex-col gap-1">
      <p className="text-footnote text-neutral-600">{t(`palette.${id}`)}</p>
      <ol className="grid grid-cols-5 border border-neutral-200">
        {colours.map((hex, i) => (
          <li
            key={hex + i}
            data-step={i + 1}
            className="py-3 text-center text-caption font-semibold"
            style={{ background: `var(--proto-${id}-${i + 1})`, color: inkOn(hex) }}
          >
            {i + 1}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** All 8 chart series as named chips and both ramps as numbered steps: the colours the door's two-series charts never draw. */
export function PaletteStrip({ direction, theme }: ScreenProps) {
  const { t } = useTranslation('directions');
  const palette = direction[theme];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-footnote text-neutral-600">{t('palette.series')}</p>
        <ul className="flex flex-wrap gap-2">
          {palette.series.map((_, i) => (
            <li
              key={i}
              data-series={i + 1}
              className="flex items-center gap-2 border border-neutral-200 bg-surface px-2 py-1 text-caption"
              style={{ borderRadius: 'var(--proto-radius-chip)' }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: seriesColour(i) }}
              />
              {t('palette.item', { n: i + 1 })}
            </li>
          ))}
        </ul>
      </div>
      <Ramp id="seq" colours={palette.seq} />
      <Ramp id="div" colours={palette.div} />
    </div>
  );
}
