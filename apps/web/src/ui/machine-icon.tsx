import { TONE_FILL, segmentIcon, statusMeaning } from './meaning.js';
import type { StatusId } from './status/index.js';

/**
 * A machine's tile: the shape is its segment, the colour its live status. Running stays neutral so colour
 * only shows where a person is needed. Decorative: the row beside it names the machine and its status.
 */
export function MachineIcon({
  segment,
  status,
  size = 'md',
}: {
  /** The segment's code. */
  segment: string;
  status: StatusId<'ticket'>;
  size?: 'sm' | 'md';
}) {
  const Icon = segmentIcon(segment);
  const tone = status === 'running' ? 'muted' : statusMeaning({ group: 'ticket', id: status }).tone;
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-[10px]';
  return (
    <span
      aria-hidden
      data-machine={`${segment}.${status}`}
      className={`inline-flex flex-none items-center justify-center ${box} ${TONE_FILL[tone]}`}
    >
      <Icon size={size === 'sm' ? 18 : 22} />
    </span>
  );
}
