/* eslint-disable i18next/no-literal-string -- icon names, tones and segment codes only; every visible word comes in the model */
import { Icon, type IconName } from '../../../ui/v2/icons.js';
import type { AgeTone, BoardColumn } from './model.js';

/** A column's status as the v2 kit says it: its tint and its icon, beside the chip's word. */
export const STATUS: Record<
  BoardColumn['status'],
  { tone: 'loss' | 'plan' | 'risk'; icon: IconName }
> = {
  stopped: { tone: 'loss', icon: 'stop' },
  in_progress: { tone: 'plan', icon: 'wrench' },
  waiting: { tone: 'risk', icon: 'pause' },
};

/** Red where nobody has started, amber while waiting, plain while repaired. */
export const AGE_INK: Record<NonNullable<AgeTone>, string> = {
  danger: 'v2-seg-loss',
  hold: 'v2-seg-risk',
};

/** Plant segment codes to the v2 segment colours (ADR 0036 R23); a code the map does not know stays grey. */
const SEGMENT: Record<string, string> = {
  cnc: 'cnc',
  conventional: 'conv',
  process: 'process',
  utility: 'util',
  dg: 'dg',
  robot: 'robot',
};

/** A machine's tile: the colour is its segment, never good or bad. Decorative: the row names the machine. */
export function MachineTile({ segment, tv }: { segment: string; tv: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-machine={segment}
      data-seg={SEGMENT[segment.toLowerCase()]}
      className={`board-machine ${tv ? 'h-14 w-14 rounded-2xl' : 'h-10 w-10 rounded-xl'}`}
    >
      <Icon name="machines" size={tv ? 32 : 22} />
    </span>
  );
}
