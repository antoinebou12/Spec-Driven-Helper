import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseBundleText } from '../packages/shared/src/bundle-formats';
import { canonicalJson } from '../packages/shared/src/domain';
import { setupApp, type Harness } from './helpers';

/** Specification bundles in JSON and TOON: fixtures, live exports and re-imports, error handling. */
const names = ['default-project', 'sdd-studio'] as const;
const folderFiles = (name: string) => {
  const base = join(__dirname, '..', 'fixtures', name);
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else out[relative(base, path).split('\\').join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(base);
  return out;
};

describe('JSON and TOON bundles', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('bundles');
  });
  afterAll(async () => h?.teardown());

  it.each(names)('%s: the TOON copy decodes to exactly the JSON bundle', (name) => {
    const folder = folderFiles(name);
    expect(parseBundleText(folder['.plan/specification.toon'])).toEqual(JSON.parse(folder['.plan/specification.json']));
  });

  it.each(names)('%s imports as a JSON bundle and as a TOON bundle, with the same proposal', async (name) => {
    const folder = folderFiles(name);
    const changes: number[] = [];
    for (const body of [JSON.parse(folder['.plan/specification.json']), { toon: folder['.plan/specification.toon'] }]) {
      const target = await h.createProject({ name: `Bundle ${name}` });
      const res = await h.request('POST', `/projects/${target.id}/import`, body);
      expect(res.statusCode, JSON.stringify(res.json()).slice(0, 300)).toBe(200);
      expect(res.json()).toMatchObject({ origin: 'import', status: 'pending' });
      changes.push(res.json().changes.length);
    }
    expect(changes[0]).toBeGreaterThan(0);
    expect(changes[1]).toBe(changes[0]);
  });

  it('exports a live project as JSON and TOON that both re-import losslessly', async () => {
    const source = await h.createProject({ name: 'Export source', sample: true });
    const json = await h.app.inject({ method: 'GET', url: `/api/v1/projects/${source.id}/export/json`, headers: { cookie: h.cookie } });
    const toon = await h.app.inject({ method: 'GET', url: `/api/v1/projects/${source.id}/export/toon`, headers: { cookie: h.cookie } });
    expect(json.statusCode).toBe(200);
    expect(toon.statusCode).toBe(200);
    expect(parseBundleText(toon.body)).toEqual(JSON.parse(json.body));
    const target = await h.createProject({ name: 'Import target' });
    const proposal = (await h.request('POST', `/projects/${target.id}/import`, { toon: toon.body })).json();
    expect((await h.request('POST', `/projects/${target.id}/proposals/${proposal.id}/accept`, {})).statusCode).toBe(200);
    const imported = (await h.project(target.id)).spec;
    const original = (await h.project(source.id)).spec;
    for (const s of original.sections) expect(canonicalJson(imported.sections.find((x: { id: string }) => x.id === s.id).answers), s.id).toBe(canonicalJson(s.answers));
  });

  it('rejects broken TOON and JSON with readable errors', async () => {
    const target = await h.createProject();
    const bad = await h.request('POST', `/projects/${target.id}/import`, { toon: 'format: sdd-studio\n  bad indentation: [' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toMatch(/Not a valid TOON bundle|Invalid input/);
    expect(() => parseBundleText('{ nope')).toThrow(/Not a valid JSON bundle/);
    expect(() => parseBundleText('x'.repeat(20_000_001))).toThrow(/larger than 20 MB/);
    const wrong = await h.request('POST', `/projects/${target.id}/import`, { toon: 'format: other\nversion: 1' });
    expect(wrong.statusCode).toBe(400);
  });
});
