import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setupApp, type Harness } from './helpers';

let h: Harness, root: string, remote: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();

beforeAll(async () => {
  process.env.SDD_ALLOW_FILE_REMOTES = 'true';
  h = await setupApp('git');
  root = mkdtempSync(join(tmpdir(), 'sdd-git-test-'));
  const bare = join(root, 'remote.git');
  git(root, 'init', '--bare', '-b', 'main', bare);
  const seed = join(root, 'seed');
  git(root, 'clone', bare, seed);
  writeFileSync(join(seed, 'README.md'), '# Product\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-m', 'initial');
  git(seed, 'push', 'origin', 'HEAD:main');
  remote = pathToFileURL(bare).href;
});
afterAll(async () => {
  await h?.teardown();
  rmSync(root, { recursive: true, force: true });
});

describe('Git synchronization', () => {
  it('publishes a new branch, imports remote edits for review and preserves both sides of conflicts', async () => {
    const p = await h.createProject({ name: 'Git project', sample: true });
    expect((await h.request('PUT', `/projects/${p.id}/git`, { provider: 'git', remoteUrl: remote, branch: 'main' })).statusCode).toBe(200);
    let spec = (await h.project(p.id)).spec;
    const noBaseline = await h.request('POST', `/projects/${p.id}/git/publish`, { expectedRevision: spec.revision, confirm: true });
    expect(noBaseline.statusCode).toBe(409);
    expect(
      (await h.request('POST', `/projects/${p.id}/git/publish`, { source: 'current', expectedRevision: spec.revision })).statusCode,
    ).toBe(400); // explicit confirmation is required
    const published = await h.request('POST', `/projects/${p.id}/git/publish`, {
      source: 'current',
      expectedRevision: spec.revision,
      confirm: true,
    });
    expect(published.statusCode, published.body).toBe(200);
    const { branch, commit } = published.json();
    expect(git(root, 'ls-remote', join(root, 'remote.git'), `refs/heads/${branch}`)).toContain(commit);

    // A teammate merges the pull request and edits documents in Git.
    const work = join(root, 'work');
    git(root, 'clone', join(root, 'remote.git'), work);
    git(work, 'merge', '--ff-only', `origin/${branch}`);
    for (const file of ['.plan/specification.json', '.plan/manifest.json', 'AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', '.claude/skills/maintain-spec/SKILL.md'])
      expect(readFileSync(join(work, file), 'utf8').length, file).toBeGreaterThan(0);
    const discoveryPath = join(work, '.plan/spec/01-discovery.md');
    const original = spec.sections[0].answers['discovery.1'].value;
    writeFileSync(discoveryPath, readFileSync(discoveryPath, 'utf8').replace(original, 'Remote wording of the problem.'));
    const scopePath = join(work, '.plan/spec/02-scope.md');
    writeFileSync(scopePath, readFileSync(scopePath, 'utf8') + '\nRemote note about scope.\n');
    git(work, 'commit', '-am', 'Edit specification in Git');
    git(work, 'push', 'origin', 'HEAD:main');

    // Meanwhile the same answer changes in SDD Studio.
    spec = (
      await h.patch(p.id, spec.revision, {
        sections: [{ id: 'discovery', answers: { 'discovery.1': { value: 'Local wording of the problem.', state: 'answered', reason: '' } } }],
      })
    ).json();

    const imported = await h.request('POST', `/projects/${p.id}/git/import`, {});
    expect(imported.statusCode, imported.body).toBe(200);
    const proposal = imported.json();
    const answerConflict = proposal.conflicts.find((c: any) => c.path === 'sections.discovery.answers.discovery.1');
    expect(answerConflict.current.value).toBe('Local wording of the problem.');
    expect(answerConflict.yours.value).toBe('Remote wording of the problem.');
    expect(proposal.patch.sections.find((s: any) => s.id === 'scope').markdown).toContain('Remote note about scope.');
    expect((await h.project(p.id)).readiness.blockers.join()).toContain('unresolved conflicts');

    const accept = () => h.request('POST', `/projects/${p.id}/proposals/${proposal.id}/accept`);
    expect((await accept()).statusCode).toBe(409);
    const choices = Object.fromEntries(proposal.conflicts.map((c: any) => [c.path, 'remote']));
    expect((await h.request('POST', `/projects/${p.id}/proposals/${proposal.id}/resolve`, { choices: {} })).statusCode).toBe(400);
    expect((await h.request('POST', `/projects/${p.id}/proposals/${proposal.id}/resolve`, { choices })).statusCode).toBe(200);
    const accepted = await accept();
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json().sections[0].answers['discovery.1'].value).toBe('Remote wording of the problem.');
    const stored = await h.db.collection('proposals').findOne({ id: proposal.id });
    expect(stored!.resolvedConflicts.find((c: any) => c.path === answerConflict.path)).toMatchObject({
      current: { value: 'Local wording of the problem.' },
      choice: 'remote',
    });

    // Nothing new remotely: importing again finds no changes.
    expect((await h.request('POST', `/projects/${p.id}/git/import`, {})).json()).toEqual({ unchanged: true });

    // Publishing again creates another branch; earlier branches are never rewritten.
    const current = (await h.project(p.id)).spec;
    const again = await h.request('POST', `/projects/${p.id}/git/publish`, { source: 'current', expectedRevision: current.revision, confirm: true });
    expect(again.json().branch).not.toBe(branch);
    expect(git(root, 'ls-remote', join(root, 'remote.git'), `refs/heads/${branch}`)).toContain(commit);
  });
  it('rejects credentials in remote URLs and non-https remotes', async () => {
    const p = await h.createProject();
    const url = (remoteUrl: string) => h.request('PUT', `/projects/${p.id}/git`, { provider: 'git', remoteUrl, branch: 'main' });
    expect((await url('https://user:pass@example.com/repo.git')).statusCode).toBe(400);
    expect((await url('http://example.com/repo.git')).statusCode).toBe(400);
    expect((await url('https://example.com/repo.git')).statusCode).toBe(200);
  });
});
