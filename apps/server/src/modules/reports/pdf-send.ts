import type { FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { apiError } from '@uptimo/shared';
import { RenderBusyError } from './render-gate.js';

const PDF_MIME = 'application/pdf';

export interface PdfDeps {
  pool: Pool;
  chromiumPath?: string;
}

export interface SendOptions {
  type?: string;
  /** A PDF opens in the browser; a workbook downloads. */
  disposition?: 'inline' | 'attachment';
}

/** A report is made when asked for and sent as it is: nothing is stored, so nothing is lost on a deploy. */
export function sendBytes(
  reply: FastifyReply,
  bytes: Buffer,
  fileName: string,
  options: SendOptions = {},
): void {
  const { type = PDF_MIME, disposition = 'inline' } = options;
  reply
    .type(type)
    .header('content-disposition', `${disposition}; filename="${fileName}"`)
    .send(bytes);
}

/** Runs a render; a full queue becomes a 503 the caller can retry (null: the reply is already sent). */
export async function renderOrBusy(
  reply: FastifyReply,
  render: () => Promise<Buffer>,
): Promise<Buffer | null> {
  try {
    return await render();
  } catch (error) {
    if (!(error instanceof RenderBusyError)) throw error;
    reply
      .code(503)
      .header('retry-after', '5')
      .send(
        apiError('rate_limited', 'Too many reports are being made right now; try again shortly'),
      );
    return null;
  }
}
