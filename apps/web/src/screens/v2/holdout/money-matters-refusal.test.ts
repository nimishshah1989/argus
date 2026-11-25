import { describe, expect, it } from 'vitest';
import { mayReadMoney } from '../figures/read.js';
import { realReply } from '../figures/real-reply.js';
import { tilesIn } from '../insight.js';
import { moneyMattersModel } from '../money-matters/adapter.js';
import { realT } from '../printed-page/test-support.js';

/**
 * Hidden (ticket 644, money and permissions, ADR 0034): a login without money rights gets S22's refusal and never a
 * figure, whether the server left the money figure in the reply or filtered it out (its `MONEY` filter); a head,
 * plant head or admin gets the page.
 */
const reply = realReply();
const filtered = { ...reply, figures: reply.figures.filter((f) => f.key !== 'money-matters') };

describe('S22 refuses money to a login without money rights', () => {
  for (const role of ['supervisor', 'lead', 'op', 'technician', undefined]) {
    it(`${String(role)}: the refusal only, no rupee, no figure`, () => {
      expect(mayReadMoney(role)).toBe(false);
      for (const shown of [reply, filtered]) {
        const model = moneyMattersModel(shown, realT, { money: mayReadMoney(role) });
        expect(model).toMatchObject({ refused: true });
        const json = JSON.stringify(model);
        expect(json).not.toContain('₹');
        for (const figure of ['55.08', '44.87', '64.65', '1,800', '3,060'])
          expect(json).not.toContain(figure);
        expect(tilesIn(model)).toEqual([]);
      }
    });
  }

  for (const role of ['head', 'plant_head', 'admin']) {
    it(`${role}: the page`, () => {
      const model = moneyMattersModel(reply, realT, { money: mayReadMoney(role) });
      expect(model).toMatchObject({ refused: false });
      expect(JSON.stringify(model)).toContain('₹ 55.08 lakh');
    });
  }
});
