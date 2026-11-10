import 'dotenv/config';
import { PostgresStore, PostgresAssets } from './postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required (PostgreSQL 17 with pgvector).');
export const postgres = new PostgresStore(process.env.DATABASE_URL, process.env.DATABASE_NAMESPACE ?? 'sdd_studio');
export const client = postgres;
export const db = postgres;
export const assets = new PostgresAssets(postgres);
/** Asset identifier for queries (24 hex characters); null when malformed. */
export const assetKey = (id: string) => (/^[a-f0-9]{24}$/.test(id) ? id : null);
export async function connect() {
  await client.connect();
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('invites').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('revisions').createIndex({ projectId: 1, revision: 1 }, { unique: true }),
    db.collection('jobs').createIndex({ status: 1, leaseUntil: 1 }),
    db.collection('audit').createIndex({ at: 1 }),
  ]);
}
