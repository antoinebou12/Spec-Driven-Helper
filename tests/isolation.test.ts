import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { mkdirSync, mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { toolDecision, writeWorkspace, agentEnvironment } from '../apps/agent-runner/src/policy';
import { readTree, safeArchiveFiles, safeRelativePath } from '../apps/api/src/git';

const workspace = join(tmpdir(), 'sdd-agent-policy');

describe('Claude Agent tool policy', () => {
  it('allows read-only inspection inside the session workspace', () => {
    expect(toolDecision('Read', { file_path: join(workspace, 'sections/scope.md') }, workspace).decision).toBe('allow');
    expect(toolDecision('Read', { file_path: 'specification-context.json' }, workspace).decision).toBe('allow');
    expect(toolDecision('Glob', { pattern: 'repository/**/*.ts' }, workspace).decision).toBe('allow');
    expect(toolDecision('Grep', { pattern: 'TODO|FIXME', path: 'repository' }, workspace).decision).toBe('allow');
  });
  it('denies every tool that could modify, execute or reach the network', () => {
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task', 'mcp__x__y'])
      expect(toolDecision(tool, { file_path: 'sections/a.md' }, workspace).decision, tool).toBe('deny');
  });
  it('denies paths and patterns that escape the workspace', () => {
    for (const input of [
      { file_path: '../../etc/passwd' },
      { file_path: '/etc/passwd' },
      { file_path: join(workspace, '..', 'secrets.env') },
      { path: 'C:\\Windows\\System32' },
    ])
      expect(toolDecision('Read', input, workspace).decision, JSON.stringify(input)).toBe('deny');
    expect(toolDecision('Glob', { pattern: '../**/*' }, workspace).decision).toBe('deny');
    expect(toolDecision('Glob', { pattern: '/home/**' }, workspace).decision).toBe('deny');
    expect(toolDecision('Grep', { pattern: 'key', glob: '../../**' }, workspace).decision).toBe('deny');
    expect(toolDecision('Grep', { pattern: 'x', path: '/' }, workspace).decision).toBe('deny');
  });
  it('writes session material only inside a fresh workspace', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-ws-'));
    try {
      await writeWorkspace(dir, { 'sections/a.md': 'A', 'repository/src/x.ts': 'x' });
      expect(readdirSync(dir).sort()).toEqual(['repository', 'sections']);
      for (const bad of ['../escape.txt', '/abs.txt', 'C:\\x.txt', 'a/../../b', '~/x'])
        await expect(writeWorkspace(dir, { [bad]: 'x' }), bad).rejects.toThrow(/Unsafe/);
      await expect(writeWorkspace(dir, { 'sections/a.md': 'overwrite' })).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('gives the agent process no host environment beyond what it needs', () => {
    const env = agentEnvironment('/ws', {
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'k',
      DATABASE_URL: 'postgres://secret',
      ENCRYPTION_KEY: 'x',
      AGENT_RUNNER_TOKEN: 't',
    });
    expect(env.HOME).toBe('/ws');
    expect(env.ANTHROPIC_API_KEY).toBe('k');
    expect(Object.keys(env)).not.toEqual(expect.arrayContaining(['DATABASE_URL']));
    expect(env).not.toHaveProperty('ENCRYPTION_KEY');
    expect(env).not.toHaveProperty('AGENT_RUNNER_TOKEN');
  });
});

describe('archive extraction', () => {
  it('normalizes only safe relative paths', () => {
    expect(safeRelativePath('repo-abc/src/./index.ts')).toBe('repo-abc/src/index.ts');
    for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'C:/x', 'a\\b', 'a\0b']) expect(safeRelativePath(bad), bad).toBeNull();
  });
  it('rejects zip-slip entries and skips links, binaries and vendored folders', async () => {
    const good = new JSZip();
    good.file('repo-sha/src/app.ts', 'export const x = 1;');
    good.file('repo-sha/node_modules/pkg/index.js', 'x');
    good.file('repo-sha/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]));
    good.file('repo-sha/link', 'target', { unixPermissions: 0o120777 });
    const files = await safeArchiveFiles(await good.generateAsync({ type: 'nodebuffer', platform: 'UNIX' }));
    expect(Object.keys(files)).toEqual(['repository/src/app.ts']);
    const evil = new JSZip();
    evil.file('repo-sha/../../evil.sh', 'rm -rf /');
    await expect(safeArchiveFiles(await evil.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow(/Unsafe path/);
  });

  const secrets = [
    '.env',
    'deploy/.env.production',
    'certs/server.key',
    'infra/terraform.tfstate',
    'infra/terraform.tfstate.backup',
    'infra/prod.tfvars',
    'infra/prod.auto.tfvars.json',
    '.terraformrc',
    'ops/kubeconfig',
    '.kube/config',
    '.npmrc',
    '.git-credentials',
    'infra/.terraform/terraform.tfstate',
    'infra/.terraform/modules/vpc/main.tf',
    'live/.terragrunt-cache/abc/main.tf',
  ];
  const kept = ['infra/main.tf', 'infra/example.tfvars.example', '.env.example', 'README.md'];

  it('never reads files that look like secrets or IaC caches from an archive', async () => {
    const zip = new JSZip();
    for (const path of [...secrets, ...kept]) zip.file(`repo-sha/${path}`, `content of ${path}: password=hunter2`);
    const files = await safeArchiveFiles(await zip.generateAsync({ type: 'nodebuffer' }), '');
    expect(Object.keys(files).sort()).toEqual([...kept].sort());
  });

  it('never reads files that look like secrets or IaC caches from a cloned tree', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-tree-'));
    try {
      for (const path of [...secrets, ...kept]) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), `content of ${path}`);
      }
      const files = await readTree(dir, '');
      expect(Object.keys(files).sort()).toEqual([...kept].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
