import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { LOGO_MAX_BYTES, apiError } from '@uptimo/shared';
import { canSettingsLists } from '@uptimo/domain';
import { withTenant, type AppConfig } from '../../kernel/index.js';
import { insertFileRow, storeFor } from '../files/index.js';
import { requireAuth, setTenantLogo } from '../identity/index.js';
import { audit } from '../ops/index.js';
import { actorOf, forbidden } from './actor.js';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** What the first bytes say the file is, whatever the sender claimed. */
export function imageType(bytes: Buffer): { mime: string; ext: string } | null {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  const riff = bytes.subarray(0, 4).toString('latin1') === 'RIFF';
  if (riff && bytes.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

/** `PUT /company/logo`: the body is the image itself. Head and admin only; the previous logo file is kept. */
export function registerCompanyRoutes(app: FastifyInstance, config: AppConfig): void {
  app.addContentTypeParser(
    IMAGE_TYPES,
    { parseAs: 'buffer', bodyLimit: LOGO_MAX_BYTES },
    (_request, body, done) => done(null, body),
  );
  app.put('/api/v1/company/logo', { bodyLimit: LOGO_MAX_BYTES }, async (request, reply) => {
    const ctx = await requireAuth(config.pool, request, reply);
    if (!ctx) return;
    if (!canSettingsLists(actorOf(ctx))) return forbidden(reply);
    const bytes = request.body as Buffer;
    const found = imageType(bytes);
    const declared = String(request.headers['content-type'] ?? '').split(';')[0];
    if (!found || found.mime !== declared) {
      return reply.code(422).send(apiError('validation', 'Send a PNG, JPEG or WebP image', 'logo'));
    }
    const key = `${ctx.tenantId}/logo-${randomUUID()}.${found.ext}`;
    await storeFor(config).put(key, bytes);
    const fileId = await withTenant(config.pool, ctx.tenantId, async (tx) => {
      const id = await insertFileRow(tx, {
        tenantId: ctx.tenantId,
        key,
        mime: found.mime,
        bytes,
        kind: 'logo',
        uploadedBy: ctx.personId,
      });
      await setTenantLogo(tx, id);
      await audit.record(tx, {
        tenantId: ctx.tenantId,
        loginId: ctx.loginId,
        action: 'company.logo',
        entity: 'tenant',
        entityId: ctx.tenantId,
        before: null,
        after: { fileId: id, mime: found.mime, bytes: bytes.length },
      });
      return id;
    });
    reply.send({ logo: `/api/v1/files/${fileId}` });
  });
}
