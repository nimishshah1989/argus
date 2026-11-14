import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handlers } from '../src/state/commands/registry.js';

const here = (path: string) => new URL(path, import.meta.url);

const COMMAND_FILES = [
  'acknowledge',
  'acknowledge-escalation',
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
        'acknowledgeEscalation',
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
      `ACK_CLOCK_STOPS, ACTION_ORDER, CLOCK_TRIGGER, COMPUTERS, ESCALATION_DEFAULTS, FIGURES, FIGURE_KEYS, LOCKOUT_EVENT_TYPES, SlaInputError, TransitionError, acknowledge, acknowledgeEscalation, acknowledgeRefusal, addBusinessMinutes, apply, asksSignoff, assertWorking, availableActions, businessMinutesBetween, canAcknowledge, canAnalytics, canAnswerHandback, canAnswerHandbackAtAll, canBreakdownPdf, canCancel, canClose, canCorrect, canDayReport, canLateReport, canLiveBoard, canManageSupportAccess, canMoney, canRaise, canRestore, canSettingsAi, canSettingsLists, canSettingsPeople, canSettingsSla, canTeamDayReport, canWork, cancel, chainAcknowledged, clampAt, close, closeSegments, computeSeverity, confirmLockout, correct, currentSignoff, dayScore, defaultSeverityMatrix, eventsSinceLastTransfer, figures, handbackConfirm, handbackDispute, join, lastEventAt, lateReport, leave, machineRunning, machineStopped, mayAcknowledgeLevel, nextRef, nextSeq, offersAcknowledge, passwordProblem, pause, pendingEscalationLevels, personMinutes, projectHandbackTimer, projectPauseTimer, projectSlaTimers, raiseTicket, recordPastBreakdown, remainingSlaMinutes, reopenEpisode, repeatAfterMinutes, restore, resume, run, runWith, seesAllNeedReport, severityAtLeast, signoffTurnaround, slaBreached, standingLockoutConfirmations, start, transfer, transition, update, upgradeKind, workersAfterResume`.split(
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
