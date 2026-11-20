import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/a6-why-why.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { whyWhyModel } from './adapter.js';

/**
 * The gallery's version of this screen: the engine's frozen answer for the 11 November plant, through the live adapter.
 * The frozen answer carries no ticket beside a row, so each row is given a stand-in so the gallery can show Start; the
 * gallery saves nothing.
 */
export const whyWhyModelFromKey = async () => {
  const model = whyWhyModel(keyReply('a6-why-why', 41, key), i18n.t.bind(i18n));
  return (
    model && {
      ...model,
      rows: model.rows.map((row) => ({ ...row, ticketId: `gallery-${row.id}` })),
    }
  );
};
