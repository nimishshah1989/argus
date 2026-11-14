import { useTranslation } from 'react-i18next';
import { CircleCheck, OctagonX } from '../../ui/icon.js';
import { TONE_FILL, TONE_TEXT } from '../../ui/meaning.js';
import type { LiveBoard } from './data.js';
import type { Scale } from './scale.js';

/** Is the plant up: machines running out of those on the board, and how many are stopped. */
export function Pulse({ board, scale }: { board: LiveBoard; scale: Scale }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('live.pulse.aria')}
      className="flex flex-wrap items-end gap-x-12 gap-y-3"
    >
      <div className="flex items-end gap-3">
        <span data-testid="count-running" className={scale.hero}>
          {board.running}
        </span>
        <div>
          <p className={`inline-flex items-center gap-2 ${scale.heroWord} ${TONE_TEXT.ok}`}>
            <CircleCheck aria-hidden size={scale.icon} strokeWidth={2.5} />
            {t('live.pulse.running')}
          </p>
          <p className={`text-neutral-600 ${scale.sub}`}>
            {t('live.pulse.of', { count: board.machines })}
          </p>
        </div>
      </div>
      <p className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${TONE_FILL.danger}`}>
        <OctagonX aria-hidden size={scale.icon + 2} strokeWidth={2.5} />
        <span data-testid="count-stopped" className={scale.stopNumber}>
          {board.stopped}
        </span>
        <span className={scale.stopWord}>{t('live.pulse.stopped')}</span>
      </p>
    </section>
  );
}
