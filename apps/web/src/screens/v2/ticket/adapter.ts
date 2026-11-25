import type { TFunction } from 'i18next';
import type { TicketInput, TicketModel } from './model.js';

/**
 * The `/tickets/:id` reply (+ config, login, clock, brand) → the read part of the ticket page. Pure: same input, same
 * model. Facts and figures through v1's pure helpers (`liveDowntime.ts`, `escalation-history.ts`, `format.ts`).
 */
export function ticketModel(input: TicketInput, t: TFunction): TicketModel {
  void input;
  void t;
  throw new Error('not implemented');
}
