/**
 * The documented reference fields. `path` is matched against a value's path, array positions written `[]` and an id
 * used as an object key `{id}`. `unordered` marks a list of ids whose order is a tie-break, not a meaning.
 */
export interface Reference {
  /** The figure the entry is for; absent means any figure. */
  figure?: string;
  path: RegExp;
  /** The sibling field that carries the printable code; it must be there and must not be a UUID. */
  codeBeside?: string;
  why: string;
  unordered?: true;
}

export const REFERENCES: readonly Reference[] = [
  {
    path: /^pages\[\]\.tables\[\]\.rowTicketIds\[\]$/,
    why: 'the ticket behind each table row, row for row: the eye on the row opens it',
  },
  {
    path: /^extra\.(byCell|byLocation)\[\]\.machineIds\[\]$/,
    why: 'the machines behind an energy tile: the panel fetches their rows by id and prints their codes',
  },
  {
    figure: 'dashboard.bubble-chart',
    path: /^datasets\[\]\.data\[\]\.id$/,
    codeBeside: 'code',
    why: 'a bubble names its machine by id so the screen can open it; its `code` beside it is what is printed',
  },
  {
    figure: 'a9-bottleneck-forecast',
    path: /^pages\[\]\.charts\[\]\.datasets\[\]\.data\[\]\.id$/,
    codeBeside: 'code',
    why: 'a risk-map dot names its machine by id so the screen can open it; its `code` beside it is what is printed',
  },
  {
    figure: 'action-center',
    path: /^extra\.nudges\[\]\.machines\[\]$/,
    why: 'the machines a nudge names: the card looks each up by id for its chip and link',
  },
  {
    figure: 'action-center',
    path: /^extra\.acks\.|^extra\.nudges\[\]\.key$/,
    why: 'the saved acks and each nudge are keyed by `freq|<machine id>` and the like; a save is keyed by it, never shown',
  },
  {
    figure: 'data-checklist',
    path: /^items\[\]\.key$/,
    why: 'a checklist item is identified by `<group>|<sheet>|<machine id>` or `<group>|<report id>`; never shown, its `plain` is',
  },
  {
    figure: 'team-focus',
    path: /^extra\[\]\.key$/,
    why: 'an action is identified by `fc|<machine id>|<month>` and the like, never shown, its `title` is',
  },
  {
    figure: 'team-focus',
    path: /^extra\[\]\.machine$/,
    codeBeside: 'machineCode',
    why: 'the machine an action opens by id; `machineCode` beside it is what the card prints',
  },
  {
    path: /^moves\[\]\.(id|machineId)$/,
    why: 'the move and the machine it moved: the adapter looks the machine up and prints its code',
  },
  {
    path: /^byMachine\.{id}$/,
    why: 'the machine page of every machine, keyed by the machine id the screen asks for',
  },
  {
    path: /^byMachine\.{id}\.moves\[\]\.(id|machineId)$/,
    why: 'the moves of a machine by id; the adapter looks the machine up and prints its code',
  },
  {
    path: /^byMachine\.{id}\.machine\.id$/,
    codeBeside: 'code',
    why: 'the machine by id; its record carries `code` beside it',
  },
  {
    path: /^byMachine\.{id}\.drill\.(breakdowns|pm|moves)\[\]$/,
    why: 'the rows the machine page opens through the drill endpoint',
    unordered: true,
  },
  {
    path: /^machines\.{id}$/,
    why: 'one reliability record per machine, keyed by the machine id the screen asks for',
  },
  {
    path: /^machines\.{id}\.drill\.(fit|spares)\[\]$/,
    why: 'the rows behind a reliability fit or a spare: same-day ties order by id, and no order is meant',
    unordered: true,
  },
];
