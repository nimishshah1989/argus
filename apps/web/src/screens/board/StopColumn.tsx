import { useTranslation } from 'react-i18next';
import type { Config } from '../../api.js';
import { formatMinutes } from '../../components/format.js';
import { MachineIcon } from '../../ui/machine-icon.js';
import { TONE_FILL, TONE_TEXT, statusMeaning } from '../../ui/meaning.js';
import type { StatusId } from '../../ui/status/index.js';
import type { Column, Stop } from './data.js';
import type { Scale } from './scale.js';

/** Each column wears the status of its breakdowns; its ages take the tone only where someone must act. */
const LOOK: Record<Column, { status: StatusId<'ticket'>; ageTone: 'danger' | 'hold' | null }> = {
  notStarted: { status: 'stopped', ageTone: 'danger' },
  repairing: { status: 'in_progress', ageTone: null },
  waiting: { status: 'waiting', ageTone: 'hold' },
};

/** A TV shows the three oldest; the phone and the desktop show every stop. */
const TV_ROWS = 3;

function subline(stop: Stop, column: Column, config: Config): string {
  const code = stop.ticket.waitReason;
  const first =
    column === 'waiting'
      ? ((config.lists.wait_reason ?? []).find((item) => item.code === code)?.label ?? code)
      : config.segments.find((s) => s.id === stop.machine.segment_id)?.name;
  return [first, stop.machine.cell].filter(Boolean).join(' · ');
}

function StopRow({ stop, column, config, scale }: RowProps) {
  const tone = LOOK[column].ageTone;
  const segment = config.segments.find((s) => s.id === stop.machine.segment_id);
  return (
    <li
      data-testid="tile"
      className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-neutral-200 py-2"
    >
      <span className={scale.rowSide}>
        <MachineIcon
          segment={segment?.code ?? ''}
          status={LOOK[column].status}
          size={scale.machineIcon}
        />
      </span>
      <p className={`truncate ${scale.code}`}>{stop.machine.code}</p>
      <p
        className={`whitespace-nowrap ${scale.rowSide} ${scale.age} ${tone ? TONE_TEXT[tone] : ''}`}
      >
        {formatMinutes(stop.ageMin)}
      </p>
      <p className={`col-start-2 text-neutral-600 ${scale.rowSub} ${scale.sub}`}>
        {subline(stop, column, config)}
      </p>
    </li>
  );
}

interface RowProps {
  stop: Stop;
  column: Column;
  config: Config;
  scale: Scale;
}

export function StopColumn({
  column,
  stops,
  config,
  scale,
  tv,
}: Omit<RowProps, 'stop'> & { stops: Stop[]; tv: boolean }) {
  const { t } = useTranslation();
  const { tone, icon: Icon, label } = statusMeaning({ group: 'ticket', id: LOOK[column].status });
  const shown = tv ? stops.slice(0, TV_ROWS) : stops;
  const title = t(`live.column.${column}`);
  return (
    <section
      aria-label={title}
      className={`flex min-h-0 flex-col gap-2 overflow-hidden bg-surface shadow-card ${scale.card}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 ${scale.chip} ${TONE_FILL[tone]}`}
        >
          <Icon aria-hidden size={tv ? 32 : 16} />
          {t(label)}
        </span>
        <span className={scale.count}>{stops.length}</span>
      </div>
      <h2 className={scale.columnTitle}>{title}</h2>
      <ul>
        {shown.map((stop) => (
          <StopRow
            key={stop.machine.id}
            stop={stop}
            column={column}
            config={config}
            scale={scale}
          />
        ))}
      </ul>
      {stops.length > shown.length ? (
        <p className={`text-neutral-600 ${scale.sub}`}>
          {t('live.more', { count: stops.length - shown.length })}
        </p>
      ) : null}
    </section>
  );
}
