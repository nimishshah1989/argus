import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../api.js';
import { tileStatus, type Tile as TileData, type TileStatus } from './data.js';

const TONES: Record<TileStatus, string> = {
  idle: 'bg-running/10 text-running',
  open: 'bg-neutral-200 text-neutral-700',
  working: 'bg-in-progress/10 text-in-progress',
  waiting: 'bg-waiting/10 text-waiting',
};

/** The status colour only tints the pill; the label always states the meaning. */
function tone(ticket: Ticket | null, status: TileStatus): string {
  if (status === 'open' && ticket?.kind === 'stopped') return 'bg-stopped/10 text-stopped';
  if (status === 'open' && ticket?.kind === 'support') return 'bg-support/10 text-support';
  return TONES[status];
}

export function Tile({ tile, large }: { tile: TileData; large: boolean }) {
  const { t } = useTranslation();
  const status = tileStatus(tile.ticket);
  const labels: Record<TileStatus, string> = {
    idle: t('tile.idle'),
    open: t('tile.open'),
    working: t('tile.working'),
    waiting: t('tile.waiting'),
  };
  return (
    <li data-testid="tile" className="rounded-2xl bg-white p-3 shadow-sm">
      <p className={`font-semibold tracking-tight ${large ? 'text-2xl' : 'text-lg'}`}>
        {tile.machine.code}
      </p>
      <p
        className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
          large ? 'text-base' : 'text-xs'
        } ${tone(tile.ticket, status)}`}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
        {labels[status]}
      </p>
      {tile.ticket && (
        <p className={`mt-1 text-neutral-500 ${large ? 'text-sm' : 'text-xs'}`}>
          {tile.ticket.ref}
        </p>
      )}
    </li>
  );
}
