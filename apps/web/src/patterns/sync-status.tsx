import { useSyncStatus } from '../data/index.js';
import { StatusPill } from '../ui/status/status-pill.js';

/** `quietOnline` (the floor): no pill while online; the live region stays so a change is announced. */
export function SyncStatus({ quietOnline = false }: { quietOnline?: boolean }) {
  const id = useSyncStatus();
  return (
    <span role="status" data-testid="sync-status">
      {quietOnline && id === 'online' ? null : (
        // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
        <StatusPill group="sync" id={id} />
      )}
    </span>
  );
}
