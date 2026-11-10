/**
 * The worker's polling loop: run one job at a time, wait briefly when the queue is empty, back off
 * longer after a failure, and finish the current job before stopping. Time and stopping are
 * injected so the loop is testable; `worker.ts` wires it to real timers and process signals.
 */
export type WorkerLoopOptions = {
  runOnce: () => Promise<boolean>;
  shouldStop: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  onError?: (error: unknown) => void;
  idleMs?: number;
  errorMs?: number;
};
export type WorkerLoopStats = { ran: number; idle: number; failed: number };

export async function workerLoop({ runOnce, shouldStop, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onError = () => {}, idleMs = 1000, errorMs = 2000 }: WorkerLoopOptions): Promise<WorkerLoopStats> {
  const stats: WorkerLoopStats = { ran: 0, idle: 0, failed: 0 };
  while (!shouldStop()) {
    try {
      if (await runOnce()) stats.ran++;
      else {
        stats.idle++;
        await sleep(idleMs);
      }
    } catch (error) {
      stats.failed++;
      onError(error);
      await sleep(errorMs);
    }
  }
  return stats;
}

/** Stops the loop on SIGINT/SIGTERM; the job in progress completes first. */
export function stopOnSignals(target: Pick<NodeJS.Process, 'on'> = process, signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']) {
  let stopping = false;
  for (const signal of signals)
    target.on(signal, () => {
      stopping = true;
    });
  return () => stopping;
}
