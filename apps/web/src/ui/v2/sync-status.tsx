import { useTranslation } from 'react-i18next';
import { useSyncStatus, type SyncId } from '../../data/index.js';
import type { IconName } from './icons.js';
import { KeyPill, type PillTone } from './key-pill.js';

const PILL: Record<SyncId, { tone: PillTone; icon: IconName }> = {
  online: { tone: 'neutral', icon: 'check' },
  offline: { tone: 'risk', icon: 'pause' },
  sending: { tone: 'plan', icon: 'clock' },
  draft: { tone: 'risk', icon: 'alert' },
};

/**
 * Whether this device is online, sending what it queued, or holding a draft, as a v2 pill. The live region stays so a
 * change is announced.
 */
export function SyncStatus() {
  const { t } = useTranslation();
  const id = useSyncStatus();
  const { tone, icon } = PILL[id];
  return (
    <span role="status" data-testid="sync-status" data-status={`sync.${id}`}>
      <KeyPill text={t(`status.sync.${id}`)} tone={tone} icon={icon} />
    </span>
  );
}
