import './telemetry';
import { connect, client } from './db';
import { bootstrap } from './security';
import { migrate } from './migrations';
import { buildApp } from './app';

await connect();
await migrate();
await bootstrap();
const app = await buildApp();
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3001) });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await app.close();
    await client.close();
    process.exit(0);
  });
