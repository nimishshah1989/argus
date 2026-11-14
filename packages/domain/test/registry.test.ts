import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handlers } from '../src/state/commands/registry.js';

const here = (path: string) => new URL(path, import.meta.url);

const COMMAND_FILES = [
  'acknowledge',
  'cancel',
  'close',
  'confirm-lockout',
  'correct',
  'handback-confirm',
  'handback-dispute',
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
        'acknowledge',
        'cancel',
        'close',
        'confirmLockout',
        'correct',
        'handbackConfirm',
        'handbackDispute',
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
      `ACTION_ORDER, ESCALATION_DEFAULTS, LOCKOUT_EVENT_TYPES, SlaInputError, TransitionError, acknowledge, addBusinessMinutes, apply, asksSignoff, assertWorking, availableActions, businessMinutesBetween, canAcknowledge, canAnalytics, canAnswerHandback, canAnswerHandbackAtAll, canBreakdownPdf, canCancel, canClose, canCorrect, canDayReport, canLateReport, canLiveBoard, canMoney, canRaise, canRestore, canSettingsAi, canSettingsLists, canSettingsPeople, canSettingsSla, canTeamDayReport, canWork, cancel, clampAt, close, closeSegments, computeSeverity, confirmLockout, correct, currentSignoff, dayScore, defaultSeverityMatrix, figures, handbackConfirm, handbackDispute, join, lastEventAt, lateReport, leave, machineRunning, machineStopped, nextRef, nextSeq, passwordProblem, pause, personMinutes, projectHandbackTimer, projectPauseTimer, projectSlaTimers, raiseTicket, recordPastBreakdown, remainingSlaMinutes, restore, resume, seesAllNeedReport, signoffTurnaround, slaBreached, standingLockoutConfirmations, start, transfer, transition, update, upgradeKind`.split(
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
