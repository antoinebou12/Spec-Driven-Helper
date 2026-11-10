import 'dotenv/config';

/** Deletes the throwaway namespace used by the browser journeys. */
export default async function teardown() {
  const name = process.env.E2E_DATABASE;
  if (!name?.startsWith('sdd_test_e2e_')) return;
  process.env.DATABASE_NAMESPACE = name;
  process.env.DATABASE_NAMESPACE = name;
  const { client, db } = await import('../../apps/api/src/db');
  await client.connect();
  try {
    if (db.databaseName === name) await db.dropDatabase();
  } finally {
    await client.close();
  }
}
