import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { db } from './db';
import { scrubSecrets } from './observability';
import type { Role } from '../../../packages/shared/src/schema';
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash?: string;
  disabled?: boolean;
};
export const token = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function key() {
  const value = process.env.ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value))
    throw new Error('Set ENCRYPTION_KEY to 32 random bytes encoded as 64 hexadecimal characters');
  return Buffer.from(value, 'hex');
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const result = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${result.toString('hex')}`;
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split('.');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'hex')), cipher.final()]).toString('utf8');
}
export async function bootstrap() {
  const email = process.env.BOOTSTRAP_EMAIL?.toLowerCase(),
    password = process.env.BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error('Bootstrap password must have at least 12 characters');
  await db.collection('users').updateOne(
    { email },
    {
      $setOnInsert: {
        id: crypto.randomUUID(),
        email,
        name: 'Workspace owner',
        role: 'Owner',
        passwordHash: await hash(password, 12),
      },
    },
    { upsert: true },
  );
}
export async function authenticate(email: string, password: string) {
  const user = await db
    .collection<User>('users')
    .findOne({ email: email.toLowerCase(), disabled: { $ne: true } });
  if (!user?.passwordHash || !(await compare(password, user.passwordHash))) return null;
  return user;
}
export async function session(userId: string) {
  const value = token();
  await db
    .collection('sessions')
    .insertOne({ token: digest(value), userId, expiresAt: new Date(Date.now() + 86400000 * 7) });
  return value;
}
export async function getUser(value?: string) {
  if (!value) return null;
  const s = await db
    .collection('sessions')
    .findOne({ token: digest(value), expiresAt: { $gt: new Date() } });
  return s ? db.collection<User>('users').findOne({ id: s.userId, disabled: { $ne: true } }) : null;
}
export async function audit(userId: string, action: string, projectId?: string, details?: unknown) {
  await db.collection('audit').insertOne({
    id: crypto.randomUUID(),
    userId,
    action,
    projectId,
    details: details === undefined ? undefined : JSON.parse(scrubSecrets(JSON.stringify(details))),
    at: new Date().toISOString(),
  });
}
