/**
 * Every word and symbol the meaning map prints that no message catalogue holds yet (ticket 82). English now;
 * a second language replaces this one file. Status words that already have a catalogue key keep it.
 */
export const UNIT_SYMBOL = {
  count: '',
  hours: 'hrs',
  percent: '%',
  money: '₹',
  perDay: '/day',
  hoursPerDay: 'hrs/day',
  hoursPerMachine: 'hrs/machine',
  years: 'yrs',
  score: '',
  none: '',
} as const;

export const CHANGE_WORD = {
  better: 'Better',
  worse: 'Worse',
  same: 'No change',
  changed: 'Changed',
} as const;

export const DIRECTION_WORD = {
  up: 'Up is good',
  down: 'Down is good',
  neither: 'Neither is better',
} as const;
