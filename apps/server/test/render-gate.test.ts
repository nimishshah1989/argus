import { describe, expect, it } from 'vitest';
import { createRenderGate, RenderBusyError } from '../src/modules/reports/render-gate.js';

/** A job that runs until the test lets it finish; `started` lists the jobs that have begun. */
function jobs() {
  const started: string[] = [];
  const release = new Map<string, () => void>();
  const job = (name: string) => async () => {
    started.push(name);
    await new Promise<void>((resolve) => release.set(name, resolve));
    return name;
  };
  return { started, job, finish: (name: string) => release.get(name)?.() };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('render gate', () => {
  it('runs one job at a time and the waiting ones in order', async () => {
    const gate = createRenderGate(1, 3);
    const { started, job, finish } = jobs();
    const done = ['a', 'b', 'c'].map((name) => gate(job(name)));
    await tick();
    expect(started).toEqual(['a']);
    finish('a');
    await tick();
    expect(started).toEqual(['a', 'b']);
    finish('b');
    await tick();
    finish('c');
    expect(await Promise.all(done)).toEqual(['a', 'b', 'c']);
    expect(started).toEqual(['a', 'b', 'c']);
  });

  it('refuses a caller beyond the queue, and accepts again once room frees up', async () => {
    const gate = createRenderGate(1, 2);
    const { job, finish } = jobs();
    const accepted = ['a', 'b', 'c'].map((name) => gate(job(name)));
    await tick();
    await expect(gate(job('d'))).rejects.toBeInstanceOf(RenderBusyError);
    finish('a');
    await tick();
    const later = gate(job('e')); // a left, so one place is free again
    await tick();
    for (const name of ['b', 'c', 'e']) {
      finish(name);
      await tick();
    }
    expect(await Promise.all([...accepted, later])).toEqual(['a', 'b', 'c', 'e']);
  });

  it('a job that fails still gives its place to the next one', async () => {
    const gate = createRenderGate(1, 1);
    const failing = gate(async () => {
      throw new Error('chromium crashed');
    });
    const next = gate(async () => 'next');
    await expect(failing).rejects.toThrow('chromium crashed');
    expect(await next).toBe('next');
    expect(await gate(async () => 'after')).toBe('after');
  });
});
