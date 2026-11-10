import type { FastifyInstance } from 'fastify';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir, lstat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { z } from 'zod';
import { db } from './db';
import { encrypt, decrypt, audit } from './security';
import { HttpError, projectFor, createProposal, previewChanges } from './projects';
import { implementationFiles } from './exports';
import { scrubSecrets } from './observability';
import type { Auth } from './auth-types';
import { threeWayMerge, validateSpec } from '../../../packages/shared/src/domain';
import { impliedAnswerChanges } from '../../../packages/shared/src/markdown';
import { safeFiles } from '../../../packages/shared/src/import-rules';
import { modules } from '../../../packages/shared/src/templates';
import { importSchema, type Conflict, type Spec, type SpecPatch, type Technology } from '../../../packages/shared/src/schema';

const run = promisify(execFile);
const branchPattern = /^(?!.*\.\.)(?!\/)[\w./-]{1,200}(?<!\/)$/;

export type GitConfig = {
  projectId: string;
  provider: 'github' | 'git';
  repository?: string;
  remoteUrl?: string;
  username?: string;
  branch: string;
  secret?: string;
  lastPublished?: Record<string, unknown>;
};

// ---- Archive safety -------------------------------------------------------------------------

export const snapshotLimits = { files: 2000, fileBytes: 200_000, totalBytes: 8_000_000, archiveBytes: 25_000_000 };
// `.terraform` and `.terragrunt-cache` hold downloaded modules and providers, and can hold state.
const skippedDirs = /(^|\/)(\.git|node_modules|dist|build|\.venv|vendor|\.terraform|\.terragrunt-cache)(\/|$)/;
/** Files that look like secrets are never read, whichever feature asked for the snapshot. */
const skipped = (path: string) => skippedDirs.test(path) || !Object.keys(safeFiles({ [path]: '' })).length;
/** Rejects absolute paths, traversal, drive letters and backslashes before anything is read. */
export function safeRelativePath(path: string) {
  if (!path || path.includes('\0') || path.includes('\\') || /^[a-zA-Z]:/.test(path) || path.startsWith('/')) return null;
  const parts = path.split('/').filter((p) => p && p !== '.');
  if (parts.some((p) => p === '..')) return null;
  return parts.join('/');
}
const isText = (data: Buffer) => !data.subarray(0, 8000).includes(0);

/** Extracts text files from a repository zip (GitHub zipball layout) into memory, safely. */
export async function safeArchiveFiles(archive: Buffer, prefix = 'repository/') {
  if (archive.length > snapshotLimits.archiveBytes) throw new HttpError(413, 'Repository archive is too large');
  const zip = await JSZip.loadAsync(archive);
  // GitHub zipballs wrap everything in one "<repo>-<sha>/" folder; strip it only when present.
  const tops = new Set(Object.values(zip.files).map((e) => e.name.split('/')[0]));
  const strip = tops.size === 1 && Object.values(zip.files).some((e) => e.name.includes('/'));
  const files: Record<string, string> = {};
  let total = 0,
    count = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    // Symbolic links carry the S_IFLNK mode bits; never follow them.
    const mode = typeof entry.unixPermissions === 'number' ? entry.unixPermissions : 0;
    if ((mode & 0o170000) === 0o120000) continue;
    // JSZip rewrites "../" in names; judge the original name so traversal attempts are refused.
    const original = (entry as any).unsafeOriginalName ?? entry.name;
    const clean = safeRelativePath(original);
    if (!clean || clean !== safeRelativePath(entry.name))
      throw new HttpError(400, `Unsafe path in archive: ${String(original).slice(0, 200)}`);
    const path = strip ? clean.split('/').slice(1).join('/') : clean;
    if (!path || skipped(path)) continue;
    const data = await entry.async('nodebuffer');
    if (data.length > snapshotLimits.fileBytes || !isText(data)) continue;
    if (++count > snapshotLimits.files || (total += data.length) > snapshotLimits.totalBytes) break;
    files[prefix + path] = data.toString('utf8');
  }
  return files;
}

export async function readTree(root: string, prefix = 'repository/') {
  const files: Record<string, string> = {};
  let total = 0,
    count = 0;
  const walk = async (dir: string) => {
    for (const name of await readdir(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join('/');
      const info = await lstat(full);
      if (info.isDirectory() ? skippedDirs.test(rel) : skipped(rel)) continue;
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) await walk(full);
      else if (info.isFile() && info.size <= snapshotLimits.fileBytes) {
        const data = await readFile(full);
        if (!isText(data)) continue;
        if (++count > snapshotLimits.files || (total += data.length) > snapshotLimits.totalBytes) return;
        files[prefix + rel] = data.toString('utf8');
      }
    }
  };
  await walk(root);
  return files;
}

// ---- Transports -----------------------------------------------------------------------------

async function github(config: GitConfig, path: string, method = 'GET', body?: unknown, raw = false) {
  const response = await fetch(`https://api.github.com/repos/${config.repository}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${decrypt(config.secret!)}`,
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new HttpError(502, `GitHub operation failed (${response.status})`);
  return raw ? Buffer.from(await response.arrayBuffer()) : ((await response.json()) as any);
}

function allowedRemote(url: string) {
  if (url.startsWith('https://')) return true;
  return url.startsWith('file://') && process.env.SDD_ALLOW_FILE_REMOTES === 'true';
}
/** Runs git with credentials supplied through environment config, never on the command line. */
async function git(config: GitConfig, args: string[], cwd?: string) {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? process.env.USERPROFILE ?? tmpdir(),
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'SDD Studio',
    GIT_AUTHOR_EMAIL: 'sdd-studio@localhost',
    GIT_COMMITTER_NAME: 'SDD Studio',
    GIT_COMMITTER_EMAIL: 'sdd-studio@localhost',
  };
  if (process.env.SYSTEMROOT) env.SYSTEMROOT = process.env.SYSTEMROOT;
  if (config.secret) {
    const basic = Buffer.from(`${config.username || 'oauth2'}:${decrypt(config.secret)}`).toString('base64');
    Object.assign(env, {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.extraHeader',
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
    });
  }
  try {
    const { stdout } = await run('git', args, { cwd, env, timeout: 120_000, maxBuffer: 20_000_000 });
    return stdout;
  } catch (error) {
    throw new HttpError(502, `Git operation failed: ${scrubSecrets(String((error as any).stderr || (error as Error).message)).slice(0, 500)}`);
  }
}
export async function withClone<T>(config: GitConfig, fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), 'sdd-git-'));
  try {
    const remote = config.remoteUrl!.startsWith('file://') && process.env.SDD_ALLOW_FILE_REMOTES === 'true' ? fileURLToPath(config.remoteUrl!) : config.remoteUrl!;
    await git(config, ['clone', '--depth', '1', '--single-branch', '--branch', config.branch, '--', remote, dir]);
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Reads the published specification files from the configured branch. */
async function readRemote(config: GitConfig): Promise<Record<string, string>> {
  const wanted = (path: string) =>
    path === '.plan/specification.json' || /^\.plan\/spec\/\d\d-[\w-]+\.md$/.test(path) || /^\.plan\/diagrams\/[\w-]+\.mmd$/.test(path);
  if (config.provider === 'github') {
    const ref = encodeURIComponent(config.branch);
    const tree = await github(config, `/git/trees/${ref}?recursive=1`);
    if (!tree) throw new HttpError(404, 'Branch not found');
    const files: Record<string, string> = {};
    for (const entry of (tree.tree ?? []).filter((e: any) => e.type === 'blob' && wanted(e.path))) {
      const data = (await github(config, `/contents/${entry.path}?ref=${ref}`, 'GET', undefined, true)) as Buffer;
      files[entry.path] = data.toString('utf8');
    }
    return files;
  }
  return withClone(config, async (dir) => {
    const all = await readTree(dir, '');
    return Object.fromEntries(Object.entries(all).filter(([path]) => wanted(path)));
  });
}

/** Repository material for isolated Claude Agent runs (read-only snapshot). */
export async function repositorySnapshot(projectId: string, prefix = 'repository/'): Promise<Record<string, string>> {
  const config = (await db.collection('git').findOne({ projectId })) as unknown as GitConfig | null;
  if (!config) return {};
  if (config.provider === 'github') {
    const archive = (await github(config, `/zipball/${encodeURIComponent(config.branch)}`, 'GET', undefined, true)) as Buffer | null;
    return archive ? safeArchiveFiles(archive, prefix) : {};
  }
  return withClone(config, (dir) => readTree(dir, prefix));
}
export { allowedRemote };

// ---- Import (three-way) ---------------------------------------------------------------------

/**
 * Builds the remote specification from published files. The JSON bundle records the revision it
 * was exported from; that revision is the merge base, so unmerged pull requests never look like
 * remote reverts. Markdown edits inside answer blocks become remote answer changes.
 */
export async function remoteChanges(projectId: string, current: Spec, files: Record<string, string>) {
  const json = files['.plan/specification.json'];
  if (!json) throw new HttpError(404, 'No .plan/specification.json on this branch');
  const bundle = importSchema.parse(JSON.parse(json));
  const remote: Spec = structuredClone(bundle.spec);
  if (remote.id !== projectId) throw new HttpError(409, 'Remote specification belongs to a different project');
  for (const [i, section] of remote.sections.entries()) {
    const markdown = files[`.plan/spec/${String(i + 1).padStart(2, '0')}-${section.id}.md`];
    if (markdown !== undefined) section.markdown = markdown;
    const diagram = files[`.plan/diagrams/${section.id}.mmd`];
    if (diagram !== undefined) section.diagram = diagram;
    const module = modules.find((m) => m.id === section.id)!;
    Object.assign(section.answers, impliedAnswerChanges(module, section.answers, section.markdown, remote.language, remote));
  }
  validateSpec(remote);
  const base =
    ((await db.collection('revisions').findOne({ projectId, revision: bundle.spec.revision }))?.spec as Spec | undefined) ??
    bundle.spec;
  return { remote, base, technologies: bundle.technologies as Technology[], ...threeWayMerge(base, current, remote) };
}

const hasChanges = (patch: SpecPatch) => Object.values(patch).some((v) => (Array.isArray(v) ? v.length : v !== undefined));
function setAtPath(patch: SpecPatch, path: string, value: unknown) {
  const parts = path.split('.');
  if (parts[0] === 'sections') {
    patch.sections ??= [];
    let s = patch.sections.find((x) => x.id === parts[1]);
    if (!s) patch.sections.push((s = { id: parts[1] }));
    if (parts[2] === 'answers') {
      if (value !== undefined) (s.answers ??= {})[parts.slice(3).join('.')] = value as any;
    } else (s as any)[parts[2]] = value;
  } else if (parts[0] === 'items') {
    const id = parts.slice(1).join('.');
    patch.items = (patch.items ?? []).filter((i) => i.id !== id);
    if (value === undefined) (patch.removeItems ??= []).push(id);
    else patch.items.push(value as any);
  } else if (parts[0] === 'links') {
    const id = parts.slice(1).join('.');
    patch.links = (patch.links ?? []).filter((l) => l.id !== id);
    if (value === undefined) (patch.removeLinks ??= []).push(id);
    else patch.links.push(value as any);
  } else (patch as any)[path] = value;
}

// ---- Routes ---------------------------------------------------------------------------------

const configSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('github'),
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    branch: z.string().regex(branchPattern).default('main'),
    token: z.string().min(1).max(500),
  }),
  z.object({
    provider: z.literal('git'),
    remoteUrl: z.string().max(500).refine(allowedRemote, 'Use an https:// remote URL'),
    branch: z.string().regex(branchPattern).default('main'),
    username: z.string().max(200).default(''),
    token: z.string().max(500).default(''),
  }),
]);

export async function registerGitRoutes(app: FastifyInstance, auth: Auth) {
  const configFor = async (projectId: string) => {
    const c = (await db.collection('git').findOne({ projectId })) as unknown as GitConfig | null;
    if (!c) throw new HttpError(400, 'Configure a Git remote first');
    return c;
  };
  app.get('/api/v1/projects/:id/git', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    const c = (await db.collection('git').findOne({ projectId: req.params.id })) as unknown as GitConfig | null;
    return c
      ? {
          provider: c.provider ?? 'github',
          repository: c.repository,
          remoteUrl: c.remoteUrl ? scrubSecrets(c.remoteUrl) : undefined,
          branch: c.branch,
          lastPublished: c.lastPublished,
        }
      : null;
  });
  app.put('/api/v1/projects/:id/git', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id, 'admin');
    const b = configSchema.parse({ provider: 'github', ...req.body });
    if (b.provider === 'git' && /:\/\/[^/]*@/.test(b.remoteUrl))
      throw new HttpError(400, 'Put credentials in the token field, not in the URL');
    await db.collection('git').replaceOne(
      { projectId: req.params.id },
      {
        projectId: req.params.id,
        provider: b.provider,
        branch: b.branch,
        ...(b.provider === 'github' ? { repository: b.repository } : { remoteUrl: b.remoteUrl, username: b.username }),
        ...(b.token ? { secret: encrypt(b.token) } : {}),
      },
      { upsert: true },
    );
    await audit(req.user.id, 'git.configured', req.params.id, { provider: b.provider });
    return { ok: true };
  });
  /** Publishing is always an explicit action and always creates a new branch (never forced). */
  app.post('/api/v1/projects/:id/git/publish', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = z
      .object({
        source: z.enum(['baseline', 'current']).default('baseline'),
        expectedRevision: z.number().int(),
        confirm: z.literal(true),
      })
      .parse(req.body);
    if (p.spec.revision !== b.expectedRevision) throw new HttpError(409, 'The specification changed; review it before publishing');
    let spec = p.spec,
      label = `r${spec.revision}-draft`;
    if (b.source === 'baseline') {
      const baseline = await db.collection('baselines').findOne({ projectId: p.id }, { sort: { approvedAt: -1 } });
      if (!baseline) throw new HttpError(409, 'Approve a baseline first, or publish the current draft explicitly');
      spec = baseline.spec as Spec;
      label = `r${spec.revision}`;
    }
    const config = await configFor(p.id);
    const technologies = (await db
      .collection('technologies')
      .find({ id: { $in: spec.technologyIds } }, { projection: { _id: 0 } })
      .toArray()) as unknown as Technology[];
    const files = implementationFiles(spec, technologies);
    const branch = `sdd/spec-${label}-${Date.now()}`;
    const message = `docs(spec): ${spec.name} ${b.source === 'baseline' ? 'baseline' : 'draft'} revision ${spec.revision}`;
    let result: Record<string, unknown>;
    if (config.provider === 'github') {
      const base = await github(config, `/git/ref/heads/${encodeURIComponent(config.branch)}`);
      if (!base) throw new HttpError(404, 'Base branch not found');
      const commit = await github(config, `/git/commits/${base.object.sha}`);
      const tree = await github(config, '/git/trees', 'POST', {
        base_tree: commit.tree.sha,
        tree: Object.entries(files).map(([path, content]) => ({ path, content, mode: '100644', type: 'blob' })),
      });
      const next = await github(config, '/git/commits', 'POST', { message, tree: tree.sha, parents: [base.object.sha] });
      await github(config, '/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: next.sha });
      const pr = await github(config, '/pulls', 'POST', {
        title: `Specification ${label}: ${spec.name}`,
        head: branch,
        base: config.branch,
        body: `Exported from SDD Studio (${b.source === 'baseline' ? 'approved baseline' : 'unapproved draft'}, revision ${spec.revision}).\n\nReview the specification changes before merging. Edits to \`.plan/spec/\` can be imported back into SDD Studio for review.`,
      });
      result = { branch, commit: next.sha, url: pr.html_url, revision: spec.revision, source: b.source };
    } else {
      result = await withClone(config, async (dir) => {
        for (const [path, content] of Object.entries(files)) {
          const target = join(dir, ...path.split('/'));
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, content);
        }
        await git(config, ['checkout', '-b', branch], dir);
        await git(config, ['add', '--all', '--', '.plan', 'AGENTS.md', 'CLAUDE.md', '.github', '.claude'], dir);
        await git(config, ['commit', '-m', message], dir);
        const sha = (await git(config, ['rev-parse', 'HEAD'], dir)).trim();
        await git(config, ['push', 'origin', `HEAD:refs/heads/${branch}`], dir);
        return { branch, commit: sha, revision: spec.revision, source: b.source };
      });
    }
    const lastPublished = { ...result, at: new Date().toISOString(), by: req.user.id };
    await db.collection('git').updateOne({ projectId: p.id }, { $set: { lastPublished } });
    await audit(req.user.id, 'git.published', p.id, lastPublished);
    return lastPublished;
  });
  app.post('/api/v1/projects/:id/git/import', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const config = await configFor(p.id);
    const b = z.object({ branch: z.string().regex(branchPattern).optional() }).parse(req.body ?? {});
    const source = { ...config, branch: b.branch ?? config.branch };
    const merge = await remoteChanges(p.id, p.spec, await readRemote(source));
    if (!hasChanges(merge.patch) && !merge.conflicts.length) return { unchanged: true };
    const proposal = await createProposal({
      spec: p.spec,
      projectId: p.id,
      createdBy: req.user.id,
      origin: 'git',
      title: `Import changes from ${source.branch}`,
      patch: merge.patch,
      assumptions: [
        `Compared against revision ${merge.base.revision}, the revision recorded in the remote bundle.`,
        merge.conflicts.length
          ? `${merge.conflicts.length} field(s) changed both here and in Git. Both versions are kept until you choose.`
          : 'No overlapping edits were found.',
      ],
      extra: { conflicts: merge.conflicts, remoteSpec: merge.remote, branch: source.branch },
    });
    await audit(req.user.id, 'git.imported', p.id, { proposalId: proposal.id, conflicts: merge.conflicts.length });
    return proposal;
  });
  /** Explicit per-field resolution. Both versions stay recorded on the proposal. */
  app.post('/api/v1/projects/:id/proposals/:proposalId/resolve', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = z.object({ choices: z.record(z.string(), z.enum(['local', 'remote'])) }).parse(req.body);
    const proposal = await db.collection('proposals').findOne({
      id: req.params.proposalId,
      projectId: p.id,
      status: 'pending',
      origin: 'git',
    });
    if (!proposal) throw new HttpError(404, 'Git proposal not found');
    const conflicts = proposal.conflicts as Conflict[];
    if (conflicts.some((c) => !b.choices[c.path])) throw new HttpError(400, 'Choose a version for every conflict');
    const patch: SpecPatch = structuredClone(proposal.patch);
    for (const c of conflicts) if (b.choices[c.path] === 'remote') setAtPath(patch, c.path, c.yours);
    const changes = previewChanges(p.spec, patch);
    await db.collection('proposals').updateOne(
      { id: proposal.id },
      {
        $set: {
          patch,
          conflicts: [],
          resolvedConflicts: conflicts.map((c) => ({ ...c, choice: b.choices[c.path] })),
          baseRevision: p.spec.revision,
          changes,
        },
      },
    );
    await audit(req.user.id, 'git.conflicts-resolved', p.id, { proposalId: proposal.id });
    return { ok: true };
  });
}
