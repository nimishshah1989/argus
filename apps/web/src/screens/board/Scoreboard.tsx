import { useTranslation } from 'react-i18next';
import { TONE_TEXT } from '../../ui/meaning.js';
import type { BoardToday } from '../../api.js';
import type { AgeBuckets } from './data.js';
import { DayScore } from './DayScore.js';
import type { Scale } from './scale.js';

const BUCKETS = ['underHour', 'oneToFour', 'fourToDay', 'overDay'] as const;

/**
 * How old the open breakdowns are, then the plant's day score. The phone shows every age bucket; the TV shows
 * the day-old ones big and the rest on one line, with the two day tiles beside it.
 */
export function Scoreboard({
  ages,
  today,
  scale,
  tv,
}: {
  ages: AgeBuckets;
  today: BoardToday | undefined;
  scale: Scale;
  tv: boolean;
}) {
  const { t } = useTranslation();
  const card = `bg-surface shadow-card ${scale.card}`;
  const value = (key: (typeof BUCKETS)[number]) => {
    if (ages[key] === 0) return 'text-neutral-600';
    return key === 'overDay' ? TONE_TEXT.danger : '';
  };
  if (tv) {
    const rest = BUCKETS.slice(0, 3)
      .filter((key) => ages[key] > 0)
      .map((key) => t('live.ages.line', { label: t(`live.ages.${key}`), count: ages[key] }))
      .join(' · ');
    return (
      <section aria-label={t('live.ages.title')} className="grid grid-cols-3 gap-6">
        <div className={`flex items-center gap-6 ${card}`}>
          <p data-testid="age-overDay" className={`${scale.big} ${value('overDay')}`}>
            {ages.overDay}
          </p>
          <div>
            <p className={scale.sub}>{t('live.ages.overDayTitle')}</p>
            <p className={`text-neutral-600 ${scale.sub}`}>{rest}</p>
          </div>
        </div>
        <DayScore today={today} scale={scale} />
      </section>
    );
  }
  return (
    <>
      <section aria-label={t('live.ages.title')} className={card}>
        <h2 className="mb-2 text-body font-bold">{t('live.ages.title')}</h2>
        <dl className={`grid gap-2 ${scale.ageGrid}`}>
          {BUCKETS.map((key) => (
            <div key={key} className="flex flex-col-reverse">
              <dt className="text-footnote">{t(`live.ages.${key}`)}</dt>
              <dd data-testid={`age-${key}`} className={`${scale.big} ${value(key)}`}>
                {ages[key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="grid grid-cols-2 gap-4">
        <DayScore today={today} scale={scale} />
      </div>
    </>
  );
}
