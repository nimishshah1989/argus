import { z } from 'zod';

/**
 * Follow-up tasks (ticket 19, `v3.actions.17`). A job left unfinished at close becomes a child ticket: kind `general`,
 * `parentId` pointing at the breakdown it came from (the root, even for a task left from a task), `taskReason` a code of
 * the plant's `task_reason` list, `taskExpectedOn` a plant-local date, `machineSnapshot.id` the machine of the parent.
 * Finishing a task is the ordinary `close` of that ticket with `kind: 'done'`, plus the machine-stopped minutes.
 */
export const TASK_MINUTES_MAX = 1440;

/** What a close may leave behind. `reasonCode` is a code of the `task_reason` list; `expectedOn` is `YYYY-MM-DD`. */
export const taskInputSchema = z
  .object({
    text: z.string().trim().min(1).max(300),
    reasonCode: z.string().min(1).max(80),
    expectedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Not a date')
      .optional(),
  })
  .strict();
export type TaskInput = z.infer<typeof taskInputSchema>;

/** The machine-stopped minutes asked when a task is done: 0 to 1440, not added to the parent's downtime. */
export const taskDownMinSchema = z.number().int().min(0).max(TASK_MINUTES_MAX);

export const taskStateSchema = z.enum(['pending', 'in_progress', 'overdue', 'done']);
export type TaskState = z.infer<typeof taskStateSchema>;

/** The state a person sees on a task. A cancelled task is not listed at all. */
export function taskState(
  task: { status: string; taskExpectedOn: string | null },
  today: string,
): TaskState {
  if (task.status === 'closed') return 'done';
  if (task.taskExpectedOn !== null && task.taskExpectedOn < today) return 'overdue';
  return task.status === 'working' || task.status === 'waiting' ? 'in_progress' : 'pending';
}

/** The one box on the parent, as v3 words it: done when nothing is left, then overdue, in progress, pending. */
export const taskBoxSchema = z.enum(['none', 'done', 'overdue', 'in_progress', 'pending']);
export type TaskBox = z.infer<typeof taskBoxSchema>;

export const taskSummarySchema = z
  .object({
    pending: z.number().int(),
    inProgress: z.number().int(),
    overdue: z.number().int(),
    done: z.number().int(),
    box: taskBoxSchema,
  })
  .strict();
export type TaskSummary = z.infer<typeof taskSummarySchema>;

/** The four counts add up to the tasks listed; `box` is the headline for the parent. */
export function summariseTasks(states: readonly TaskState[]): TaskSummary {
  const count = (wanted: TaskState) => states.filter((state) => state === wanted).length;
  const summary = {
    pending: count('pending'),
    inProgress: count('in_progress'),
    overdue: count('overdue'),
    done: count('done'),
  };
  const unfinished = states.length - summary.done;
  let box: TaskBox = 'pending';
  if (states.length === 0) box = 'none';
  else if (unfinished === 0) box = 'done';
  else if (summary.overdue > 0) box = 'overdue';
  else if (summary.inProgress === unfinished) box = 'in_progress';
  return { ...summary, box };
}

/** A follow-up task as the parent's Tasks tab lists it. */
export const taskRowSchema = z
  .object({
    id: z.string(),
    ref: z.string(),
    status: z.enum(['open', 'working', 'waiting', 'closed']),
    state: taskStateSchema,
    text: z.string(),
    taskReason: z.string().nullable(),
    taskExpectedOn: z.string().nullable(),
    taskDownMin: z.number().nullable(),
    startedByPersonId: z.string().nullable(),
    closedAt: z.string().datetime({ offset: true }).nullable(),
    closedByPersonId: z.string().nullable(),
  })
  .strict();
export type TaskRow = z.infer<typeof taskRowSchema>;

/** The `task` part of a parent's history line: a task was left, or a task was done. */
export const taskEventSchema = z
  .object({
    id: z.string(),
    ref: z.string(),
    stage: z.enum(['left', 'done']),
    expectedOn: z.string().nullable(),
    downMin: z.number().nullable(),
  })
  .strict();
export type TaskEvent = z.infer<typeof taskEventSchema>;

/** What a ticket points back to: the shape of `parent` on a task's detail reply. */
export const taskParentSchema = z.object({ id: z.string(), ref: z.string() }).strict();

/**
 * Pending tasks on a machine, from the open tickets the phone already holds (`/state`): the warning shown before a
 * report is raised on a machine that has one (`v3.reporting.05`). Works offline, nothing to ask the server.
 */
export function pendingTasksOn<
  T extends {
    parentId: string | null;
    status: string;
    machineSnapshot: { id?: string | null } | null;
  },
>(open: readonly T[], machineId: string): T[] {
  return open.filter(
    (ticket) =>
      ticket.parentId !== null &&
      ticket.status !== 'closed' &&
      ticket.status !== 'cancelled' &&
      ticket.machineSnapshot?.id === machineId,
  );
}
