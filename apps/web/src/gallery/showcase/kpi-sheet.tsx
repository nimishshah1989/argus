/*
 * The side sheet follows shadcn/ui's `sheet` (https://github.com/shadcn-ui/ui, MIT licence, Copyright (c) 2023
 * shadcn): a Radix Dialog that slides in from the right edge. Rewritten with plain class strings and our tokens.
 */
import { Dialog } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { X } from '../../ui/icon.js';
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
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sc-overlay" />
        <Dialog.Content
          className="sc-sheet"
          aria-describedby={undefined}
          data-family={metric ? FAMILY[metric.id] : undefined}
          data-testid="kpi-sheet"
        >
          {metric ? (
            <>
              <div className="sc-sheet-head">
                <Dialog.Title className="sc-sheet-title">{t(`tile.${metric.id}`)}</Dialog.Title>
                <Dialog.Close className="sc-close" aria-label={t('sheet.close')}>
                  <X aria-hidden size={18} />
                </Dialog.Close>
              </div>
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
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
