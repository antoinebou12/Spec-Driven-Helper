import type { Conflict } from '../../../packages/shared/src/schema';

export type ConflictInfo = {
  baseRevision: number;
  currentRevision: number;
  overlapping: boolean;
  conflicts: Conflict[];
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Record<string, any> = {},
  ) {
    super(message);
  }
  get conflict(): ConflictInfo | undefined {
    return this.details.conflict;
  }
}

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    const { error, ...details } = data as Record<string, any>;
    throw new ApiError(error ?? `Request failed (${response.status})`, response.status, details);
  }
  return data as T;
}
