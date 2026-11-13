import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handlers } from '../src/state/commands/registry.js';

const here = (path: string) => new URL(path, import.meta.url);

const COMMAND_FILES = [
  'cancel',
  'close',
  'correct',
  'join',
  'late-report',
  'leave',
  'machine-running',
  'machine-stopped',
  'pause',
  'restore',
  'resume',
  'start',
  'transfer',
  'update',
  'upgrade-kind',
].map((name) => `${name}.ts`);

describe('domain registries', () => {
  it('D1: one file per command', () => {
    expect(readdirSync(here('../src/state/commands/')).sort()).toEqual(
      [...COMMAND_FILES, 'index.ts', 'registry.ts'].sort(),
    );
    expect(Object.keys(handlers).sort()).toEqual(
      [
        'cancel',
        'close',
        'correct',
        'join',
        'lateReport',
        'leave',
        'machineRunning',
        'machineStopped',
        'pause',
        'restore',
        'resume',
        'start',
        'transfer',
        'update',
        'upgradeKind',
      ].sort(),
    );
  });

  it('D2: the public API is unchanged', async () => {
    expect(Object.keys(await import('../src/index.js')).sort()).toEqual(
      `SlaInputError, TransitionError, addBusinessMinutes, apply, assertWorking, businessMinutesBetween, canAnalytics, canCancel, canClose, canCorrect, canDayReport, canLateReport, canLiveBoard, canMoney, canRaise, canRestore, canSettingsLists, canSettingsPeople, canSettingsSla, canWork, cancel, clampAt, close, closeSegments, computeSeverity, correct, defaultSeverityMatrix, figures, join, lastEventAt, lateReport, leave, machineRunning, machineStopped, nextRef, nextSeq, pause, projectSlaTimers, raiseTicket, recordPastBreakdown, remainingSlaMinutes, restore, resume, slaBreached, start, transfer, transition, update, upgradeKind`.split(
        ', ',
      ),
    );
  });

  it('D3: permissions are one file per area', () => {
    expect(readdirSync(here('../src/permissions/'))).toEqual([
      'settings.ts',
      'ticket.ts',
      'views.ts',
    ]);
  });
});
