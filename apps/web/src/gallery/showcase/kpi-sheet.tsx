/*
 * The side sheet follows shadcn/ui's `sheet` (https://github.com/shadcn-ui/ui, MIT licence, Copyright (c) 2023
 * shadcn): a Radix Dialog that slides in from the right edge. Rewritten with plain class strings and our tokens.
 */
import { useTranslation } from 'react-i18next';
import { DrillPanel } from '../../ui/elements/index.js';
import { FULL, S, change, fixed, monthLong, type Metric } from './data.js';
import { Arrow, changeText } from './delta.js';
import { FAMILY } from './families.js';

function MonthRow({ metric, i }: { metric: Metric; i: number }) {
  const { t } = useTranslation('showcase');
  const ch = change(metric, i);
  const value = metric.values[i];
  return (
    <tr>
      <th scope="row">
        {monthLong(i)}
        {i >= FULL ? <span className="sc-running"> · {t('sheet.running')}</span> : null}
      </th>
      <td className="sc-num">{fixed(value, metric.digits)}</td>
      <td>
        {ch ? (
          <span className="sc-delta" data-tone={ch.tone}>
            <Arrow dir={ch.dir} />
            <span>{changeText(t, metric, ch, true)}</span>
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function MonthsTable({ metric }: { metric: Metric }) {
  const { t } = useTranslation('showcase');
  return (
    <table className="sc-months">
      <thead>
        <tr>
          <th scope="col">{t('sheet.month')}</th>
          <th scope="col">{t('sheet.value')}</th>
          <th scope="col">{t('sheet.change')}</th>
        </tr>
      </thead>
      <tbody>
        {S.months.map((_, i) => (
          <MonthRow key={i} metric={metric} i={S.months.length - 1 - i} />
        ))}
      </tbody>
    </table>
  );
}

/** The explanation behind a tile: what the figure is, how it is worked out, and the months it is built from. */
export function KpiSheet({
  metric,
  open,
  onClose,
}: {
  metric: Metric | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('showcase');
  return (
    <DrillPanel
      open={open}
      onClose={onClose}
      title={metric ? t(`tile.${metric.id}`) : ''}
      closeLabel={t('sheet.close')}
      family={metric ? FAMILY[metric.id] : undefined}
    >
      {metric ? (
        <div className="sc-sheet" data-testid="kpi-sheet">
          <p className="sc-sheet-value">
            <span className="sc-num">{fixed(metric.headline, metric.digits)}</span>
            {metric.unit ? <span className="sc-unit">{metric.unit}</span> : null}
            <span className="sc-tile-span">{t('tile.span')}</span>
          </p>
          <section>
            <h3>{t('sheet.definition')}</h3>
            <p>{t(`def.${metric.id}`)}</p>
          </section>
          <section>
            <h3>{t('sheet.formula')}</h3>
            <p>{t(`formula.${metric.id}`)}</p>
          </section>
          <section>
            <h3>{t('sheet.months')}</h3>
            <MonthsTable metric={metric} />
          </section>
          <p className="sc-sheet-note">{t('sheet.source')}</p>
        </div>
      ) : null}
    </DrillPanel>
  );
}
