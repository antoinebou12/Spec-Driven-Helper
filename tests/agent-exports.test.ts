import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentFiles, implementationFiles, overviewImage, serialize, skillFiles, specKitZip } from '../apps/api/src/exports';
import { buildExampleSpec } from '../packages/shared/src/example';
import { setupApp, type Harness } from './helpers';

/** Standalone skill and agent-file exports (TASK-070), and text hygiene of every generated file. */
const spec = buildExampleSpec('00000000-0000-4000-8000-0000000000f1');
const mojibake = new RegExp('\u00e2\u20ac|\u00e2\u0153|\u00c3[\\u00a0-\\u00ff]|\u00c2[\u00b7\u00b0\u00ab\u00bb]|\u00c3\u2014|\\ufffd');

describe('standalone skill', () => {
  const files = skillFiles(spec);
  const skillPath = Object.keys(files).find((p) => p.endsWith('/SKILL.md'))!;
  const [, frontmatter, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(files[skillPath])!;
  const meta = Object.fromEntries(frontmatter.split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));

  it('has valid frontmatter: a lowercase name up to 64 characters and a description that says when to use it', () => {
    expect(skillPath).toBe('customer-request-portal-spec/SKILL.md');
    expect(meta.name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(meta.name).toBe(skillPath.split('/')[0]);
    expect(meta.description.length).toBeLessThanOrEqual(1024);
    expect(meta.description).toMatch(/Use when/);
    expect(meta.description).not.toMatch(/[<>]/);
  });

  it('keeps SKILL.md short and lists only reference files that exist', () => {
    expect(body.split('\n').length).toBeLessThan(80);
    const referenced = [...body.matchAll(/\| (references\/[^\s|]+) \|/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThanOrEqual(18);
    for (const r of referenced) expect(files[`${meta.name}/${r}`], r).toBeTruthy();
    expect(files[`${meta.name}/references/items/requirements.md`]).toContain('REQ-001');
    // Every file is listed: SKILL.md is the only way an agent finds them (rules are in skill-audit.test.ts).
    expect(Object.keys(files).filter((p) => !p.endsWith('/SKILL.md')).every((p) => body.includes(p.slice(meta.name.length + 1)))).toBe(true);
  });
});

describe('agent files', () => {
  it('covers the main coding agents with one set of rules', () => {
    const files = agentFiles(spec);
    expect(Object.keys(files).sort()).toEqual(['.claude/skills/maintain-spec/SKILL.md', '.cursor/rules/specification.mdc', '.github/copilot-instructions.md', 'AGENTS.md', 'CLAUDE.md', 'DESIGN.md', 'GEMINI.md', 'PRODUCT.md']);
    expect(files['CLAUDE.md'].startsWith('@AGENTS.md')).toBe(true);
    expect(files['.cursor/rules/specification.mdc']).toMatch(/^---\ndescription: .+\nalwaysApply: true\n---\n/);
    expect(files['AGENTS.md']).toMatch(/^# Customer Request Portal — agent instructions/);
  });

  it('never writes mojibake in any generated text file', async () => {
    const all: Record<string, string> = { ...implementationFiles(spec), ...agentFiles(spec), ...skillFiles(spec), 'overview.svg': overviewImage(spec) };
    expect(all['overview.svg']).toContain('Web application · r');
    // The document exports carry French labels (Révision, Traçabilité, Préparation, prêt) and a check mark.
    const french = { ...buildExampleSpec('00000000-0000-4000-8000-0000000000f2'), language: 'fr' as const };
    for (const format of ['markdown', 'html', 'latex']) all[`french.${format}`] = serialize(french, format);
    expect(all['french.markdown']).toMatch(/Révision[\s\S]*Préparation[\s\S]*Traçabilité/);
    expect(serialize(buildExampleSpec('00000000-0000-4000-8000-0000000000f3'), 'markdown')).toMatch(/Readiness \| \d+%/);
    const zip = await JSZip.loadAsync(await specKitZip(spec));
    for (const e of Object.values(zip.files)) if (!e.dir) all[`speckit/${e.name}`] = await e.async('string');
    expect(Object.entries(all).filter(([, text]) => mojibake.test(text)).map(([path]) => path)).toEqual([]);
  });

  it('has no mojibake in the source of any module', () => {
    // UTF-8 text saved as Windows-1252 turns “·”, “é” and “✔” into two or three odd characters; catch it where it starts.
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', 'dist', 'coverage'].includes(entry.name)) walk(path);
        } else if (/\.(ts|tsx|css|md)$/.test(entry.name) && mojibake.test(readFileSync(path, 'utf8'))) found.push(path.slice(join(__dirname, '..').length + 1));
      }
    };
    for (const root of ['apps', 'packages']) walk(join(__dirname, '..', root));
    expect(found).toEqual([]);
  });
});

describe('export routes', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('agent_exports');
  });
  afterAll(async () => h?.teardown());

  it.each([
    ['skill', 'skill.zip', 'SKILL.md'],
    ['agents', 'agents.zip', 'AGENTS.md'],
  ])('GET /export/%s returns a zip', async (format, extension, must) => {
    const p = await h.createProject({ name: 'Export me', sample: true });
    const res = await h.app.inject({ method: 'GET', url: `/api/v1/projects/${p.id}/export/${format}`, headers: { cookie: h.cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain(`.${extension}`);
    const zip = await JSZip.loadAsync(res.rawPayload);
    expect(Object.keys(zip.files).some((f) => f.endsWith(must))).toBe(true);
  });
});
