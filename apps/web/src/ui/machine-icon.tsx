import { TONE_FILL, segmentIcon, statusMeaning } from './meaning.js';
import type { StatusId } from './status/index.js';

const SIZE = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 18 },
  md: { box: 'h-10 w-10 rounded-[10px]', icon: 22 },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 32 },
};

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
  /** `lg` is the wall TV's live board. */
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = segmentIcon(segment);
  const tone = status === 'running' ? 'muted' : statusMeaning({ group: 'ticket', id: status }).tone;
  const { box, icon } = SIZE[size];
  return (
    <span
      aria-hidden
      data-machine={`${segment}.${status}`}
      className={`inline-flex flex-none items-center justify-center ${box} ${TONE_FILL[tone]}`}
    >
      <Icon size={icon} />
    </span>
  );
}
