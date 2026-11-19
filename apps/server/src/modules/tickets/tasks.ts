import type { PoolClient } from 'pg';
import { apiError, summariseTasks, taskState, type TaskInput, type TaskRow } from '@uptimo/shared';
import * as tm from './mapper.js';
import * as sql from './repo/ticket.js';
import * as repo from './repo/tasks.js';
import { tenantInfo } from '../identity/index.js';
import { activeListItems, recordPmCompletion } from '../plant/index.js';
import { plantDateAt, type StoredReport } from './repo/report.js';
import { buildRaiseExtras, buildRaised, loadSeverityMatrix } from './severity.js';

type Outcome = tm.Outcome;
type Row = Record<string, unknown>;

const refuse = (message: string, field: string): Outcome => ({
  status: 422,
  body: apiError('validation', message, field),
});

/** The plant's own `task_reason` list: a task may only be left for a reason the plant still offers. */
async function offersReason(client: PoolClient, tenantId: string, code: string): Promise<boolean> {
  return (await activeListItems(client, tenantId, ['task_reason'])).some(
    (item) => item.code === code,
  );
}

/** Whether this ticket is itself a follow-up task: a work request with a parent. */
const isTask = (row: Row): boolean => row.parent_id != null;

/**
 * What a close may carry beyond the ordinary: a task left behind, and a task's own machine-stopped minutes. A task
 * can be left from a breakdown, a support ticket or another task, not from a plain work request; the reason must be
 * one the plant offers; the minutes belong to a task only. Refused before anything is written.
 */
export async function checkTaskInput(
  client: PoolClient,
  tx: tm.Tx,
  loaded: tm.LoadedCtx,
): Promise<Outcome | null> {
  if (tx.action !== 'close') return null;
  const task = tx.body.task as TaskInput | undefined;
  if (task && loaded.row.kind === 'general' && !isTask(loaded.row)) {
    return refuse(
      'A follow-up task can only be left on a breakdown, a support ticket or another task',
      'task',
    );
  }
  if (task && !(await offersReason(client, tx.tenantId, task.reasonCode))) {
    return refuse('Unknown task reason', 'task.reasonCode');
  }
  if (tx.body.taskDownMin !== undefined && !isTask(loaded.row)) {
    return refuse(
      'Machine-stopped minutes are asked only when a follow-up task is done',
      'taskDownMin',
    );
  }
  return null;
}

/** The machine a task is about: the closed ticket's own, or the one its parent's snapshot names. */
function machineOf(row: Row): { snapshot: Record<string, unknown>; place: string | null } {
  const snapshot = { ...((row.machine_snapshot as Record<string, unknown> | null) ?? {}) };
  if (row.machine_id) snapshot.id = row.machine_id;
  return {
    snapshot,
    place: (snapshot.code as string | undefined) ?? (row.location as string | null),
  };
}

/** Raises the child ticket (a `WR-` work request of type "Pending task") and points it at the root breakdown. */
async function raiseTask(
  client: PoolClient,
  tx: tm.Tx,
  loaded: tm.LoadedCtx,
  task: TaskInput,
): Promise<{ id: string; ref: string; parentId: string }> {
  const parentId = (loaded.row.parent_id as string | null) ?? tx.ticketId;
  const { snapshot, place } = machineOf(loaded.row);
  const body = {
    kind: 'general',
    problem: task.text,
    location: place ?? undefined,
    workType: 'Pending task',
    reportedByRole: 'Maintenance',
  };
  const now = new Date();
  const matrix = await loadSeverityMatrix(client, tx.tenantId);
  const raised = buildRaised({
    ref: await sql.allocateRef(client, tx.tenantId, 'general'),
    body,
    loginId: tx.auth.loginId,
    reportedByPersonId: tx.actingPersonId,
    now,
    criticality: null,
    severityMatrix: matrix,
  });
  raised.ticket.figures = tm.recomputeFigures(raised.ticket, raised.events, raised.segments, {
    overrides: {},
    now,
  });
  await sql.insertTicket(
    client,
    tx.tenantId,
    raised.ticket,
    buildRaiseExtras(snapshot, body, null, matrix),
  );
  await sql.persistEvents(client, tx.tenantId, raised.ticket.id, {
    events: raised.events,
    startSeq: 0,
    idempotencyKey: tx.key,
    loginId: tx.auth.loginId,
    actingPersonId: tx.actingPersonId,
    textFor: () => task.text,
  });
  await sql.persistSegments(client, tx.tenantId, raised.ticket.id, { ...raised, endReason: null });
  await repo.linkTask(client, {
    ticketId: raised.ticket.id,
    parentId,
    reasonCode: task.reasonCode,
    expectedOn: task.expectedOn ?? null,
  });
  return { id: raised.ticket.id, ref: raised.ticket.ref, parentId };
}

/**
 * After a close is saved: a task left in it becomes a child ticket, and the root breakdown's history says so; a task
 * that is itself closed tells the root it is done (with its machine-stopped minutes). Runs in the close's own
 * transaction, so the close, the child and the lines on the parent are all there or none is. `result.ticket` has its
 * sequence number moved on when the parent is the ticket being closed.
 */
export async function afterClose(
  client: PoolClient,
  tx: tm.Tx,
  loaded: tm.LoadedCtx,
  ticket: { lastEventSeq: number; closedAt: Date | null },
): Promise<{ task?: { id: string; ref: string } }> {
  if (tx.action !== 'close') return {};
  const at = ticket.closedAt ?? new Date();
  await movePmPlan(client, tx, loaded, at);
  const line = {
    tenantId: tx.tenantId,
    loginId: tx.auth.loginId,
    actingPersonId: tx.actingPersonId,
    at,
  };
  const parentOfThis = loaded.row.parent_id as string | null;
  if (parentOfThis) {
    await repo.appendParentEvent(client, {
      ...line,
      parentId: parentOfThis,
      key: `${tx.key}#done`,
      text: (tx.body.note as string | undefined) ?? (loaded.row.problem as string),
      reasonCode: null,
      task: {
        id: tx.ticketId,
        ref: loaded.row.ref,
        stage: 'done',
        expectedOn: loaded.ticket.taskExpectedOn,
        downMin: (tx.body.taskDownMin as number | undefined) ?? null,
      },
    });
  }
  const input = tx.body.task as TaskInput | undefined;
  if (!input) return {};
  const created = await raiseTask(client, tx, loaded, input);
  const seq = await repo.appendParentEvent(client, {
    ...line,
    parentId: created.parentId,
    key: `${tx.key}#left`,
    text: input.text,
    reasonCode: input.reasonCode,
    task: {
      id: created.id,
      ref: created.ref,
      stage: 'left',
      expectedOn: input.expectedOn ?? null,
      downMin: null,
    },
  });
  if (created.parentId === tx.ticketId) ticket.lastEventSeq = seq;
  return { task: { id: created.id, ref: created.ref } };
}

/** The meter reading a PM report carries, when the plan has a meter (R6/R8). */
function meterOf(tx: tm.Tx): number | null {
  const report = tx.body.report as { pmReport?: StoredReport['pmReport'] } | undefined;
  const meter = report?.pmReport?.readings?.['meter'];
  return typeof meter === 'number' ? meter : null;
}

/**
 * A PM job's close moves its plan in the same transaction (49c, R8): the accepted plan's `last_done_on` becomes the
 * close's plant day and its reading the later of the two. A switched-off plan is accepted but not moved, and an
 * API mark-done close moves it too, so no close can make the next nightly run owe the same period again.
 */
async function movePmPlan(
  client: PoolClient,
  tx: tm.Tx,
  loaded: tm.LoadedCtx,
  at: Date,
): Promise<void> {
  if (loaded.extras.raisedChannel !== 'pm' || !tx.pmPlanId) return;
  await recordPmCompletion(client, tx.tenantId, {
    planId: tx.pmPlanId,
    doneOn: await plantDateAt(client, tx.tenantId, at),
    meter: meterOf(tx),
  });
}

/**
 * What a ticket's detail says about tasks: the Tasks tab and its rollup (judged against today in the plant's time
 * zone), and the breakdown this ticket was itself left from, if any.
 */
export async function taskParts(client: PoolClient, tenantId: string, row: Row) {
  const parentId = row.id as string;
  const today = await repo.plantToday(client, (await tenantInfo(client, tenantId)).time_zone);
  const tasks: TaskRow[] = (await repo.taskRowsOf(client, tenantId, parentId)).map((row) => {
    const status = row.status as TaskRow['status'];
    const taskExpectedOn = (row.task_expected_on as string | null) ?? null;
    return {
      id: row.id as string,
      ref: row.ref as string,
      status,
      state: taskState({ status, taskExpectedOn }, today),
      text: row.problem as string,
      taskReason: (row.task_reason as string | null) ?? null,
      taskExpectedOn,
      taskDownMin: row.task_down_min == null ? null : Number(row.task_down_min),
      startedByPersonId: (row.lead_person_id as string | null) ?? null,
      closedAt: row.closed_at
        ? new Date(row.closed_at as string | number | Date).toISOString()
        : null,
      closedByPersonId: (row.closed_by_person_id as string | null) ?? null,
    };
  });
  return {
    tasks,
    taskSummary: summariseTasks(tasks.map((task) => task.state)),
    parent: await repo.parentOf(client, tenantId, (row.parent_id as string | null) ?? null),
  };
}
