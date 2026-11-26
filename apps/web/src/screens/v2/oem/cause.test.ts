// @vitest-environment node
import { readFileSync } from 'node:fs';
import { en, gu } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { fill } from '../../../i18n/fill.js';
import { printed } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { causeCell, oemModel } from './adapter.js';
import { BREAKDOWNS, causeReply } from './cause-fixture.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const breakdowns = (mayDecide: boolean) =>
  oemModel(causeReply(), t, { mayDecide })!.tables.find((table) => table.title === BREAKDOWNS)!;

describe('S18 people decide each breakdown’s cause (ADR 0051)', () => {
  it('a cause cell is a button for someone who may decide, plain text otherwise', () => {
    expect(causeCell('Not decided', 't1', true)).toEqual({
      text: 'Not decided',
      sort: 'Not decided',
      action: 'cause:t1',
    });
    expect(causeCell('Our side', 't1', false)).toEqual({ text: 'Our side', sort: 'Our side' });
  });

  it('the breakdown table shows the Cause column, each row’s button naming its own ticket', () => {
    const table = breakdowns(true);
    const at = table.header.findIndex((h) => h.label === 'Cause');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(table.rows[0]![at]).toMatchObject({
      text: 'OEM / build defect',
      action: 'cause:ticket-0',
    });
    expect(table.rows[1]![at]).toMatchObject({ text: 'Not decided', action: 'cause:ticket-1' });
  });

  it('everyone sees the decided cause, even a reader who may not decide (the Guide promises it)', () => {
    const table = breakdowns(false);
    const at = table.header.findIndex((h) => h.label === 'Cause');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(table.rows[0]![at]).toEqual({ text: 'OEM / build defect', sort: 'OEM / build defect' });
  });

  it('the screen’s own words say nothing of a suggested cause: only a person decides (ADR 0051)', () => {
    const words = Object.entries(en).filter(([key]) => key.startsWith('v2m.oem.'));
    for (const [key, text] of words) expect(text, key).not.toMatch(/suggest/i);
  });

  it('with no young machine the page says so, not the generic message', () => {
    expect(en['v2m.oem.empty' as keyof typeof en]).toMatch(/under 300 days/);
    expect((gu as Record<string, string>)['v2m.oem.empty']).toBeTruthy();
    const live = readFileSync(new URL('../live.tsx', import.meta.url), 'utf8');
    expect(live).toMatch(/screen="oem"\s+empty="v2m\.oem\.empty"/);
  });

  it('a row the engine could not name a ticket for has no button', () => {
    const table = breakdowns(true);
    const at = table.header.findIndex((h) => h.label === 'Cause');
    expect(table.rows.at(-1)![at]!.action).toBeUndefined();
  });

  it('the Cause column filters, so Not decided is one tap away', () => {
    expect(breakdowns(true).chips.map((chip) => chip.key)).toContain('Not decided');
  });

  it('the verdict says how many breakdowns still have no cause decided', () => {
    const shown = printed(oemModel(causeReply(), t, { mayDecide: false })).join(' ');
    expect(shown).toContain('71 of 72 breakdowns have no cause decided yet');
  });

  it('has the picker’s words in English and Gujarati', () => {
    const keys = Object.keys(en).filter((key) => key.startsWith('v2m.oem.cause.'));
    expect(keys.length).toBeGreaterThanOrEqual(7);
    for (const key of keys) expect((gu as Record<string, string>)[key], key).toBeTruthy();
  });

  it('saves through PUT /tickets/:id/oem-cause', () => {
    const api = readFileSync(new URL('../../../api.ts', import.meta.url), 'utf8');
    expect(api).toMatch(
      /export const putOemCause|export function putOemCause|export async function putOemCause/,
    );
    expect(api).toMatch(/oem-cause/);
  });
});
