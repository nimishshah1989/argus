/**
 * The job alarm (MILESTONES 78a). The server's log goes to CloudWatch, which already counts every line at level 50
 * or above; `infra/terraform/alarms.tf` adds a one-line alarm on the `alarm` field these lines carry. A line holds a
 * queue name, a job id, a plant id and a short error message, never a payload.
 */

export type JobAlarm = 'job-failed' | 'timer-late';

const MAX_ERROR = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One alarm line on stdout, as JSON at pino's error level (50). */
export function alarmLine(alarm: JobAlarm, fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ level: 50, time: Date.now(), alarm, ...fields })}\n`);
}

interface Seen {
  id?: unknown;
  data?: unknown;
}

function whose(job: Seen | undefined): string | undefined {
  const tenant = (job?.data as { tenantId?: unknown } | null | undefined)?.tenantId;
  return typeof tenant === 'string' && UUID.test(tenant) ? tenant : undefined;
}

/**
 * Wraps a pg-boss handler so a failure writes one alarm line, then still fails (pg-boss retries it or marks it
 * failed). Every `boss.work` handler goes through this; a test counts the ones that do not.
 */
export function logFailures<J extends Seen, R>(
  queue: string,
  handler: (jobs: J[]) => Promise<R>,
): (jobs: J[]) => Promise<R> {
  return async (jobs) => {
    try {
      return await handler(jobs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alarmLine('job-failed', {
        job: queue,
        jobId: jobs[0]?.id,
        tenantId: whose(jobs[0]),
        error: message.slice(0, MAX_ERROR),
      });
      throw error;
    }
  };
}
