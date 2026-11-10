#!/usr/bin/env node
// Runs Python from the project virtual environment (.venv) on Windows, macOS and Linux.
// `node scripts/ux/py.mjs setup` creates .venv and installs scripts/ux/requirements.txt (OpenCV, Pillow).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const windows = process.platform === 'win32';
const venvPython = join('.venv', windows ? 'Scripts/python.exe' : 'bin/python');
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) {
    console.error(`Could not run ${cmd}: ${r.error.message}`);
    process.exit(2);
  }
  return r.status ?? 1;
};

const [command, ...args] = process.argv.slice(2);
if (command === 'setup') {
  if (!existsSync(venvPython)) {
    const status = windows ? run('py', ['-3', '-m', 'venv', '.venv']) : run('python3', ['-m', 'venv', '.venv']);
    if (status) process.exit(status);
  }
  process.exit(run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', '-r', 'scripts/ux/requirements.txt']));
}
if (!existsSync(venvPython)) {
  console.error('Python environment missing: run `pnpm ux:setup` first.');
  process.exit(2);
}
process.exit(run(venvPython, [command, ...args]));
