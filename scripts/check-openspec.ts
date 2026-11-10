import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { taskConsistency } from '../packages/shared/src/openspec-consistency';

const root = resolve(import.meta.dirname, '..');
const changes: Record<string, string> = {};
const visit = (folder: string) => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.name === 'tasks.md') changes[path] = readFileSync(path, 'utf8');
  }
};
visit(join(root, 'openspec/changes'));
const errors = taskConsistency(readFileSync(join(root, '.plan/tasks.md'), 'utf8'), changes);
for (const folder of readdirSync(join(root, 'openspec/changes'), { withFileTypes: true })) {
  if (
    folder.isDirectory() &&
    folder.name !== 'archive' &&
    !existsSync(join(root, 'openspec/changes', folder.name, 'tasks.md'))
  )
    errors.push(`${folder.name}: tasks.md is missing`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const cli = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/@fission-ai/openspec/bin/openspec.js'),
    'validate',
    '--all',
    '--strict',
    '--no-interactive',
  ],
  {
    cwd: root,
    env: { ...process.env, OPENSPEC_TELEMETRY: '0', OPENSPEC_NO_UPDATE_CHECK: '1' },
    stdio: 'inherit',
  },
);
if (cli.error) console.error(cli.error.message);
process.exit(cli.status ?? 1);
