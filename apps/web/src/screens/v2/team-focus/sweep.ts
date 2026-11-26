import type { Sheet } from '@uptimo/shared/xlsx';
import type { TeamFocusModel } from './model.js';

/**
 * Team Focus's "Download Excel" (ADR 0036 R6, ADR 0041; no DOC. NO.: the page is not in `DOC_REF`). Two sheets, each
 * its table as the page first shows it, header row first, numbers as numbers (never re-rounded):
 * 1. name `model.words.people.title`; header [person, open, hours, done, load] from `model.words.people.columns`; one
 *    row per `model.people` entry, ordered by `open` largest first (the table's first sort; equal `open` keep the
 *    model's order): [person, open (number), hours.value (number), done (number), loadLabel], where person is
 *    `chip.label`, then ' · ' and `role` when `role` is not ''; `loadLabel` is printed as it is ('' stays '').
 * 2. name `model.words.actions.title`; header [action, owner, status, hours] from `model.words.actions.columns`; one
 *    row per `model.actions` entry, ordered by `hours.value` largest first (equal values keep the model's order):
 *    [action, owner, statusLabel, hours.value (number)], where action is `kindLabel`, every chip's `label`, `title`
 *    and `note`, the ones that are not '' joined with ' · ' ("PM · VMC-3 · Change the belt · ordered"), and owner is
 *    `owner.label`, or `model.words.actions.noOwner` when there is none.
 * Empty tables still give their sheet with the header row only. Never mutates the model.
 */
export function teamFocusSheets(model: TeamFocusModel): Sheet[] {
  const { people, actions } = model.words;
  const pc = people.columns;
  const ac = actions.columns;
  return [
    {
      name: people.title,
      rows: [
        [pc.person, pc.open, pc.hours, pc.done, pc.load],
        ...[...model.people]
          .sort((a, b) => b.open - a.open)
          .map((p) => [
            p.role === '' ? p.chip.label : `${p.chip.label} · ${p.role}`,
            p.open,
            p.hours.value,
            p.done,
            p.loadLabel,
          ]),
      ],
    },
    {
      name: actions.title,
      rows: [
        [ac.action, ac.owner, ac.status, ac.hours],
        ...[...model.actions]
          .sort((a, b) => b.hours.value - a.hours.value)
          .map((a) => [
            [a.kindLabel, ...a.chips.map((c) => c.label), a.title, a.note]
              .filter((s) => s !== '')
              .join(' · '),
            a.owner?.label ?? actions.noOwner,
            a.statusLabel,
            a.hours.value,
          ]),
      ],
    },
  ];
}
