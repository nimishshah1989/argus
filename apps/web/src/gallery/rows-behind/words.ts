import type { RowsBehindAdapterWords } from '../../ui/v2/domain/rows-behind-adapter.js';
import type { RowsBehindWords } from '../../ui/v2/domain/rows-behind.js';

/** Every word the rows-behind demo prints, in English for the gallery; the API adapter brings the reader's language. */
export const adapterWords: RowsBehindAdapterWords = {
  locale: 'en-IN',
  counted: {
    machine: '{n} machines counted',
    ticket: '{n} tickets counted',
    move: '{n} cell moves counted',
  },
  source: 'Counted from the plant records, as of {date}',
  none: '—',
  cell: 'Cell {n}',
  hours: '{n} h',
  columns: {
    machine: 'Machine',
    cell: 'Cell',
    type: 'Type',
    makeModel: 'Make and model',
    year: 'Year',
    status: 'Status',
    ticket: 'Ticket',
    reported: 'Reported',
    downtime: 'Downtime',
    work: 'Work',
    from: 'From',
    to: 'To',
    movedOn: 'Moved on',
    location: 'Location',
    connectedKva: 'Connected KVA',
    runningKva: 'Running KVA',
  },
  ticketStatus: {
    open: 'Open',
    working: 'In progress',
    waiting: 'Waiting',
    closed: 'Closed',
    cancelled: 'Cancelled',
  },
  ticketKind: { stopped: 'Machine stopped', support: 'Support', general: 'General work' },
  machineStatus: { active: 'Running', idle: 'Idle', scrapped: 'Scrapped' },
};

export const tableWords: RowsBehindWords = {
  title: 'The rows',
  search: 'Search these rows',
  showing: '{from}–{to} of {total}',
  noResults: 'No rows match your search.',
  open: 'Open',
  all: 'All',
  empty: 'Nothing is counted behind this figure.',
};

/** The figures the demo shows: what each is called, and the control that opens its rows. */
export const figureLabels: Record<string, string> = {
  'dashboard.pm-hours': 'PM hours',
  'dashboard.breakdown-free': 'Machines with no breakdown',
  'dashboard.process-machines': 'Process machines',
  'dashboard.conventional-machines': 'Conventional machines',
  'dashboard.dg-sets': 'DG sets',
  'cell-change-log': 'Cell moves',
};
export const openLabel = 'Show the rows behind {figure}';

export const viewWords = {
  title: 'Rows behind a figure',
  pmMeaning: 'Hours machines stood still for planned maintenance.',
  pmMore: 'Press the figure to see each job.',
  movesMeaning: 'Machines that changed cell this year.',
  movesMore: 'Press the figure to see each move.',
  paretoTitle: 'Machines outside the CNC line',
  paretoAria: 'Bars: process machines 17, conventional machines 16, DG sets 3.',
  paretoConclusion: 'Process and conventional machines are nearly all of them.',
  paretoWhyLabel: 'Why these?',
  paretoWhy: 'Each bar opens the machines it counts.',
  bulletTitle: 'Machines with no breakdown',
  bulletVerdict: 'Below target',
  bulletAria: '53 of 125 machines, target 100, last month 49.',
  bulletWhy: 'Press the list button to see the 53 machines.',
  legend: { actual: 'This month', target: 'Target', last: 'Last month', zone: 'Good zone' },
  period: '',
  noChange: 'As counted today',
};
