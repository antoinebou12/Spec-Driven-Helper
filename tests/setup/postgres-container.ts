import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Backend tests need PostgreSQL with pgvector. When DATABASE_URL is set (CI service, your own
 * database) it is used as is; otherwise a throwaway container is started with Testcontainers and
 * removed after the run. Set TESTCONTAINERS=0 to require DATABASE_URL instead.
 */
let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  if (process.env.DATABASE_URL || process.env.TESTCONTAINERS === '0') return;
  try {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg17').withDatabase('sdd_test').withUsername('sdd').withPassword('sdd-test-only').start();
  } catch (error) {
    throw new Error(
      `The backend tests need PostgreSQL with pgvector, and Docker is not reachable to start one (${(error as Error).message}). ` +
        'Start Docker Desktop, or set DATABASE_URL to an existing database, for example the Compose stack: ' +
        'postgresql://sdd:sdd-local-development@127.0.0.1:5433/sdd_studio',
    );
  }
  // Workers start after global setup and inherit this environment.
  process.env.DATABASE_URL = container.getConnectionUri();
  console.log(`Testcontainers: PostgreSQL with pgvector on port ${container.getPort()}`);
}

export async function teardown() {
  await container?.stop();
}
