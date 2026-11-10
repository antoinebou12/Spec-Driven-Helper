import { connect, client } from '../apps/api/src/db';
import { migrate } from '../apps/api/src/migrations';

/** Applies pending data migrations. The API and worker also run this at start-up. */
await connect();
await migrate();
await client.close();
