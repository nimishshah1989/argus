/**
 * The v2 icon set: one stroke weight (1.8 on a 24 grid), sized to the text beside it, drawn in the text's colour.
 * Every entity has its icon and wears it wherever it appears. Icons are always decoration: the word beside them, or
 * the control's own name, says what they mean.
 */
const PATHS = {
  today: ['M3 11 12 4l9 7v9H5z', 'M10 20v-6h4v6'],
  machines: [
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  ],
  problems: ['M12 3 2 21h20L12 3z', 'M12 10v5M12 18h.01'],
  reliability: ['M4 20V4M4 20h16', 'm7 15 4-4 3 3 5-6'],
  people: [
    'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M2 20c0-3.5 3-6 7-6s7 2.5 7 6',
    'M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5.2-5-5.8',
  ],
  reports: ['M6 3h8l4 4v14H6z', 'M14 3v4h4M9 13h6M9 17h6'],
  guide: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19V5M8 7h7'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm20 20-3.5-3.5'],
  bell: ['M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z', 'M10 20a2 2 0 0 0 4 0'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 6l12 12M18 6 6 18'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  check: ['M5 12l4 4 10-10'],
  up: ['M7 17 17 7M9 7h8v8'],
  down: ['M7 7l10 10M17 9v8H9'],
  sort: ['M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  wrench: [
    'M14.5 5.5a4 4 0 0 0-5.3 5.3L3 17l4 4 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.6-.6-2.6z',
  ],
  pause: ['M9 5v14M15 5v14'],
  alert: ['M12 3 2 21h20L12 3z', 'M12 10v5M12 18h.01'],
  stop: ['M6 6l12 12M18 6 6 18'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  rupee: ['M6 4h12M6 9h12M6 4c7 0 7 10 0 10l8 6'],
  gauge: ['M12 14 16 9', 'M3.5 17a9 9 0 1 1 17 0'],
  list: ['M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'],
  inbox: ['M3 13h5l1 3h6l1-3h5', 'M5 5h14l2 8v6H3v-6z'],
  cell: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  person: ['M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M5 20c0-3.5 3-6 7-6s7 2.5 7 6'],
  decision: ['M5 21V4', 'M5 4h12l-2.5 4L17 12H5'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="v2-icon"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
