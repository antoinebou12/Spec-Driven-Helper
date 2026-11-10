import './telemetry';
import { connect, client } from './db';
import { migrate } from './migrations';
import { runOnce } from './jobs';
import { log } from './observability';
import { stopOnSignals, workerLoop } from './worker-loop';

await connect();
await migrate();
log.info('worker started');
const stats = await workerLoop({
  runOnce,
  shouldStop: stopOnSignals(),
  onError: (error) => log.error({ err: (error as Error).message }, 'worker iteration failed'),
});
log.info(stats, 'worker stopped');
await client.close();
