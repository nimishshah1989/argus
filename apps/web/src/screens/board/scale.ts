/** The board's type, by role: the phone keeps the locked six sizes, the TV uses its own scale (14 Nov). */
const PHONE = {
  hero: 'text-title1 font-extrabold',
  heroWord: 'text-title3 font-bold',
  sub: 'text-footnote',
  stopNumber: 'text-title2 font-extrabold',
  stopWord: 'text-body font-bold',
  chip: 'text-caption font-semibold',
  count: 'text-title2 font-extrabold',
  columnTitle: 'text-body font-bold',
  code: 'text-title3 font-bold',
  age: 'text-title3 font-bold',
  big: 'text-title2 font-extrabold',
  card: 'rounded-card p-4',
  icon: 18,
  /** A row: on the phone the icon and age stand beside both lines; on the TV the place line runs under the age. */
  machineIcon: 'md' as 'md' | 'lg',
  rowSide: 'row-span-2',
  rowSub: 'truncate',
  ageGrid: 'grid-cols-2 lg:grid-cols-4',
};

export type Scale = typeof PHONE;

const TV: Scale = {
  hero: 'text-tv-160 font-extrabold leading-none tracking-tight',
  heroWord: 'text-tv-64 font-bold leading-none',
  sub: 'text-title1 leading-tight',
  stopNumber: 'text-tv-120 font-extrabold leading-none',
  stopWord: 'text-tv-48 font-bold',
  chip: 'text-title1 font-bold',
  count: 'text-tv-64 font-extrabold leading-none',
  columnTitle: 'text-tv-40 font-bold leading-tight',
  code: 'text-tv-48 font-extrabold leading-none',
  age: 'text-tv-48 font-bold',
  big: 'text-tv-80 font-extrabold leading-none',
  card: 'rounded-card p-6',
  icon: 56,
  machineIcon: 'lg',
  rowSide: '',
  rowSub: 'col-span-2 mt-1',
  ageGrid: '',
};

export const scaleFor = (tv: boolean): Scale => (tv ? TV : PHONE);
