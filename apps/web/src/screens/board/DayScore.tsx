import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { BoardToday } from '../../api.js';
import { formatMinutes } from '../../components/format.js';
import type { Scale } from './scale.js';

/** "average of 6, 4 closed": the averages include tickets still being worked, so say how many are finished. */
function average(t: TFunction, count: number, closed: number): string | undefined {
  return count > 0 ? t('live.today.average', { count, closed }) : undefined;
}

/**
 * The plant's day so far, as the server scored it: how long a breakdown waited for someone to start, and how long
 * a repair took. A day with nothing to average shows a dash, never 0 min. Nothing is worked out here.
 */
export function DayScore({ today, scale }: { today: BoardToday | undefined; scale: Scale }) {
  const { t } = useTranslation();
  const tiles = [
    {
      label: t('live.today.response'),
      minutes: today?.responseMin,
      note: today && average(t, today.responseCount, today.responseClosed),
    },
    {
      label: t('live.today.repair'),
      minutes: today?.repairMin,
      note: today && average(t, today.repairCount, today.repairClosed),
    },
  ];
  return (
    <>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          role="group"
          aria-label={tile.label}
          className={`bg-surface shadow-card ${scale.card}`}
        >
          <p className={`text-neutral-600 ${scale.sub}`}>{tile.label}</p>
          <p className={scale.big}>{formatMinutes(tile.minutes)}</p>
          <p className={`text-neutral-600 ${scale.sub}`}>{tile.note ?? ' '}</p>
        </div>
      ))}
    </>
  );
}
