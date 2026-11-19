import type { PoolClient } from 'pg';
import { audit } from '../ops/index.js';
import { activateListEntry, insertListEntryIfMissing } from './repo/legacy-lists.js';

/** The two entries a plant event (ticket 69) names, switched on like any list entry the importer needs. */
const PLANT_EVENT_ENTRIES = [
  { list: 'location', code: 'Plant', label: 'Plant' },
  { list: 'work_type', code: 'Utility failure', label: 'Utility failure' },
] as const;

/**
 * Before the old history loads: the list entries `Plant` (location) and `Utility failure` (work type), and every
 * maintenance code the workbooks' legends use that the plant does not hold yet, as a switched-off entry (off for
 * new tickets, still shown on old reports: ticket 47). The two plant-event entries are switched back on if
 * they exist switched off (the importer reads active entries only); a legend code that exists is never touched. A second
 * call changes nothing. Each change is one audit line. Returns the entries added or switched on, as `list:code`.
 */
export async function ensureLegacyListEntries(
  tx: PoolClient,
  who: { tenantId: string; loginId: string | null },
  maintCodes: readonly string[],
): Promise<string[]> {
  const wanted = [
    ...PLANT_EVENT_ENTRIES.map((entry) => ({ ...entry, active: true })),
    ...[...new Set(maintCodes.map((code) => code.trim()).filter(Boolean))]
      .sort()
      .map((code) => ({ list: 'maint_code', code, label: code, active: false })),
  ];
  const added: string[] = [];
  for (const entry of wanted) {
    const made = await insertListEntryIfMissing(tx, who.tenantId, entry);
    const woken = !made && entry.active && (await activateListEntry(tx, who.tenantId, entry));
    if (!made && !woken) continue;
    added.push(`${entry.list}:${entry.code}`);
    await audit.record(tx, {
      tenantId: who.tenantId,
      loginId: who.loginId,
      action: 'list_item.legacy_history',
      entity: 'list_item',
      before: woken ? { list: entry.list, code: entry.code, active: false } : null,
      after: { list: entry.list, code: entry.code, active: entry.active, switchedOn: woken },
    });
  }
  return added;
}
