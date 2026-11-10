import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { stopOnSignals, workerLoop } from '../apps/api/src/worker-loop';

describe('worker loop', () => {
  it('runs jobs back to back, waits when idle, backs off after failures, then stops', async () => {
    const script = [true, true, false, 'boom', true, false];
    let step = 0;
    const sleeps: number[] = [];
    const errors: unknown[] = [];
    const stats = await workerLoop({
      runOnce: async () => {
        const next = script[step++];
        if (next === 'boom') throw new Error('database unavailable');
        return next as boolean;
      },
      shouldStop: () => step >= script.length,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      onError: (e) => errors.push(e),
      idleMs: 10,
      errorMs: 50,
    });
    expect(stats).toEqual({ ran: 3, idle: 2, failed: 1 });
    expect(sleeps).toEqual([10, 50, 10]);
    expect((errors[0] as Error).message).toBe('database unavailable');
  });

  it('does not start a job once stopping was requested', async () => {
    const runOnce = vi.fn(async () => true);
    expect(await workerLoop({ runOnce, shouldStop: () => true })).toEqual({ ran: 0, idle: 0, failed: 0 });
    expect(runOnce).not.toHaveBeenCalled();
  });

  it('finishes the job in progress when a signal arrives', async () => {
    const proc = new EventEmitter();
    const shouldStop = stopOnSignals(proc as unknown as NodeJS.Process);
    let finished = 0;
    const stats = await workerLoop({
      runOnce: async () => {
        proc.emit('SIGTERM');
        await Promise.resolve();
        finished++;
        return true;
      },
      shouldStop,
    });
    expect(finished).toBe(1);
    expect(stats.ran).toBe(1);
  });

  it('uses real timers by default', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const loop = workerLoop({ runOnce: async () => (calls++, false), shouldStop: () => calls >= 2, idleMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await loop).toEqual({ ran: 0, idle: 2, failed: 0 });
    vi.useRealTimers();
  });
});
