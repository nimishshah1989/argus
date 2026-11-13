import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { severityMatrixSchema, type SeverityMatrix } from '@uptimo/shared';
import { configParts, withTenant } from '../../kernel/index.js';
import { listPeople, tenantInfo } from '../identity/index.js';
import { loadPlantRows } from './repo/config.js';

export interface ConfigPayload {
  features: Record<string, boolean>;
  language: string;
  timeZone: string;
  lists: Record<string, unknown[]>;
  segments: unknown[];
  groups: unknown[];
  machines: unknown[];
  people: unknown[];
  shifts: unknown[];
  severityMatrix: SeverityMatrix;
}

export function fingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
}

function listItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    list: row.list,
    code: row.code,
    label: row.label,
    labelGu: row.label_gu,
    labelHi: row.label_hi,
    sort: row.sort,
    active: row.active,
    isVendor: row.is_vendor,
    pausesSla: row.pauses_sla,
    tag: row.tag,
  };
}

export async function loadConfig(
  pool: Pool,
  tenantId: string,
): Promise<ConfigPayload & Record<string, unknown>> {
  return withTenant(pool, tenantId, async (client) => {
    const plant = await loadPlantRows(client);
    const people = await listPeople(client);
    const tenant = await tenantInfo(client, tenantId);
    const byList: Record<string, unknown[]> = {};
    for (const row of plant.lists) {
      (byList[row.list as string] ??= []).push(listItem(row));
    }
    const features = (plant.settings.find((row) => row.key === 'features')?.value ?? {
      general: true,
      pause: true,
    }) as Record<string, boolean>;

    // Load severity matrix - default is built in if missing
    const severityMatrixRow = plant.settings.find((row) => row.key === 'severity_matrix');
    const severityMatrix = severityMatrixRow
      ? severityMatrixSchema.parse(severityMatrixRow.value)
      : {
          default: {
            A: { stopped: 'S1' as const, support: 'S2' as const },
            B: { stopped: 'S2' as const, support: 'S3' as const },
            C: { stopped: 'S3' as const, support: 'S4' as const },
          },
          workRequest: 'S4' as const,
          urgentWorkRequest: 'S3' as const,
        };

    return {
      features,
      language: tenant.language,
      timeZone: tenant.time_zone,
      lists: byList,
      segments: plant.segments,
      groups: plant.groups,
      machines: plant.machines,
      people,
      shifts: plant.shifts,
      severityMatrix,
      ...(await configParts(client, tenantId)),
    };
  });
}
