import { useSyncStatus } from '../data/index.js';
import { StatusPill } from '../ui/status/status-pill.js';

export function SyncStatus() {
  const id = useSyncStatus();
  return (
    <span role="status" data-testid="sync-status">
      {/* eslint-disable-next-line i18next/no-literal-string -- prop value, not copy */}
      <StatusPill group="sync" id={id} />
    </span>
  );
}
