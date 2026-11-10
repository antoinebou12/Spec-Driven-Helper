import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  familyLabels,
  licenseFamily,
  licenseFromText,
  type LicenseFamily,
} from '../packages/shared/src/licenses';

/**
 * Checks the licenses of SDD Studio's own production dependencies. The container image is
 * distributed, so dependencies must be permissive, open standards or weak copyleft kept as
 * separate libraries. Anything else needs a recorded exception below.
 */
const allowed: LicenseFamily[] = ['permissive', 'standard', 'weak-copyleft'];
const exceptions: Record<string, string> = {
  '@anthropic-ai/claude-agent-sdk':
    'Anthropic Commercial Terms; used only by the optional, separately deployed agent runner.',
};
const excepted = (name: string) =>
  Object.entries(exceptions).find(([pkg]) => name === pkg || name.startsWith(`${pkg}-`))?.[1];

type Entry = {
  name: string;
  versions?: string[];
  version?: string;
  paths?: string[];
  path?: string;
  license: string;
};
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const report = JSON.parse(
  execFileSync(pnpm, ['licenses', 'list', '--json', '--prod'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as Record<string, Entry[]>;

/** Packages without a license field often still ship a LICENSE file. */
const fromFile = (entry: Entry) => {
  for (const dir of entry.paths ?? (entry.path ? [entry.path] : [])) {
    if (!existsSync(dir)) continue;
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
    const spdx = file && licenseFromText(readFileSync(join(dir, file), 'utf8'));
    if (spdx) return spdx;
  }
  return undefined;
};

const counts = new Map<LicenseFamily, number>();
const problems: string[] = [];
const notes: string[] = [];
for (const [license, entries] of Object.entries(report))
  for (const entry of entries) {
    const spdx = /^unknown$/i.test(license) ? (fromFile(entry) ?? '') : license;
    const family = licenseFamily(spdx);
    counts.set(family, (counts.get(family) ?? 0) + 1);
    const id = `${entry.name}@${(entry.versions ?? [entry.version]).join(',')}`;
    if (allowed.includes(family)) continue;
    const reason = excepted(entry.name);
    if (reason) notes.push(`exception ${id} (${spdx || 'no license field'}): ${reason}`);
    else
      problems.push(
        `${id}: ${spdx || 'no license found'} (${familyLabels[family].en.toLowerCase()})`,
      );
  }

for (const [family, n] of [...counts].sort((a, b) => b[1] - a[1]))
  console.log(`${String(n).padStart(5)} ${familyLabels[family].en}`);
for (const note of notes) console.log(`note ${note}`);
for (const problem of problems) console.error(`FAIL ${problem}`);
console.log(
  problems.length
    ? `${problems.length} dependencies need review or an exception in scripts/check-licenses.ts.`
    : 'All production dependency licenses are allowed.',
);
process.exit(problems.length ? 1 : 0);
